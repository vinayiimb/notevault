// Checkpoint G — file migration planner CLI.
//
// Modes:
//   plan     read-only: queries Resource rows, builds the deterministic-key
//            migration manifest, writes it to reports/storage-migration/.
//            Default mode. Always safe to run.
//   upload   reads the manifest + resumable upload-state file, uploads
//            "to-migrate" entries not already recorded as completed, and
//            only updates Resource.fileUrl in Postgres after a successful
//            upload. Requires --confirm AND a fully-configured R2 target
//            (isR2Configured()) — refuses otherwise, matching Checkpoint F's
//            "do not attempt a real upload" without valid staging credentials.
//   verify   read-only: re-reads the manifest and reports how many planned
//            migrations are actually reflected in the current database
//            state (fileUrl already rewritten to the target key or not).
//
// Usage: npx tsx scripts/storage-migration/run.ts --mode=plan
import { resolveImportTarget, describeTarget, TargetGuardError } from "../import/lib/target-guard";
import { getImportPrismaClient, disconnectImportPrismaClient } from "../import/lib/db-client";
import { isR2Configured } from "@/lib/storage/config";
import { uploadAsset } from "@/lib/storage/upload";
import { buildMigrationManifest } from "./lib/plan";
import { writeManifest, readManifest, readUploadState, writeUploadState } from "./lib/manifest";
import type { ResourceRecord, UploadAttemptResult } from "./lib/types";

function parseArgs(argv: string[]) {
  const mode = (argv.find((a) => a.startsWith("--mode="))?.split("=")[1] ?? "plan") as "plan" | "upload" | "verify";
  const confirm = argv.includes("--confirm");
  return { mode, confirm };
}

