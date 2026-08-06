export type ResourceRecord = {
  id: string;
  type: "NOTES" | "PYQ";
  fileUrl: string;
  fileName: string;
  fileSize: number;
  fileHash: string | null;
  year: number | null;
  programSlug: string;
  termOrder: number;
  subjectSlug: string;
};

export type FileOrigin = "already-r2-new-layout" | "legacy-r2" | "vercel-blob" | "local-path" | "unknown";

export type PlannedMigration = {
  resourceId: string;
  currentFileUrl: string;
  currentOrigin: FileOrigin;
  targetKey: string;
  targetBucket: "public";
  status: "to-migrate" | "already-migrated" | "duplicate-skip" | "missing-metadata";
  reason: string;
  duplicateOfResourceId: string | null;
};

export type MigrationManifest = {
  generatedAt: string;
  totalResources: number;
  toMigrate: number;
  alreadyMigrated: number;
  duplicateSkips: number;
  missingMetadata: number;
  entries: PlannedMigration[];
};

export type UploadAttemptResult = {
  resourceId: string;
  status: "uploaded" | "skipped-already-uploaded" | "failed";
  targetKey: string;
  checksumSha256?: string;
  error?: string;
  attemptedAt: string;
};

export type UploadStateFile = {
  updatedAt: string;
  completed: Record<string, UploadAttemptResult>; // resourceId -> result, for resumability
};
