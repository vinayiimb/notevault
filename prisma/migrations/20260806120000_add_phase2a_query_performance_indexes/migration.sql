-- Phase 2A infrastructure-migration indexes (docs/PHASE_2_QUERY_REMEDIATION.md).
-- Not applied to any database by this change — see that doc for how/when to
-- run `prisma migrate deploy` against a real environment.

-- CreateIndex
-- Resource.subjectId had no index at all; almost every real query on this
-- table also filters `type` ("PYQ" | "NOTES") in the same WHERE.
CREATE INDEX "Resource_subjectId_type_idx" ON "Resource"("subjectId", "type");

-- CreateIndex
-- Backs getRecentResources (orderBy createdAt desc, take 6) and
-- getResourceHighlights (orderBy createdAt desc per type).
CREATE INDEX "Resource_createdAt_idx" ON "Resource"("createdAt");

-- CreateIndex
-- Question.subjectId had no index at all; isRepeated is the other column
-- every real query here filters or orders by.
CREATE INDEX "Question_subjectId_isRepeated_idx" ON "Question"("subjectId", "isRepeated");

-- CreateIndex
-- Backs the new program+subject-name scoped archive lookups added in
-- Phase 2A (getFullDriveArchiveIndex/getUnifiedPyqArchive scope, and
-- /api/catalog-combined-pdf's course-scoped fetch).
CREATE INDEX "DriveSubject_programId_name_idx" ON "DriveSubject"("programId", "name");