async function fetchResourceRecords(prisma: ReturnType<typeof getImportPrismaClient>["client"]): Promise<ResourceRecord[]> {
  const rows = await prisma.resource.findMany({
    select: {
      id: true, type: true, fileUrl: true, fileName: true, fileSize: true, fileHash: true, year: true,
      subject: { select: { slug: true, term: { select: { order: true, program: { select: { slug: true } } } } } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    fileUrl: r.fileUrl,
    fileName: r.fileName,
    fileSize: r.fileSize,
    fileHash: r.fileHash,
    year: r.year,
    programSlug: r.subject.term.program.slug,
    termOrder: r.subject.term.order,
    subjectSlug: r.subject.slug,
  }));
}

async function runPlan() {
  const target = resolveImportTarget();
  console.log(`[target] ${describeTarget(target)} mode=plan`);
  const { client: prisma } = getImportPrismaClient();
  const resources = await fetchResourceRecords(prisma);
  await disconnectImportPrismaClient();

  const manifest = buildMigrationManifest(resources);
  const path = await writeManifest(manifest);

  console.log(`\nResources scanned: ${manifest.totalResources}`);
  console.log(`  to-migrate:       ${manifest.toMigrate}`);
  console.log(`  already-migrated: ${manifest.alreadyMigrated}`);
  console.log(`  duplicate-skip:   ${manifest.duplicateSkips}`);
  console.log(`  missing-metadata: ${manifest.missingMetadata}`);
  console.log(`\nManifest written to ${path}`);
}

async function runVerify() {
  const target = resolveImportTarget();
  console.log(`[target] ${describeTarget(target)} mode=verify`);
  const manifest = await readManifest().catch(() => null);
  if (!manifest) {
    console.error("No manifest found — run --mode=plan first.");
    process.exitCode = 1;
    return;
  }

  const { client: prisma } = getImportPrismaClient();
  const currentUrls = await prisma.resource.findMany({ select: { id: true, fileUrl: true } });
  await disconnectImportPrismaClient();
  const currentUrlById = new Map(currentUrls.map((r) => [r.id, r.fileUrl]));

  let migratedInDb = 0;
  let stillPending = 0;
  for (const entry of manifest.entries) {
    if (entry.status !== "to-migrate") continue;
    const current = currentUrlById.get(entry.resourceId);
    if (current && current.replace(/^\//, "") === entry.targetKey) migratedInDb++;
    else stillPending++;
  }

  console.log(`\nPlanned migrations: ${manifest.toMigrate}`);
  console.log(`  reflected in DB (fileUrl already rewritten): ${migratedInDb}`);
  console.log(`  still pending:                                ${stillPending}`);
}

async function runUpload(confirm: boolean) {
  const target = resolveImportTarget();
  console.log(`[target] ${describeTarget(target)} mode=upload`);

  if (!confirm) {
    console.error("upload mode requires --confirm.");
    process.exitCode = 1;
    return;
  }
  if (!isR2Configured()) {
    console.error(
      "R2 is not configured (R2_PUBLIC_BUCKET/R2_PRIVATE_BUCKET/R2_PUBLIC_BASE_URL missing) — " +
        "refusing to run. See docs/PHASE_2F_R2_STORAGE_MIGRATION.md's manual setup steps. " +
        "This is expected until a distinct staging R2 bucket is provisioned.",
    );
    process.exitCode = 1;
    return;
  }

  const manifest = await readManifest().catch(() => null);
  if (!manifest) {
    console.error("No manifest found — run --mode=plan first.");
    process.exitCode = 1;
    return;
  }

  const state = await readUploadState();
  const { client: prisma } = getImportPrismaClient();

  const toProcess = manifest.entries.filter((e) => e.status === "to-migrate" && state.completed[e.resourceId]?.status !== "uploaded");
  console.log(`\n${toProcess.length} resource(s) to upload (${Object.keys(state.completed).length} already recorded from a prior run).`);

  for (const entry of toProcess) {
    const attemptedAt = new Date().toISOString();
    try {
      const res = await fetch(entry.currentFileUrl);
      if (!res.ok) throw new Error(`fetch ${entry.currentFileUrl}: ${res.status} ${res.statusText}`);
      const bytes = new Uint8Array(await res.arrayBuffer());

      const [category, ...rest] = entry.targetKey.split("/");
      const fileName = rest[rest.length - 1];
      const pathSegments = rest.slice(0, -1);
      const uploadResult = await uploadAsset({
        category: category as "papers" | "syllabus-files",
        pathSegments,
        fileName,
        bytes,
        contentType: "application/pdf",
      });

      // Postgres is only touched after a confirmed-successful upload —
      // never speculatively, and never for a skipped/failed entry.
      await prisma.resource.update({ where: { id: entry.resourceId }, data: { fileUrl: `/${uploadResult.key}` } });

      const result: UploadAttemptResult = {
        resourceId: entry.resourceId, status: "uploaded", targetKey: uploadResult.key,
        checksumSha256: uploadResult.checksumSha256, attemptedAt,
      };
      state.completed[entry.resourceId] = result;
      console.log(`  uploaded: ${entry.resourceId} -> ${uploadResult.key}`);
    } catch (err) {
      const result: UploadAttemptResult = {
        resourceId: entry.resourceId, status: "failed", targetKey: entry.targetKey,
        error: err instanceof Error ? err.message : String(err), attemptedAt,
      };
      state.completed[entry.resourceId] = result;
      console.error(`  FAILED: ${entry.resourceId}: ${result.error}`);
    }
    state.updatedAt = new Date().toISOString();
    await writeUploadState(state); // persisted after every single item — resumable if interrupted
  }

  await disconnectImportPrismaClient();
  const failed = Object.values(state.completed).filter((r) => r.status === "failed").length;
  const uploaded = Object.values(state.completed).filter((r) => r.status === "uploaded").length;
  console.log(`\nDone. uploaded=${uploaded} failed=${failed}. Failed entries stay in upload-state.json for the next --mode=upload run to retry.`);
}

async function main() {
  const { mode, confirm } = parseArgs(process.argv.slice(2));
  try {
    if (mode === "plan") await runPlan();
    else if (mode === "verify") await runVerify();
    else if (mode === "upload") await runUpload(confirm);
    else {
      console.error(`Unknown mode: ${mode}`);
      process.exitCode = 1;
    }
  } catch (err) {
    if (err instanceof TargetGuardError) {
      console.error(`[target-guard] ${err.message}`);
      process.exitCode = 1;
      return;
    }
    throw err;
  }
}

main();
