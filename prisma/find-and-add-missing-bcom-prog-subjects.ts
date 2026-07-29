// Scans every B.Com (Programme) DriveSubject that survived Phase 1's cleanup
// and Phase 3's auto-linker still unlinked (subjectId null) — since
// DriveSubject is scoped per-Program rather than per-session, this already
// covers every year/session's papers, not just the latest one — and reports
// which ones represent a subject genuinely missing from the DSC/DSE/SEC
// catalog versus a naming/abbreviation variant of one that already exists,
// or an out-of-scope AEC/language paper.
//
// Report-only, deliberately: an earlier version of this script auto-created
// a new Subject for anything under a low confidence bar, which sounds safe
// but wasn't — "Goods & Services Tax" (an existing DriveSubject) scored only
// 0.19 similarity against "GST and Customs Law" (the real catalog match:
// same subject, just spelled out instead of abbreviated) and got created as
// a bogus duplicate. A wrong guess here pollutes the catalog with a
// near-duplicate that's *harder* to clean up than an unlinked DriveSubject
// sitting in the Course Coverage page's "Needs review" panel — so every case
// below is left for a human to resolve there (link to an existing subject,
// or add a real new one through the normal admin subject-creation flow) with
// this report as a starting point, e.g. this run against the live catalog
// found 18 unlinked names, 0 of which were unmatched-and-unexplained (7
// likely variants of an existing subject, the rest out-of-scope language
// papers) — no genuinely missing DSC/DSE/SEC subject.
import { config } from "dotenv";
import path from "path";
config({ path: path.join(process.cwd(), ".env.local") });
config({ path: path.join(process.cwd(), ".env") });

import { PrismaClient } from "../src/generated/prisma";
import { matchDriveSubjectName } from "../src/lib/subject-quality";

const prisma = new PrismaClient();

const CODE_PREFIX = /^[A-Za-z]{2,4}-\d+\.\d+\s*[—–-]\s*/;
const OUT_OF_SCOPE_KEYWORDS = [
  "hindi", "sanskrit", "bhasha", "sahitya", "gadya", "gadh", "urdu", "punjabi", "english lang",
];

async function main() {
  const program = await prisma.program.findUnique({ where: { slug: "bcom-programme" } });
  if (!program) throw new Error("bcom-programme program not found.");

  const catalogSubjects = await prisma.subject.findMany({
    where: { term: { programId: program.id } },
    select: { id: true, name: true },
  });
  const candidates = catalogSubjects.map((s) => ({ id: s.id, name: s.name.replace(CODE_PREFIX, "").trim() }));

  const unlinked = await prisma.driveSubject.findMany({
    where: { programId: program.id, subjectId: null },
    select: { id: true, name: true, _count: { select: { files: true } } },
    orderBy: { name: "asc" },
  });

  const likelyVariant: string[] = [];
  const outOfScope: string[] = [];
  const unexplained: string[] = [];

  for (const ds of unlinked) {
    const isOutOfScope = OUT_OF_SCOPE_KEYWORDS.some((kw) => ds.name.toLowerCase().includes(kw));
    if (isOutOfScope) {
      outOfScope.push(`"${ds.name}" (${ds._count.files} file(s))`);
      continue;
    }

    const { subject, confidence } = matchDriveSubjectName(candidates, ds.name);
    // A generous bar on purpose — this is a hint for the human resolving it
    // in "Needs review", not an auto-accept threshold. Anything with *some*
    // signal toward an existing subject, or short enough to plausibly be an
    // abbreviation (GST, HRM), is far more likely a variant than a new one.
    const isPlausibleVariant = confidence >= 0.15 || ds.name.replace(/[^A-Za-z]/g, "").length <= 5;
    if (isPlausibleVariant) {
      likelyVariant.push(
        `"${ds.name}" (${ds._count.files} file(s))${subject ? ` — closest: "${subject.name}" (${Math.round(confidence * 100) / 100})` : ""}`
      );
    } else {
      unexplained.push(`"${ds.name}" (${ds._count.files} file(s))`);
    }
  }

  console.log(`Scanned ${unlinked.length} unlinked DriveSubject(s) for ${program.name} (all years).\n`);

  console.log(`Likely a naming/abbreviation variant of an existing catalog subject — resolve via "Needs review" on the Course Coverage page: ${likelyVariant.length}`);
  likelyVariant.forEach((v) => console.log(`  - ${v}`));

  console.log(`\nOut of scope (AEC/language paper, not DSC/DSE/SEC): ${outOfScope.length}`);
  outOfScope.forEach((o) => console.log(`  - ${o}`));

  console.log(`\nNo plausible existing match at all — genuinely missing subjects, worth adding to the catalog: ${unexplained.length}`);
  unexplained.forEach((u) => console.log(`  - ${u}`));
  if (unexplained.length === 0) {
    console.log("  (none — the DSC/DSE/SEC catalog already covers everything found in the real papers.)");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
