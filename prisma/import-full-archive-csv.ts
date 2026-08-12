// One-shot CLI equivalent of Admin → Bulk Upload → Fresh Upload → validate →
// approve every VALID row → commit. Reuses the exact same functions the UI
// route calls (parseCsv, classifyBulkUploadRow, resolveRowForImport) so this
// is not a re-implementation — it's the identical import logic, run without
// a browser. Usage:
//
//   npx tsx prisma/import-full-archive-csv.ts <path-to-csv> [--dry-run]
//
// Requires DATABASE_URL (and prisma migrate deploy already applied) in the
// environment it's run in — run this with production credentials only when
// you intend to write to production.
//
// Batched for bulk-import speed (13k+ rows): classification, intra-CSV
// dedupe, and the pre-existing-in-DB dedupe are all resolved in memory in a
// single pass over the parsed rows (classifyBulkUploadRow is pure — no DB
// access), then writes go out as chunked createMany calls run with bounded
// concurrency instead of one round trip per row. See resolveRowsForImport
// below for how the original per-row "re-derive at commit time" duplicate
// check (a `findUnique` per VALID row) is replicated without hitting the DB.
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
// Not importing prisma from @/lib/prisma — that module now starts with
// `import "server-only"`, which throws unconditionally outside a Next.js
// server-component build (exactly what this plain tsx script is). It also
// silently rewrites DATABASE_URL to a bogus localhost value if it doesn't
// look like a real postgres URL, as a safety net for the Next.js dev
// server — not something a CLI script importing real prod credentials
// wants. Talking to Prisma directly here sidesteps both.
import { PrismaClient, type BulkUploadRowStatus } from "@/generated/prisma";
import { parseCsv } from "@/lib/csv";
import { classifyBulkUploadRow, resolveRowForImport, extractFileUrlRaw, bulkRowFileHash, type ClassifiedRow } from "@/lib/bulk-upload";

const prisma = new PrismaClient();

// Bulk network round trips (Supabase pooler) dominate wall time far more
// than row count does — batching rows per query and overlapping a handful
// of those queries is what turns hours into minutes.
const CHUNK_SIZE = 500;
const CONCURRENCY = 10;

// Runs `items` through `fn` in chunks of `chunkSize`, with up to
// `concurrency` chunks in flight at once — bounded concurrency instead of
// either fully sequential (slow) or one unbounded Promise.all over
// everything (risks overwhelming the connection pool).
async function runChunked<T, R>(
  items: T[],
  chunkSize: number,
  concurrency: number,
  fn: (chunk: T[], chunkIndex: number) => Promise<R>
): Promise<R[]> {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) chunks.push(items.slice(i, i + chunkSize));

  const results: R[] = new Array(chunks.length);
  let next = 0;
  async function worker() {
    while (next < chunks.length) {
      const idx = next++;
      results[idx] = await fn(chunks[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, chunks.length) }, worker));
  return results;
}

type FinalRow = ClassifiedRow & {
  // Assigned up front so BulkUploadRow and CatalogPaperUpload can both
  // reference it without a round trip back for the generated id.
  catalogPaperUploadId: string | null;
};

// Classifies every row and resolves duplicates exactly as the original
// sequential loop did — including the "a row later in this same CSV points
// at a file already imported earlier in this same run" case, which the
// original code only caught because it re-queried `catalogPaperUpload`
// per VALID row right before inserting. Since classifyBulkUploadRow and
// resolveRowForImport are both pure (no DB access), that whole sequence is
// deterministic given `existingHashes`, so it can be replayed here as a
// single in-memory pass — same result, zero per-row queries.
function resolveRowsForImport(rawRows: Record<string, string>[], existingHashes: ReadonlyMap<string, string>): FinalRow[] {
  // fileHash -> fileName, seeded from the DB and extended as we "import"
  // rows in order — mirrors what the per-row findUnique would have seen at
  // that point in the original sequential run.
  const claimed = new Map(existingHashes);
  const finalRows: FinalRow[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const rowNumber = i + 1;
    const classified = classifyBulkUploadRow(rowNumber, rawRows[i], existingHashes);

    if (classified.status !== "VALID") {
      finalRows.push({ ...classified, catalogPaperUploadId: null });
      continue;
    }

    const resolved = resolveRowForImport({
      fileUrlRaw: classified.fileUrlRaw!,
      fileNameRaw: classified.fileNameRaw,
      semesterRaw: classified.semesterRaw,
    });

    const claimedBy = claimed.get(resolved.fileHash);
    if (claimedBy !== undefined) {
      finalRows.push({
        ...classified,
        status: "DUPLICATE",
        message: `Already in the catalog as "${claimedBy}"`,
        resolved: null,
        catalogPaperUploadId: null,
      });
      continue;
    }

    claimed.set(resolved.fileHash, resolved.fileName);
    finalRows.push({ ...classified, resolved, catalogPaperUploadId: randomUUID() });
  }

  return finalRows;
}

