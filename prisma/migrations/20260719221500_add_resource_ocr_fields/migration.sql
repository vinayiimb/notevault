ALTER TABLE "Resource"
ADD COLUMN "academicYear" TEXT,
ADD COLUMN "ocrText" TEXT,
ADD COLUMN "ocrTextHash" TEXT,
ADD COLUMN "sourceJsonName" TEXT,
ADD COLUMN "pageCount" INTEGER;

CREATE UNIQUE INDEX "Resource_sourceJsonName_key" ON "Resource"("sourceJsonName");
