// Phase 3 resource source adapter — loads real, previously-uploaded PYQ
// paper records from prisma/migration-export.json (a snapshot export of a
// prior local/dev database — see docs/PHASE_3_RESOURCE_IMPORT_PLAN.md §2
// for full provenance). This is the ONLY source wired into this wave;
// static catalogs (src/data/*.ts, ramanujan-pyq-catalog.json) are already
// served independently of Postgres and are deliberately NOT re-imported
// here — see the plan doc's Source Inventory for why each candidate source
// was included or excluded.
//
// This adapter only *reads and normalizes* the export — no DB access here.
// Subject-natural-key resolution and R2/storage verification happen in
// resource-plan.ts, against the live target database.
import { readFileSync } from "node:fs";
import { normalizeWhitespaceAndUnicode } from "../lib/normalize";
import { canonicalSubjectKey } from "@/lib/subject-normalization";

const EXPORT_FILE = "prisma/migration-export.json";

/** Same shape as scripts/import/lib/types.ts's WarningEntry, but `model` is
 * a free string — this adapter's warnings aren't always about one of the
 * catalogue wave's 5 SourceModel values (e.g. "Resource" itself). */
export type ResourceWarningEntry = {
  sourceFile: string;
  sourceRowRef: string;
  model: string;
  field: string;
  message: string;
};

type ExportProgram = { id: string; level: string; name: string; slug: string; summary: string | null };
type ExportTerm = { id: string; programId: string; name: string; order: number };
type ExportSubject = { id: string; termId: string; name: string; slug: string; description: string | null };
type ExportResource = {
  id: string;
  subjectId: string;
  type: string;
  title: string;
  year: number | null;
  academicYear?: string | null;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  fileHash: string | null;
  downloads: number;
  createdAt: string;
  batchId: string | null;
};

export type PlannedResourceRecord = {
  /** Deterministic, idempotent natural key — reused as Resource.sourceJsonName
   * on apply (already a @unique column in the schema — no migration needed). */
  naturalKey: string;
  data: {
    title: string;
    type: string;
    year: number | null;
    academicYear: string | null;
    fileUrl: string;
    fileName: string;
    fileSize: number;
    fileHash: string | null;
    downloads: number;
    createdAt: string;
    /** Deterministic canonical key of the OLD export's subject name — resolved
     * against the CURRENT target DB's Subjects in resource-plan.ts. Never the
     * old export's raw subjectId, which is meaningless in the target DB. */
    subjectCanonicalKey: string;
    /** Old Program.slug — resolved to a current-DB slug (or the pool-program
     * set) via data/import-mappings/resource-program-mapping.json in
     * resource-plan.ts. Never used as a target id directly. */
    exportProgramSlug: string;
    /** Old Term.order (semester number) — used only as a tie-breaker when a
     * subject name matches more than one current Subject within the same
     * scoped programme (e.g. a repeated elective offered in two semesters). */
    exportTermOrder: number | null;
  };
  /** Original, unresolved values — preserved verbatim for the report and for
   * human review, never silently dropped. */
  original: {
    exportResourceId: string;
    exportSubjectId: string;
    exportSubjectName: string;
    exportTermName: string;
    exportProgramName: string;
    exportProgramSlug: string;
    fileUrl: string;
  };
  provenance: { sourceFile: string; sourceRowRef: string };
};

export type ResourceSourceResult = {
  sourceName: string;
  sourceFile: string;
  records: PlannedResourceRecord[];
  warnings: ResourceWarningEntry[];
};

export function loadResourceSource(): ResourceSourceResult {
  const warnings: ResourceWarningEntry[] = [];
  const raw = JSON.parse(readFileSync(EXPORT_FILE, "utf-8")) as {
    programs: ExportProgram[];
    terms: ExportTerm[];
    subjects: ExportSubject[];
    resources: ExportResource[];
  };

  const programById = new Map(raw.programs.map((p) => [p.id, p]));
  const termById = new Map(raw.terms.map((t) => [t.id, t]));
  const subjectById = new Map(raw.subjects.map((s) => [s.id, s]));

  const records: PlannedResourceRecord[] = [];

  for (const [index, resource] of raw.resources.entries()) {
    const rowRef = `resources[${index}] id=${resource.id}`;
    const subject = subjectById.get(resource.subjectId);
    if (!subject) {
      warnings.push({
        sourceFile: EXPORT_FILE,
        sourceRowRef: rowRef,
        model: "Subject",
        field: "subjectId",
        message: `Export subject id "${resource.subjectId}" not found in the export's own subjects[] array — resource skipped entirely (cannot even report an original subject name).`,
      });
      continue;
    }
    const term = termById.get(subject.termId);
    const program = term ? programById.get(term.programId) : undefined;

    const cleanedTitle = normalizeWhitespaceAndUnicode(resource.title);
    const subjectCanonicalKey = canonicalSubjectKey(normalizeWhitespaceAndUnicode(subject.name));

    records.push({
      naturalKey: `migration-export:${resource.id}`,
      data: {
        title: cleanedTitle,
        type: resource.type,
        year: resource.year,
        academicYear: resource.academicYear ?? null,
        fileUrl: resource.fileUrl,
        fileName: resource.fileName,
        fileSize: resource.fileSize,
        fileHash: resource.fileHash,
        downloads: resource.downloads,
        createdAt: resource.createdAt,
        subjectCanonicalKey,
        exportProgramSlug: program?.slug ?? "(unknown)",
        exportTermOrder: term?.order ?? null,
      },
      original: {
        exportResourceId: resource.id,
        exportSubjectId: resource.subjectId,
        exportSubjectName: subject.name,
        exportTermName: term?.name ?? "(term not found in export)",
        exportProgramName: program?.name ?? "(program not found in export)",
        exportProgramSlug: program?.slug ?? "(unknown)",
        fileUrl: resource.fileUrl,
      },
      provenance: { sourceFile: EXPORT_FILE, sourceRowRef: rowRef },
    });
  }

  return {
    sourceName: "migration-export-resources",
    sourceFile: EXPORT_FILE,
    records,
    warnings,
  };
}
