import { prisma } from "@/lib/prisma";
import { FolderUploadClient } from "@/components/bulk-upload/folder-upload-client";

// A drop-everything upload flow: drag in whole folder trees (nested any
// depth, semester/course/year in any order) plus loose PDFs, mixed
// together, no zip step required. Semester, course folder, and year are
// auto-detected from each file's path and editable per row when detection
// misses. Kept apart from Bulk Upload (loose files, filename matching) and
// Consolidated Upload (zip-only) — neither is touched by this.
export default async function AdminFolderUploadPage() {
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

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Folder upload</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Drag in any number of folders and loose PDFs at once — no zipping required. Semester, course,
        and year are guessed from each file&apos;s folder path (in any order, any depth) and shown
        below for you to fix up before uploading.
      </p>
      <div className="mt-6">
        <FolderUploadClient programs={data} existingHashes={existingHashes} />
      </div>
    </div>
  );
}
