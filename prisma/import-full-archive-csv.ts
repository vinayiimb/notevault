// One-shot CLI equivalent of Admin → Bulk Upload → Fresh Upload → validate →
// approve every VALID row → commit. Reuses the exact same functions the UI
// route calls (parseCsv, classifyBulkUploadRow, resolveRowForImport) so this
// is not a re-implementation — it's the identical import logic, run without
// a browser. Usage:
//
//   npx tsx prisma/import-full-archive-csv.ts <path-to-csv>
//
// Requires DATABASE_URL (and prisma migrate deploy already applied) in the
// environment it's run in — run this with production credentials only when
// you intend to write to production.
import { readFileSync } from "node:fs";
import { prisma } from "@/lib/prisma";
import { parseCsv } from "@/lib/csv";
import { classifyBulkUploadRow, resolveRowForImport } from "@/lib/bulk-upload";

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error("Usage: npx tsx prisma/import-full-archive-csv.ts <path-to-csv>");
    process.exit(1);
  }

  const text = readFileSync(csvPath, "utf-8");
  const rawRows = parseCsv(text);
  if (rawRows.length === 0) {
    console.error("No rows parsed from that file — check it has a header row.");
    process.exit(1);
  }
  console.log(`Parsed ${rawRows.length} rows from ${csvPath}`);

  const batch = await prisma.uploadBatch.create({
    data: { sourceFileName: csvPath.split("/").pop() },
  });
  console.log(`Created UploadBatch ${batch.id}`);

  let imported = 0;
  let duplicate = 0;
  let invalid = 0;

  for (let i = 0; i < rawRows.length; i++) {
    const rowNumber = i + 1;
    const classified = await classifyBulkUploadRow(rowNumber, rawRows[i]);

    const bulkUploadRow = await prisma.bulkUploadRow.create({
      data: {
        batchId: batch.id,
        rowNumber: classified.rowNumber,
        status: classified.status,
        message: classified.message,
        courseRaw: classified.courseRaw,
        subjectRaw: classified.subjectRaw,
        yearRangeRaw: classified.yearRangeRaw,
        semesterGroupRaw: classified.semesterGroupRaw,
        semesterRaw: classified.semesterRaw,
        fileUrlRaw: classified.fileUrlRaw,
        fileNameRaw: classified.fileNameRaw,
        noteRaw: classified.noteRaw,
      },
    });

    if (classified.status !== "VALID") {
      if (classified.status === "DUPLICATE") duplicate += 1;
      else invalid += 1;
      console.log(`Row ${rowNumber}: ${classified.status} — ${classified.message ?? ""}`);
      continue;
    }

    // Re-derive at commit time (mirrors commitBulkUploadBatchAction) in case
    // an earlier row in this same run just imported the same file.
    const resolved = resolveRowForImport({
      fileUrlRaw: classified.fileUrlRaw!,
      fileNameRaw: classified.fileNameRaw,
      semesterRaw: classified.semesterRaw,
    });

    const existing = await prisma.catalogPaperUpload.findUnique({ where: { fileHash: resolved.fileHash } });
    if (existing) {
      await prisma.bulkUploadRow.update({
        where: { id: bulkUploadRow.id },
        data: { status: "DUPLICATE", message: `Already in the catalog as "${existing.fileName}"` },
      });
      duplicate += 1;
      console.log(`Row ${rowNumber}: DUPLICATE — already in catalog as "${existing.fileName}"`);
      continue;
    }

    const catalogPaperUpload = await prisma.catalogPaperUpload.create({
      data: {
        course: classified.courseRaw,
        subject: classified.subjectRaw,
        yearRange: classified.yearRangeRaw!,
        semesterGroup: classified.semesterGroupRaw!,
        semester: resolved.semester,
        fileUrl: classified.fileUrlRaw!,
        fileName: resolved.fileName,
        fileSize: 0,
        fileHash: resolved.fileHash,
        note: classified.noteRaw,
      },
    });
    await prisma.bulkUploadRow.update({
      where: { id: bulkUploadRow.id },
      data: { status: "IMPORTED", catalogPaperUploadId: catalogPaperUpload.id },
    });
    imported += 1;
    console.log(`Row ${rowNumber}: IMPORTED — ${classified.courseRaw} / ${classified.subjectRaw}`);
  }

  console.log(`\nDone. Imported ${imported}, duplicate ${duplicate}, invalid ${invalid}, total ${rawRows.length}.`);
  console.log(`Batch id: ${batch.id} (visible under Admin → Bulk Upload → Uploaded Data)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
