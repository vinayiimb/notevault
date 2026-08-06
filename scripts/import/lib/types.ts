// Shared types for every source adapter (scripts/import/sources/*) and the
// orchestrator (scripts/import/run.ts).

export type SourceModel = "Program" | "Term" | "Subject" | "ExamSession" | "SessionProgramLink";

/** One row a source adapter wants to write, before validation/dedup/FK resolution. */
export type PlannedRecord = {
  model: SourceModel;
  /** Stable natural key used for dedup/existing-row lookup, e.g. a Program slug
   * or "programSlug::order" for a Term. Never a random id — must be
   * deterministic so reruns are idempotent. */
  naturalKey: string;
  /** The actual field values this record would be created with. */
  data: Record<string, unknown>;
  /** Where this came from, for the rejected/warnings reports. */
  provenance: { sourceFile: string; sourceRowRef: string };
  /** Original, un-normalized values worth preserving alongside the cleaned
   * ones (Phase 2C item 4: "preserve original values in source/original
   * fields"). */
  original: Record<string, string>;
};

export type RowOutcome =
  | { status: "insert"; record: PlannedRecord }
  | { status: "skip_existing"; record: PlannedRecord; reason: string }
  | { status: "rejected"; record: PlannedRecord; issues: string[] }
  | { status: "unresolved_fk"; record: PlannedRecord; missingParent: string };

export type WarningEntry = {
  sourceFile: string;
  sourceRowRef: string;
  model: SourceModel;
  field: string;
  message: string;
};

export type SourceAdapterResult = {
  sourceName: string;
  sourceFile: string;
  records: PlannedRecord[];
  warnings: WarningEntry[];
};
