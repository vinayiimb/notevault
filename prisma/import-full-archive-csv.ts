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
// Not importing prisma from @/lib/prisma — that module now starts with
// `import "server-only"`, which throws unconditionally outside a Next.js
// server-component build (exactly what this plain tsx script is). It also
// silently rewrites DATABASE_URL to a bogus localhost value if it doesn't
// look like a real postgres URL, as a safety net for the Next.js dev
// server — not something a CLI script importing real prod credentials
// wants. Talking to Prisma directly here sidesteps both.
import { PrismaClient } from "@/generated/prisma";
import { parseCsv } from "@/lib/csv";
import { classifyBulkUploadRow, resolveRowForImport, extractFileUrlRaw, bulkRowFileHash } from "@/lib/bulk-upload";

const prisma = new PrismaClient();

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

  // One batched dedupe query for the whole sheet instead of one per row.
  const candidateHashes = [...new Set(rawRows.map(extractFileUrlRaw).filter((u): u is string => !!u).map(bulkRowFileHash))];
  const existingRows =
    candidateHashes.length > 0
      ? await prisma.catalogPaperUpload.findMany({
          where: { fileHash: { in: candidateHashes } },
          select: { fileHash: true, fileName: true },
        })
      : [];
  const existingHashes = new Map(existingRows.map((r) => [r.fileHash, r.fileName]));

  let imported = 0;
  let duplicate = 0;
  let invalid = 0;

  let errored = 0;

  for (let i = 0; i < rawRows.length; i++) {
    const rowNumber = i + 1;
    // Each row gets its own try/catch — one bad row (a genuinely broken
    // fileUrl, an unexpected DB hiccup) shouldn't kill the whole run and
    // strand every row after it. This is what took the web UI's commit
    // loop down to 50/2701 imported before it got the same fix.
    try {
      const classified = classifyBulkUploadRow(rowNumber, rawRows[i], existingHashes);

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

      // Re-derive at commit time in case an earlier row in this same run
      // just imported the same file (existingHashes was computed once, up
      // front, before this loop started).
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
    } catch (err) {
      errored += 1;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Row ${rowNumber}: ERROR — ${message} (continuing to next row)`);
    }
  }

  console.log(
    `\nDone. Imported ${imported}, duplicate ${duplicate}, invalid ${invalid}, errored ${errored}, total ${rawRows.length}.`
  );
  console.log(`Batch id: ${batch.id} (visible under Admin → Bulk Upload → Uploaded Data)`);
  if (errored > 0) {
    console.log(`${errored} row(s) hit an unexpected error and were skipped — re-run this same command to retry just those (already-imported rows are skipped automatically via dedupe).`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
