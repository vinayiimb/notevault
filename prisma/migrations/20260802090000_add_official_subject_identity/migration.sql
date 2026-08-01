-- Canonical syllabus identity used by every upload/import path.
ALTER TABLE "Subject"
ADD COLUMN "upc" TEXT,
ADD COLUMN "paperType" TEXT,
ADD COLUMN "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "Subject_upc_idx" ON "Subject"("upc");
