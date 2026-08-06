// Source adapter: src/lib/content/master-syllabus-data.ts (MASTER_SYLLABUS_ROWS,
// 6,295 rows) → Program / Term / Subject. This is the same data
// buildFallbackProgram() in src/lib/data.ts already uses as its offline
// fallback — importing it gives the staging DB real Program/Term/Subject
// rows instead of only ever seeing this data through the fallback path.
import { MASTER_SYLLABUS_ROWS } from "@/lib/content/master-syllabus-data";
import { deterministicSlug, normalizeWhitespaceAndUnicode, parseSemesterField } from "../lib/normalize";
import type { PlannedRecord, SourceAdapterResult, WarningEntry } from "../lib/types";

const SOURCE_FILE = "src/lib/content/master-syllabus-data.ts";
const LEVEL = "COLLEGE" as const;

export function loadMasterSyllabusSource(): SourceAdapterResult {
  const records: PlannedRecord[] = [];
  const warnings: WarningEntry[] = [];
  const seenPrograms = new Set<string>();
  const seenTerms = new Set<string>();

  for (const row of MASTER_SYLLABUS_ROWS) {
    const rowRef = `id=${row.id}`;
    const courseName = normalizeWhitespaceAndUnicode(row.course);
    const programSlug = deterministicSlug(courseName);

    if (!seenPrograms.has(programSlug)) {
      seenPrograms.add(programSlug);
      records.push({
        model: "Program",
        naturalKey: programSlug,
        data: { level: LEVEL, name: courseName, slug: programSlug, summary: null },
        provenance: { sourceFile: SOURCE_FILE, sourceRowRef: rowRef },
        original: { course: row.course },
      });
    }

    const semesterResult = parseSemesterField(row.semester);
    const orders: number[] =
      semesterResult.kind === "single"
        ? [semesterResult.order]
        : semesterResult.kind === "multi"
          ? semesterResult.orders
          : [];

    if (semesterResult.kind === "pool" || semesterResult.kind === "unparseable") {
      warnings.push({
        sourceFile: SOURCE_FILE,
        sourceRowRef: rowRef,
        model: "Subject",
        field: "semester",
        message:
          semesterResult.kind === "pool"
            ? `"${row.semester}" is an elective-pool row (no fixed semester) — not imported this wave, needs a pool-Program design decision`
            : `"${row.semester}" could not be parsed into semester number(s) — row skipped`,
      });
      continue;
    }

    for (const order of orders) {
      const termKey = `${programSlug}::${order}`;
      if (!seenTerms.has(termKey)) {
        seenTerms.add(termKey);
        records.push({
          model: "Term",
          naturalKey: termKey,
          data: { programSlug, order, name: `Semester ${order}` },
          provenance: { sourceFile: SOURCE_FILE, sourceRowRef: rowRef },
          original: { course: row.course, semester: row.semester },
        });
      }

      const subjectName = normalizeWhitespaceAndUnicode(row.subjectName);
      const subjectSlug = deterministicSlug(subjectName);
      const subjectKey = `${termKey}::${subjectSlug}`;

      if (orders.length > 1) {
        warnings.push({
          sourceFile: SOURCE_FILE,
          sourceRowRef: rowRef,
          model: "Subject",
          field: "semester",
          message: `Multi-semester source row "${row.semester}" expanded into Semester ${order} (and ${orders.length - 1} other term(s)) — same subject created once per semester`,
        });
      }

      records.push({
        model: "Subject",
        naturalKey: subjectKey,
        data: {
          termKey,
          name: subjectName,
          slug: subjectSlug,
          description: row.courseNumber ? `${row.courseNumber} · Credits: ${row.credits ?? ""}`.trim() : null,
          upc: row.upc && row.upc !== "TO BE UPDATED" && row.upc !== "TO BE ANNOUNCED" ? row.upc : null,
          paperType: row.type || null,
        },
        provenance: { sourceFile: SOURCE_FILE, sourceRowRef: rowRef },
        original: {
          course: row.course,
          semester: row.semester,
          subjectName: row.subjectName,
          courseNumber: row.courseNumber ?? "",
          upc: row.upc ?? "",
          type: row.type,
        },
      });
    }
  }

  return { sourceName: "master-syllabus", sourceFile: SOURCE_FILE, records, warnings };
}
