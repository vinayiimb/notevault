import type { Metadata } from "next";
import { BookOpenText } from "@phosphor-icons/react/dist/ssr";
import { connection } from "next/server";
import { CatalogArchiveBrowser } from "@/components/archive/catalog-archive-browser";
import {
  catalogIntegrity,
  getUnifiedPyqArchive,
} from "@/lib/pyq-catalog";

export const metadata: Metadata = {
  title: "Complete PYQ Archive",
  description:
    "Browse the complete Delhi University previous year question paper archive — every course, semester, and subject in one searchable library.",
  alternates: { canonical: "/pyq-notes" },
};

export default async function PyqNotesArchivePage() {
  await connection();
  const papers = await getUnifiedPyqArchive();
  const courseCount = new Set(papers.map((paper) => paper.course)).size;
  const uploadCount = papers.filter((paper) => paper.source === "upload").length;
  const driveCount = papers.filter((paper) => paper.source === "drive").length;
  const existingNoteVaultCount = papers.filter((paper) => paper.source === "notevault").length;
  const officialMatchCount = papers.filter((paper) => Boolean(paper.originalSubject)).length;
  const reviewCount = papers.length - officialMatchCount;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="max-w-3xl">
        <p className="flex items-center gap-2 text-sm font-medium text-accent">
          <BookOpenText size={18} weight="bold" /> Full archive
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          Every paper and study file on the site.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
          Browse the complete Ramanujan College library catalog, DU PYQ Online&apos;s read-online
          papers, and course-organized Google Drive study collections.
        </p>
      </div>

      <div className="mt-8 flex flex-wrap gap-3 text-sm text-muted">
        <span className="rounded-full bg-accent-soft px-3 py-1.5 font-medium text-accent">
          {papers.length} files total
        </span>
        <span className="rounded-full bg-surface-muted px-3 py-1.5">
          {courseCount} course categories
        </span>
        <span className="rounded-full bg-success-soft px-3 py-1.5 text-success">
          {officialMatchCount} official subject matches
        </span>
        <span className="rounded-full bg-yellow-soft px-3 py-1.5 text-warning">
          {reviewCount} original labels pending review
        </span>
        <span className="rounded-full bg-surface-muted px-3 py-1.5">
          {catalogIntegrity.sourceRows} official-library links
        </span>
        <span className="rounded-full bg-surface-muted px-3 py-1.5">
          {driveCount} Google Drive file{driveCount === 1 ? "" : "s"}
        </span>
        {existingNoteVaultCount > 0 ? (
          <span className="rounded-full bg-surface-muted px-3 py-1.5">
            {existingNoteVaultCount} read-online paper{existingNoteVaultCount === 1 ? "" : "s"}
          </span>
        ) : null}
        <span className="rounded-full bg-surface-muted px-3 py-1.5">
          {catalogIntegrity.duplicateSessionGroups} multi-file sessions
        </span>
        {uploadCount > 0 ? (
          <span className="rounded-full bg-success-soft px-3 py-1.5 text-success">
            {uploadCount} admin upload{uploadCount === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      <CatalogArchiveBrowser papers={papers} />
    </div>
  );
}
