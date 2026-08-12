// npm run du:compare
//
// Phase 14: compare the scraped DU catalogue against NoteVault's existing
// Subject/Resource data. Read-only — no writes to the database. Produces
// import-candidates.csv for a human to review before anything is imported.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { config as loadDotenv } from "dotenv";
loadDotenv({ path: ".env.local" });
// Instantiate Prisma directly rather than importing the shared @/lib/prisma
// wrapper: that file starts with `import "server-only"`, which throws when
// loaded from a plain tsx/Node script outside Next's bundler.
import { PrismaClient } from "@/generated/prisma";
const prisma = new PrismaClient();
import { PATHS } from "./config";
import { writeGenericCsv } from "./csv-writer";
import type { QuestionPaperRecord } from "./types";

type MatchStatus = "ALREADY_EXISTS" | "NEW_MATCHED" | "NEW_NEEDS_MAPPING" | "AMBIGUOUS" | "PROBABLE_DUPLICATE";

function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ").replace(/[-–—.,]/g, "");
}

// DU sessions look like "MAY-JUNE-2026" / "NOV-DEC-2025"; NoteVault's
// Resource.session field is free text like "May-June" (no year, year is
// separate). Compare the month-pair only, case-insensitively.
function sessionMonths(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .toUpperCase()
    .replace(/\d{4}/g, "")
    .replace(/[^A-Z-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  if (!existsSync(PATHS.questionPapersJson)) {
    console.error(`No scraped data at ${PATHS.questionPapersJson}. Run "npm run du:scrape" first.`);
    process.exit(1);
  }
  const records: QuestionPaperRecord[] = JSON.parse(readFileSync(PATHS.questionPapersJson, "utf-8"));

  console.log("Loading existing NoteVault catalog (Subjects + Resources)...");
  const subjects = await prisma.subject.findMany({
    select: {
      id: true,
      name: true,
      upc: true,
      aliases: true,
      mergedIntoId: true,
      termId: true,
      term: { select: { name: true, program: { select: { id: true, name: true } } } },
    },
  });
  const resources = await prisma.resource.findMany({
    where: { type: "PYQ" },
    select: { subjectId: true, session: true, year: true, paperCode: true },
  });

  const upcIndex = new Map<string, typeof subjects>();
  const nameIndex = new Map<string, typeof subjects>();
  for (const s of subjects) {
    if (s.mergedIntoId) continue; // deprecated row, its resources were reassigned
    if (s.upc) upcIndex.set(s.upc.trim(), [...(upcIndex.get(s.upc.trim()) ?? []), s]);
    const keys = new Set([normalize(s.name), ...s.aliases.map(normalize)]);
    for (const k of keys) nameIndex.set(k, [...(nameIndex.get(k) ?? []), s]);
  }

  const resourcesBySubject = new Map<string, typeof resources>();
  for (const r of resources) {
    resourcesBySubject.set(r.subjectId, [...(resourcesBySubject.get(r.subjectId) ?? []), r]);
  }

  const rows: Record<string, unknown>[] = [];
  const counts: Record<MatchStatus, number> = {
    ALREADY_EXISTS: 0,
    NEW_MATCHED: 0,
    NEW_NEEDS_MAPPING: 0,
    AMBIGUOUS: 0,
    PROBABLE_DUPLICATE: 0,
  };

  const seenPdf = new Set<string>();

  for (const rec of records) {
    let matchStatus: MatchStatus;
    let matchMethod = "none";
    let confidence = 0;
    let matchedSubject: (typeof subjects)[number] | null = null;
    let notes = "";

    if (rec.pdf_url && seenPdf.has(rec.pdf_url)) {
      matchStatus = "PROBABLE_DUPLICATE";
      matchMethod = "pdf_url_seen_earlier_in_scrape";
      notes = "Same pdf_url already listed earlier in this same scrape output";
      rows.push(candidateRow(rec, matchStatus, matchMethod, null, 0, notes));
      counts[matchStatus]++;
    } else {
      if (rec.pdf_url) seenPdf.add(rec.pdf_url);

      const byUpc = rec.upc ? upcIndex.get(rec.upc.trim()) ?? [] : [];
      const byName = nameIndex.get(normalize(rec.paper_name ?? "")) ?? [];

      if (byUpc.length === 1) {
        matchedSubject = byUpc[0];
        matchMethod = "upc";
        confidence = 0.95;
      } else if (byUpc.length > 1) {
        matchStatus = "AMBIGUOUS";
        matchMethod = "upc";
        notes = `${byUpc.length} subjects share UPC ${rec.upc}`;
        rows.push(candidateRow(rec, "AMBIGUOUS", matchMethod, null, 0, notes));
        counts.AMBIGUOUS++;
        continue;
      } else if (byName.length === 1) {
        matchedSubject = byName[0];
        matchMethod = "normalized_name";
        confidence = 0.6;
      } else if (byName.length > 1) {
        matchStatus = "AMBIGUOUS";
        matchMethod = "normalized_name";
        notes = `${byName.length} subjects share normalized name "${normalize(rec.paper_name ?? "")}"`;
        rows.push(candidateRow(rec, "AMBIGUOUS", matchMethod, null, 0, notes));
        counts.AMBIGUOUS++;
        continue;
      }

      if (!matchedSubject) {
        matchStatus = "NEW_NEEDS_MAPPING";
        notes = "No Subject matched by UPC or normalized name";
      } else {
        const existingForSubject = resourcesBySubject.get(matchedSubject.id) ?? [];
        const wantedMonths = sessionMonths(rec.examination_session);
        const alreadyHasSession = existingForSubject.some(
          (r) =>
            (rec.year && r.year === rec.year && sessionMonths(r.session) === wantedMonths) ||
            (rec.upc && r.paperCode && r.paperCode.trim() === rec.upc.trim() && sessionMonths(r.session) === wantedMonths),
        );
        matchStatus = alreadyHasSession ? "ALREADY_EXISTS" : "NEW_MATCHED";
        notes = alreadyHasSession
          ? "Matched Subject already has a Resource for this session/year"
          : "Matched Subject exists, but not for this session/year yet";
      }

      rows.push(
        candidateRow(
          rec,
          matchStatus,
          matchMethod,
          matchedSubject ? { subjectId: matchedSubject.id, programId: matchedSubject.term.program.id, termId: matchedSubject.termId } : null,
          confidence,
          notes,
        ),
      );
      counts[matchStatus]++;
    }
  }

  writeGenericCsv(
    rows,
    [
      "du_source_department",
      "du_source_paper",
      "du_source_upc",
      "du_source_session",
      "du_source_pdf_url",
      "existing_subject_id",
      "existing_program_id",
      "existing_term_id",
      "match_status",
      "match_method",
      "confidence",
      "notes",
    ],
    PATHS.importCandidatesCsv,
  );

  console.log("\nComparison summary:");
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v}`);
  console.log(`\nWritten: ${PATHS.importCandidatesCsv}`);
  writeFileSync(
    `${PATHS.dataDir}/compare-summary.json`,
    JSON.stringify({ generatedAt: new Date().toISOString(), counts }, null, 2),
  );

  await prisma.$disconnect();
}

function candidateRow(
  rec: QuestionPaperRecord,
  status: MatchStatus,
  method: string,
  matched: { subjectId: string; programId: string; termId: string } | null,
  confidence: number,
  notes: string,
): Record<string, unknown> {
  return {
    du_source_department: rec.department_name,
    du_source_paper: rec.paper_name,
    du_source_upc: rec.upc,
    du_source_session: rec.examination_session,
    du_source_pdf_url: rec.pdf_url,
    existing_subject_id: matched?.subjectId ?? "",
    existing_program_id: matched?.programId ?? "",
    existing_term_id: matched?.termId ?? "",
    match_status: status,
    match_method: method,
    confidence,
    notes,
  };
}

main().catch(async (err) => {
  console.error("du:compare failed:", err instanceof Error ? err.message : err);
  await prisma.$disconnect();
  process.exit(1);
});
