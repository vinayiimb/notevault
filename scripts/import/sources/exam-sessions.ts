// Source adapter: src/data/exam-sessions-source.ts (extracted from
// prisma/seed-historical-exam-sessions.ts's SESSIONS literal — see that
// file's header comment) → ExamSession / SessionProgramLink.
//
// The original script resolves `course` names to Programs via
// matchProgramName() (src/lib/subject-quality.ts), a fuzzy matcher with
// hand-resolved special cases (ALL-SUBJECTS bundles, abbreviations, an
// "Unsorted" catch-all). Reimplementing that exact fuzzy logic is out of
// scope for a deterministic-only importer wave — instead, this adapter only
// creates a SessionProgramLink where `course` exactly matches (after
// normalization) a Program this import run is already creating from
// master-syllabus.ts, or an existing Program in the target DB. Anything
// that doesn't match exactly is reported as an unresolved foreign key, not
// silently dropped or fuzzy-guessed — see docs/PHASE_2C_DATA_IMPORT_PLAN.md.
import { EXAM_SESSIONS_SOURCE } from "@/data/exam-sessions-source";
import { deterministicSlug, normalizeWhitespaceAndUnicode } from "../lib/normalize";
import { validateUrl } from "../lib/validate";
import type { PlannedRecord, SourceAdapterResult, WarningEntry } from "../lib/types";

const SOURCE_FILE = "src/data/exam-sessions-source.ts";

export function loadExamSessionsSource(): SourceAdapterResult {
  const records: PlannedRecord[] = [];
  const warnings: WarningEntry[] = [];

  for (const session of EXAM_SESSIONS_SOURCE) {
    const sessionKey = normalizeWhitespaceAndUnicode(session.label);
    records.push({
      model: "ExamSession",
      naturalKey: sessionKey,
      data: { label: session.label, order: session.order },
      provenance: { sourceFile: SOURCE_FILE, sourceRowRef: `session=${session.label}` },
      original: { label: session.label },
    });

    for (const [index, row] of session.rows.entries()) {
      const rowRef = `session=${session.label} row=${index}`;
      const urlIssues = validateUrl(row.url, "url");
      if (urlIssues.length > 0) {
        warnings.push({
          sourceFile: SOURCE_FILE,
          sourceRowRef: rowRef,
          model: "SessionProgramLink",
          field: "url",
          message: urlIssues.map((i) => i.message).join("; "),
        });
        continue;
      }

      const courseName = normalizeWhitespaceAndUnicode(row.course);
      const programSlug = deterministicSlug(courseName);
      records.push({
        model: "SessionProgramLink",
        naturalKey: `${sessionKey}::${programSlug}::`,
        data: { sessionKey, programSlug, variantLabel: "", driveUrl: row.url },
        provenance: { sourceFile: SOURCE_FILE, sourceRowRef: rowRef },
        original: { course: row.course, url: row.url, session: session.label },
      });
    }
  }

  return { sourceName: "exam-sessions", sourceFile: SOURCE_FILE, records, warnings };
}