type Counts = { imported: number; duplicate: number; invalid: number; errored: number };

function logProgress(processed: number, total: number, counts: Counts) {
  console.log(`Processed ${processed}/${total} | Imported ${counts.imported} | Existing ${counts.duplicate} | Failed ${counts.errored}`);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const csvPath = args.find((a) => !a.startsWith("--"));
  if (!csvPath) {
    console.error("Usage: npx tsx prisma/import-full-archive-csv.ts <path-to-csv> [--dry-run]");
    process.exit(1);
  }

  const text = readFileSync(csvPath, "utf-8");
  const rawRows = parseCsv(text);
  if (rawRows.length === 0) {
    console.error("No rows parsed from that file — check it has a header row.");
    process.exit(1);
  }
  console.log(`Parsed ${rawRows.length} rows from ${csvPath}`);

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

  const finalRows = resolveRowsForImport(rawRows, existingHashes);

  const toImport = finalRows.filter((r) => r.status === "VALID" && r.resolved);
  const alreadyDuplicate = finalRows.filter((r) => r.status === "DUPLICATE");
  const invalidRows = finalRows.filter((r) => r.status === "INVALID");

  if (dryRun) {
    // Of the DUPLICATE rows, how many were already in the DB before this
    // run started vs. only became a duplicate because an earlier row in
    // this same CSV claimed the same fileHash first.
    const dupAgainstDb = alreadyDuplicate.filter((r) => {
      const hash = r.fileUrlRaw ? bulkRowFileHash(r.fileUrlRaw) : null;
      return hash ? existingHashes.has(hash) : false;
    }).length;
    const dupWithinCsv = alreadyDuplicate.length - dupAgainstDb;

    console.log("\n--- DRY RUN — no writes performed ---");
    console.log(`Total CSV rows:              ${rawRows.length}`);
    console.log(`Already existing in DB:      ${dupAgainstDb}`);
    console.log(`Duplicates within this CSV:  ${dupWithinCsv}`);
    console.log(`Invalid (missing fields):    ${invalidRows.length}`);
    console.log(`Estimated new inserts:       ${toImport.length}`);
    return;
  }

  const batch = await prisma.uploadBatch.create({
    data: { sourceFileName: csvPath.split("/").pop() },
  });
  console.log(`Created UploadBatch ${batch.id}`);

  const counts: Counts = { imported: 0, duplicate: 0, invalid: 0, errored: 0 };
  const failures: { rowNumber: number; message: string }[] = [];

  // 1) Bulk-insert CatalogPaperUpload for every row resolved as an import
  // candidate. IDs are generated client-side (randomUUID, above) so no
  // round trip is needed afterward to learn what was created — the id is
  // already known and gets embedded straight into the BulkUploadRow batch
  // below. skipDuplicates guards only against a genuine race with another
  // writer hitting the same fileHash concurrently (our own in-memory
  // dedupe already prevents intra-CSV collisions from reaching here).
  const createdHashes = new Set<string>();
  if (toImport.length > 0) {
    await runChunked(toImport, CHUNK_SIZE, CONCURRENCY, async (chunk) => {
      try {
        const created = await prisma.catalogPaperUpload.createManyAndReturn({
          data: chunk.map((r) => ({
            id: r.catalogPaperUploadId!,
            course: r.courseRaw,
            subject: r.subjectRaw,
            yearRange: r.yearRangeRaw!,
            semesterGroup: r.semesterGroupRaw!,
            semester: r.resolved!.semester,
            fileUrl: r.fileUrlRaw!,
            fileName: r.resolved!.fileName,
            fileSize: 0,
            fileHash: r.resolved!.fileHash,
            note: r.noteRaw,
          })),
          skipDuplicates: true,
          select: { fileHash: true },
        });
        for (const row of created) createdHashes.add(row.fileHash);
      } catch (err) {
        // Whole chunk failed for a non-duplicate reason (bad data on one
        // row, etc) — fall back to per-row inserts so one bad row in a
        // 500-row chunk doesn't take the other 499 down with it.
        for (const r of chunk) {
          try {
            await prisma.catalogPaperUpload.create({
              data: {
                id: r.catalogPaperUploadId!,
                course: r.courseRaw,
                subject: r.subjectRaw,
                yearRange: r.yearRangeRaw!,
                semesterGroup: r.semesterGroupRaw!,
                semester: r.resolved!.semester,
                fileUrl: r.fileUrlRaw!,
                fileName: r.resolved!.fileName,
                fileSize: 0,
                fileHash: r.resolved!.fileHash,
                note: r.noteRaw,
              },
            });
            createdHashes.add(r.resolved!.fileHash);
          } catch (rowErr) {
            const message = rowErr instanceof Error ? rowErr.message : String(rowErr);
            failures.push({ rowNumber: r.rowNumber, message });
            console.error(`Row ${r.rowNumber}: ERROR — ${message} (continuing to next row)`);
          }
        }
      }
    });
  }

  // Any import candidate whose fileHash didn't come back from the insert
  // above lost a race to a concurrent writer — flip it to DUPLICATE against
  // whatever's now in the DB, same as the original per-row findUnique path.
  const raceLosers = toImport.filter((r) => r.resolved && !createdHashes.has(r.resolved.fileHash) && !failures.some((f) => f.rowNumber === r.rowNumber));
  const raceLoserHashes = raceLosers.map((r) => r.resolved!.fileHash);
  const raceWinners =
    raceLoserHashes.length > 0
      ? await prisma.catalogPaperUpload.findMany({ where: { fileHash: { in: raceLoserHashes } }, select: { fileHash: true, fileName: true } })
      : [];
  const raceWinnerByHash = new Map(raceWinners.map((r) => [r.fileHash, r.fileName]));

  for (const r of finalRows) {
    if (r.status !== "VALID" || !r.resolved || failures.some((f) => f.rowNumber === r.rowNumber)) continue;
    if (createdHashes.has(r.resolved.fileHash)) {
      // Actually inserted above — flip from the interim "VALID" to the
      // terminal status, same as the original's second bulkUploadRow.update.
      r.status = "IMPORTED" as BulkUploadRowStatus;
    } else {
      const existingFileName = raceWinnerByHash.get(r.resolved.fileHash) ?? "another row in this run";
      r.status = "DUPLICATE" as BulkUploadRowStatus;
      r.message = `Already in the catalog as "${existingFileName}"`;
      r.catalogPaperUploadId = null;
    }
  }

  // 2) Bulk-insert BulkUploadRow (the audit trail) for every row, whatever
  // its final status — same as the original writing one per row, just
  // batched. catalogPaperUploadId is already resolved from step 1.
  const rowsToInsert = finalRows.filter((r) => !failures.some((f) => f.rowNumber === r.rowNumber));
  let processed = 0;
  await runChunked(rowsToInsert, CHUNK_SIZE, CONCURRENCY, async (chunk) => {
    const data = chunk.map((r) => ({
      batchId: batch.id,
      rowNumber: r.rowNumber,
      status: r.status,
      message: r.message,
      courseRaw: r.courseRaw,
      subjectRaw: r.subjectRaw,
      yearRangeRaw: r.yearRangeRaw,
      semesterGroupRaw: r.semesterGroupRaw,
      semesterRaw: r.semesterRaw,
      fileUrlRaw: r.fileUrlRaw,
      fileNameRaw: r.fileNameRaw,
      noteRaw: r.noteRaw,
      catalogPaperUploadId: r.catalogPaperUploadId,
    }));
    try {
      await prisma.bulkUploadRow.createMany({ data, skipDuplicates: true });
    } catch (err) {
      // Isolate the bad row(s) in this chunk instead of losing the whole
      // chunk's worth of audit-trail rows.
      for (const row of data) {
        try {
          await prisma.bulkUploadRow.create({ data: row });
        } catch (rowErr) {
          const message = rowErr instanceof Error ? rowErr.message : String(rowErr);
          failures.push({ rowNumber: row.rowNumber, message });
          console.error(`Row ${row.rowNumber}: ERROR — ${message} (continuing to next row)`);
        }
      }
    }
  });

  for (const r of finalRows) {
    if (failures.some((f) => f.rowNumber === r.rowNumber)) {
      counts.errored += 1;
      continue;
    }
    if (r.status === "IMPORTED") counts.imported += 1;
    else if (r.status === "DUPLICATE") counts.duplicate += 1;
    else counts.invalid += 1;

    processed += 1;
    if (processed % 500 === 0) logProgress(processed, finalRows.length, counts);
  }
  if (finalRows.length % 500 !== 0) logProgress(finalRows.length, finalRows.length, counts);

  console.log(
    `\nDone. Imported ${counts.imported}, duplicate ${counts.duplicate}, invalid ${counts.invalid}, errored ${counts.errored}, total ${rawRows.length}.`
  );
  console.log(`Batch id: ${batch.id} (visible under Admin → Bulk Upload → Uploaded Data)`);
  if (failures.length > 0) {
    console.log(`\n${failures.length} row(s) hit an unexpected error and were skipped — re-run this same command to retry just those (already-imported rows are skipped automatically via dedupe).`);
    for (const f of failures) console.log(`  Row ${f.rowNumber}: ${f.message}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
