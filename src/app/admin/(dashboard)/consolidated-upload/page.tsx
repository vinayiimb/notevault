import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ConsolidatedUploadClient } from "@/components/bulk-upload/consolidated-upload-client";

// A separate, purpose-built upload flow for zips that already come
// pre-organized as Semester_X/Subject/Year.pdf (e.g. a consolidated
// multi-year archive) — no filename matching or per-file subject picking
// needed, since the zip's own folder structure IS the metadata. Kept apart
// from the regular Bulk Upload tool, which is built around loose PDFs whose
// subject has to be guessed from the filename.
export default async function AdminConsolidatedUploadPage() {
  const programs = await prisma.program.findMany({
    orderBy: { name: "asc" },
    include: {
      terms: {
        orderBy: { order: "asc" },
        select: { id: true, name: true, order: true },
      },
    },
  });

  const data = programs.map((p) => ({
    id: p.id,
    name: p.name,
    terms: p.terms,
  }));

  const hashRows = await prisma.resource.findMany({
    where: { fileHash: { not: null } },
    select: { fileHash: true },
  });
  const existingHashes = hashRows.map((r) => r.fileHash as string);

  // Course matching memory improves future guesses, but it must never make
  // the upload tool unavailable. Older deployments may briefly serve this
  // code before the CourseMatchMemory migration has reached their database.
  const memoryRows = await prisma.courseMatchMemory
    .findMany({
      select: { key: true, programId: true },
    })
    .catch(() => []);
  const courseMemory = Object.fromEntries(memoryRows.map((r) => [r.key, r.programId]));

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Consolidated upload</h1>
        <Link href="/admin/resources" className="text-sm font-medium text-accent hover:underline">
          Browse uploaded PDFs →
        </Link>
      </div>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Add loose PDFs or ZIPs organized as <code className="rounded bg-surface-muted px-1 py-0.5 text-xs">Semester_I/Subject Name/2017-18.pdf</code>.
        NoteVault reads folder names, filenames, and available PDF text; AI can then match each
        paper to the real course, semester, subject, and academic year before upload.
      </p>
      <div className="mt-6">
        <ConsolidatedUploadClient programs={data} existingHashes={existingHashes} courseMemory={courseMemory} />
      </div>
    </div>
  );
}
