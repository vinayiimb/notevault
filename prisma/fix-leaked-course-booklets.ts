// One-off cleanup for DriveFileMatch rows created before classifyDriveFilename
// existed (see src/lib/subject-quality.ts and the fix in sync-all-drive-links.ts
// / syncDriveFilesForLinkAction). Several sessions point every program's
// SessionProgramLink at the same shared Drive folder (one whole-course booklet
// PDF per program, not yet split by subject) — the old sync blindly turned
// every filename in that folder into a "subject" for whichever program was
// syncing, so every program ended up with every *other* program's booklet
// listed as a fake DriveSubject too.
//
// Re-classifies every existing DriveFileMatch with the same rule the sync
// path now uses at write time: a file matching a *different* program's own
// name is a foreign leak (deleted — the owning program's own link already has
// its own independent copy of the same file, so nothing is lost); a file
// matching the *current* program's own name is that program's own unsplit
// booklet (kept, flagged isCourseBooklet, detached from any fake subject);
// everything else is left untouched. Finishes by deleting any DriveSubject
// left with no files, same as prisma/rebuild-drive-subjects.ts.
// Safe to re-run: idempotent, decides purely from current data each time.
import { config } from "dotenv";
import path from "path";
config({ path: path.join(process.cwd(), ".env.local") });
config({ path: path.join(process.cwd(), ".env") });

import { PrismaClient } from "../src/generated/prisma";
import { classifyDriveFilename, deriveSubjectNameFromFilename } from "../src/lib/subject-quality";

function scriptDatabaseUrl() {
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error("DATABASE_URL is not set.");
  const url = new URL(base);
  url.searchParams.set("connection_limit", "2");
  url.searchParams.set("pool_timeout", "30");
  return url.toString();
}

const prisma = new PrismaClient({ datasources: { db: { url: scriptDatabaseUrl() } } });

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const [allPrograms, files] = await Promise.all([
    prisma.program.findMany({ select: { id: true, name: true } }),
    prisma.driveFileMatch.findMany({
      include: { link: { select: { programId: true } }, driveSubject: { select: { id: true, name: true } } },
    }),
  ]);

  let deletedForeign = 0;
  let markedOwnBooklet = 0;
  let unchanged = 0;
  const foreignByProgram = new Map<string, number>();

  for (const file of files) {
    // Match the live sync path exactly (syncDriveFilesForLinkAction / sync-all-drive-links.ts):
    // classify the *derived* subject name (extension + trailing paper code stripped), not the raw
    // filename — otherwise a trailing ".pdf" can push an otherwise-matching whole-course name just
    // past the substring check (e.g. "B.Com(Hons.).pdf" failing to match "B.Com (Hons) — DU Official
    // Syllabus" only because of the dangling ".pdf").
    const rawName = deriveSubjectNameFromFilename(file.fileName) || file.fileName.replace(/\.pdf$/i, "");
    const classification = classifyDriveFilename(allPrograms, file.link.programId, rawName);

    if (classification === "foreign_booklet") {
      deletedForeign++;
      const programName = allPrograms.find((p) => p.id === file.link.programId)?.name ?? file.link.programId;
      foreignByProgram.set(programName, (foreignByProgram.get(programName) ?? 0) + 1);
      if (!dryRun) await prisma.driveFileMatch.delete({ where: { id: file.id } });
      continue;
    }

    if (classification === "own_booklet") {
      if (!file.isCourseBooklet || file.driveSubjectId) {
        markedOwnBooklet++;
        if (!dryRun) {
          await prisma.driveFileMatch.update({
            where: { id: file.id },
            data: { driveSubjectId: null, isCourseBooklet: true },
          });
        }
      } else {
        unchanged++;
      }
      continue;
    }

    unchanged++;
  }

  console.log(
    `${dryRun ? "[dry run] " : ""}Reclassified ${files.length} file(s): ${deletedForeign} foreign leak(s) removed, ${markedOwnBooklet} marked as own combined booklet, ${unchanged} unchanged.`
  );
  if (foreignByProgram.size) {
    console.log("\nForeign leaks removed, by program:");
    for (const [name, count] of [...foreignByProgram.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(count).padStart(3)}  ${name}`);
    }
  }

  if (dryRun) {
    console.log("\nDry run — no changes written. Re-run without --dry-run to apply.");
    return;
  }

  const orphaned = await prisma.driveSubject.findMany({
    where: { files: { none: {} } },
    select: { id: true, name: true, program: { select: { name: true } } },
  });
  if (orphaned.length) {
    await prisma.driveSubject.deleteMany({ where: { id: { in: orphaned.map((s) => s.id) } } });
    console.log(`\nRemoved ${orphaned.length} now-empty fake subject(s):`);
    for (const o of orphaned) console.log(`  "${o.name}" (${o.program.name})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
