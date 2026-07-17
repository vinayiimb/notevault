// One-time migration: moves everything currently sitting in the local
// SQLite dev.db + public/uploads + public/images onto a hosted Postgres
// database + Vercel Blob store, so a Vercel deploy starts with real data
// and real files instead of an empty database.
//
// Usage:
//
//   1. Right now, while prisma/schema.prisma still says
//      `provider = "sqlite"` and DATABASE_URL still points at the local
//      dev.db, run:
//
//        npx tsx prisma/migrate-to-postgres-blob.ts export
//
//      This is read-only — it writes prisma/migration-export.json (already
//      gitignored: it contains the admin password hash).
//
//   2. Provision a Postgres database (Vercel Postgres, via the Vercel
//      dashboard's Storage tab, is the simplest) and a Vercel Blob store
//      (same Storage tab). Then:
//        - In prisma/schema.prisma, change `provider = "sqlite"` to
//          `provider = "postgresql"` under `datasource db`.
//        - Set DATABASE_URL in .env.local to the new Postgres connection
//          string.
//        - Set BLOB_READ_WRITE_TOKEN in .env.local to the new Blob store's
//          token.
//        - Run `npx prisma migrate dev --name init_postgres` to create the
//          (empty) tables on the new Postgres database.
//
//   3. Run:
//
//        npx tsx prisma/migrate-to-postgres-blob.ts import
//
//      This uploads every local file (PDFs, hero image, currency icon) to
//      Blob and inserts every row into the new Postgres database, keeping
//      the original ids so foreign keys still line up.
//
// Safe to re-run `export` any time before step 2. `import` is NOT
// idempotent — it always inserts fresh rows, so only run it once against
// an empty new database.

import path from "path";
import { readFile as readLocalFile, writeFile } from "fs/promises";
import { PrismaClient } from "../src/generated/prisma";

const EXPORT_PATH = path.join(process.cwd(), "prisma", "migration-export.json");

// JSON.parse doesn't know DateTime fields should become Date objects —
// Prisma's create() rejects raw ISO strings for those fields — so revive
// anything that looks like an ISO-8601 timestamp.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
function reviveDates(_key: string, value: unknown) {
  return typeof value === "string" && ISO_DATE.test(value) ? new Date(value) : value;
}

async function runExport() {
  const prisma = new PrismaClient();
  const data = {
    programs: await prisma.program.findMany(),
    terms: await prisma.term.findMany(),
    subjects: await prisma.subject.findMany(),
    subjectAnalyses: await prisma.subjectAnalysis.findMany(),
    uploadBatches: await prisma.uploadBatch.findMany(),
    resources: await prisma.resource.findMany(),
    failedUploads: await prisma.failedUpload.findMany(),
    questions: await prisma.question.findMany(),
    siteSettings: await prisma.siteSettings.findMany(),
    admins: await prisma.admin.findMany(),
    subjectMatchMemories: await prisma.subjectMatchMemory.findMany(),
    students: await prisma.student.findMany(),
    orangeEvents: await prisma.orangeEvent.findMany(),
  };
  await writeFile(EXPORT_PATH, JSON.stringify(data, null, 2));
  const total = Object.values(data).reduce((n, arr) => n + arr.length, 0);
  console.log(`Exported ${total} rows across ${Object.keys(data).length} tables to ${EXPORT_PATH}`);
  for (const [table, rows] of Object.entries(data)) {
    console.log(`  ${table}: ${rows.length}`);
  }
  await prisma.$disconnect();
}

async function runImport() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN is not set. Set it to your new Vercel Blob store's token before running import."
    );
  }
  const raw = await readLocalFile(EXPORT_PATH, "utf-8");
  const data = JSON.parse(raw, reviveDates);

  // Import must run against the NEW database — this only matters once
  // schema.prisma's datasource has been switched to postgresql and
  // DATABASE_URL points at it (step 2 above).
  const prisma = new PrismaClient();
  const { putBytes } = await import("../src/lib/storage");

  // Local paths look like "/uploads/pyqs/<uuid>-file.pdf" or
  // "/images/hero-du.jpg" — already-external (https) or empty urls pass
  // through untouched (covers re-running against partially-migrated data).
  async function migrateFileUrl(fileUrl: string | null | undefined): Promise<string | null> {
    if (!fileUrl) return fileUrl ?? null;
    if (/^https?:\/\//.test(fileUrl)) return fileUrl;
    const bytes = Buffer.from(
      await readLocalFile(path.join(process.cwd(), "public", fileUrl))
    );
    return putBytes(fileUrl.replace(/^\//, ""), bytes);
  }

  console.log(`Programs (${data.programs.length})...`);
  for (const p of data.programs) await prisma.program.create({ data: p });

  console.log(`Terms (${data.terms.length})...`);
  for (const t of data.terms) await prisma.term.create({ data: t });

  console.log(`Subjects (${data.subjects.length})...`);
  for (const s of data.subjects) await prisma.subject.create({ data: s });

  console.log(`Upload batches (${data.uploadBatches.length})...`);
  for (const b of data.uploadBatches) await prisma.uploadBatch.create({ data: b });

  console.log(`Resources (${data.resources.length}, uploading each file to Blob)...`);
  for (const r of data.resources) {
    const fileUrl = await migrateFileUrl(r.fileUrl);
    await prisma.resource.create({ data: { ...r, fileUrl } });
  }

  console.log(`Failed uploads (${data.failedUploads.length})...`);
  for (const f of data.failedUploads) {
    const fileUrl = await migrateFileUrl(f.fileUrl);
    await prisma.failedUpload.create({ data: { ...f, fileUrl } });
  }

  console.log(`Subject analyses (${data.subjectAnalyses.length})...`);
  for (const a of data.subjectAnalyses) await prisma.subjectAnalysis.create({ data: a });

  console.log(`Questions (${data.questions.length})...`);
  for (const q of data.questions) await prisma.question.create({ data: q });

  console.log(`Site settings (${data.siteSettings.length})...`);
  for (const s of data.siteSettings) {
    const heroImageUrl = await migrateFileUrl(s.heroImageUrl);
    const currencyIconUrl = await migrateFileUrl(s.currencyIconUrl);
    await prisma.siteSettings.create({ data: { ...s, heroImageUrl, currencyIconUrl } });
  }

  console.log(`Admins (${data.admins.length})...`);
  for (const a of data.admins) await prisma.admin.create({ data: a });

  console.log(`Subject match memories (${data.subjectMatchMemories.length})...`);
  for (const m of data.subjectMatchMemories) await prisma.subjectMatchMemory.create({ data: m });

  console.log(`Students (${data.students.length})...`);
  for (const s of data.students) await prisma.student.create({ data: s });

  console.log(`Orange events (${data.orangeEvents.length})...`);
  for (const e of data.orangeEvents) await prisma.orangeEvent.create({ data: e });

  console.log("Done. Every row now lives in the new Postgres database, and every file now lives in Blob.");
  await prisma.$disconnect();
}

const mode = process.argv[2];
if (mode === "export") runExport();
else if (mode === "import") runImport();
else {
  console.log("Usage: npx tsx prisma/migrate-to-postgres-blob.ts <export|import>");
  process.exit(1);
}
