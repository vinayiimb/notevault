// Re-derives every DriveSubject grouping from the DriveFileMatch rows
// already stored in the DB (filenames + program), using the current
// (corrected) matching logic in subject-quality.ts — no Google Drive API
// calls needed, since we already have every file's name. This exists
// because matchDriveSubjectName used to conflate "Introductory
// Microeconomics" with "Introductory Macroeconomics" (a short edit
// distance, opposite subjects) across several programs; after fixing that
// matcher (see hasOpposingTerm), this re-groups every program's files with
// the fixed logic and only creates a new DriveSubject / moves files where
// the grouping actually changes — a subject whose files already agree with
// the fixed logic is left untouched (same id, same slug).
// Safe to re-run: idempotent, decides purely from current filenames each time.
import { config } from "dotenv";
import path from "path";
config({ path: path.join(process.cwd(), ".env.local") });
config({ path: path.join(process.cwd(), ".env") });

import { PrismaClient } from "../src/generated/prisma";
import { deriveSubjectNameFromFilename, matchDriveSubjectName } from "../src/lib/subject-quality";

function scriptDatabaseUrl() {
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error("DATABASE_URL is not set.");
  const url = new URL(base);
  url.searchParams.set("connection_limit", "2");
  url.searchParams.set("pool_timeout", "30");
  return url.toString();
}

const prisma = new PrismaClient({ datasources: { db: { url: scriptDatabaseUrl() } } });
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function uniqueSlug(base: string, programId: string) {
  const root = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "subject";
  let candidate = root;
  let i = 1;
  while (
    await prisma.driveSubject.findUnique({ where: { programId_slug: { programId, slug: candidate } } })
  ) {
    i += 1;
    candidate = `${root}-${i}`;
  }
  return candidate;
}

async function main() {
  const programs = await prisma.program.findMany();
  let moved = 0;
  let created = 0;
  let deleted = 0;
  let unchanged = 0;

  for (const program of programs) {
    const [existingSubjects, files] = await Promise.all([
      prisma.driveSubject.findMany({ where: { programId: program.id } }),
      prisma.driveFileMatch.findMany({
        where: { link: { programId: program.id } },
        include: { link: { include: { session: true } } },
        orderBy: [{ link: { session: { order: "asc" } } }, { fileName: "asc" }],
      }),
    ]);
    if (files.length === 0) continue;

    // Phase 1: recluster purely in memory, ignoring the files' current
    // (possibly wrong) driveSubjectId, using only the fixed matcher.
    type Cluster = { name: string; fileIds: string[]; currentSubjectIds: Set<string> };
    const clusters: Cluster[] = [];
    for (const file of files) {
      const rawName = deriveSubjectNameFromFilename(file.fileName) || file.fileName.replace(/\.pdf$/i, "");
      const pseudo = clusters.map((c, i) => ({ id: String(i), name: c.name }));
      const { subject: matched, confidence } = matchDriveSubjectName(pseudo, rawName);
      if (matched && confidence >= 0.85) {
        const cluster = clusters[Number(matched.id)];
        cluster.fileIds.push(file.id);
        if (file.driveSubjectId) cluster.currentSubjectIds.add(file.driveSubjectId);
      } else {
        clusters.push({
          name: rawName,
          fileIds: [file.id],
          currentSubjectIds: new Set(file.driveSubjectId ? [file.driveSubjectId] : []),
        });
      }
    }

    // Phase 2: find or create the real DB subject per cluster, reassigning
    // only the files whose current subject doesn't already match the
    // cluster's single settled id (skips a DB write for untouched files).
    const usedExistingIds = new Set<string>();
    for (const cluster of clusters) {
      // Already entirely and exclusively on one existing subject? Nothing to do.
      if (cluster.currentSubjectIds.size === 1) {
        const [onlyId] = cluster.currentSubjectIds;
        if (!usedExistingIds.has(onlyId)) {
          usedExistingIds.add(onlyId);
          unchanged += cluster.fileIds.length;
          continue;
        }
      }

      const candidateExisting = existingSubjects.filter((s) => !usedExistingIds.has(s.id));
      const { subject: existingMatch, confidence } = matchDriveSubjectName(candidateExisting, cluster.name);
      let targetId: string;
      if (existingMatch && confidence >= 0.999) {
        targetId = existingMatch.id;
      } else {
        const slug = await uniqueSlug(cluster.name, program.id);
        const createdSubject = await prisma.driveSubject.create({
          data: { programId: program.id, name: cluster.name, slug },
        });
        targetId = createdSubject.id;
        created++;
      }
      usedExistingIds.add(targetId);

      const toMove = cluster.fileIds; // simplest correct option: reassign every file in the cluster
      if (toMove.length > 0) {
        await prisma.driveFileMatch.updateMany({
          where: { id: { in: toMove } },
          data: { driveSubjectId: targetId },
        });
        moved += toMove.length;
      }
    }

    const orphaned = await prisma.driveSubject.findMany({
      where: { programId: program.id, files: { none: {} } },
      select: { id: true, name: true },
    });
    if (orphaned.length) {
      await prisma.driveSubject.deleteMany({ where: { id: { in: orphaned.map((s) => s.id) } } });
      deleted += orphaned.length;
      for (const o of orphaned) console.log(`  removed empty subject "${o.name}" (${program.name})`);
    }

    console.log(`${program.name}: ${clusters.length} cluster(s) from ${files.length} file(s)`);
    await sleep(150);
  }

  console.log(`\nDone. ${moved} file(s) reassigned, ${unchanged} left untouched, ${created} new subject(s), ${deleted} empty subject(s) removed.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
