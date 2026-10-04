-- AlterTable
ALTER TABLE "CatalogPaperOverride" ADD COLUMN     "course" TEXT,
ADD COLUMN     "subject" TEXT,
ADD COLUMN     "semester" TEXT,
ADD COLUMN     "yearRange" TEXT,
ADD COLUMN     "upc" TEXT,
ADD COLUMN     "paperType" TEXT,
ADD COLUMN     "verified" BOOLEAN,
ADD COLUMN     "added" BOOLEAN NOT NULL DEFAULT false;
