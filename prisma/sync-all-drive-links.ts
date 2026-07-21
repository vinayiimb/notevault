// Runs the same "list PDFs in a Drive folder, derive a subject from each
// filename, upsert a DriveFileMatch" logic as syncDriveFilesForLinkAction
// (src/lib/actions.ts) — but for every SessionProgramLink at once, since
// clicking "Sync" one-by-one through the admin UI isn't practical for 200+
// links. Skips links that already have synced files unless --all is passed.
// Safe to re-run: every DriveFileMatch is upserted on [linkId, driveFileId].
import { config } from "dotenv";
import path from "path";
config({ path: path.join(process.cwd(), ".env.local") });
config({ path: path.join(process.cwd(), ".env") });

import { PrismaClient } from "../src/generated/prisma";
import { extractDriveFolderId, listDriveFolderPdfs } from "../src/lib/google-drive";
import { guessYear } from "../src/lib/subject-match";
import { deriveSubjectNameFromFilename, matchDriveSubjectName } from "../src/lib/subject-quality";

const prisma = new PrismaClient();

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

async function syncLink(link: { id: string; driveUrl: string; programId: string; program: { name: string } }) {
  const folderId = extractDriveFolderId(link.driveUrl);
  if (!folderId) return { ok: false, reason: "no folder id in URL", count: 0 };

  const files = await listDriveFolderPdfs(folderId);
  const driveSubjects = await prisma.driveSubject.findMany({ where: { programId: link.programId } });

  for (const file of files) {
    const rawName = deriveSubjectNameFromFilename(file.name) || file.name.replace(/\.pdf$/i, "");
    const year = guessYear(file.name);
    const { subject, confidence } = matchDriveSubjectName(driveSubjects, rawName);

    let driveSubjectId: string;
    if (subject && confidence >= 0.85) {
      driveSubjectId = subject.id;
    } else {
      const slug = await uniqueSlug(rawName, link.programId);
      const created = await prisma.driveSubject.create({ data: { programId: link.programId, name: rawName, slug } });
      driveSubjects.push(created);
      driveSubjectId = created.id;
    }

    await prisma.driveFileMatch.upsert({
      where: { linkId_driveFileId: { linkId: link.id, driveFileId: file.id } },
      update: { fileName: file.name, webViewLink: file.webViewLink, year, driveSubjectId },
      create: { linkId: link.id, driveFileId: file.id, fileName: file.name, webViewLink: file.webViewLink, year, driveSubjectId },
    });
  }

  return { ok: true, count: files.length };
}

async function main() {
  const onlyUnsynced = !process.argv.includes("--all");
  const links = await prisma.sessionProgramLink.findMany({
    include: { program: true, session: true, _count: { select: { driveFiles: true } } },
    orderBy: [{ session: { order: "desc" } }, { program: { name: "asc" } }],
  });

  const targets = onlyUnsynced ? links.filter((l) => l._count.driveFiles === 0) : links;
  console.log(`Syncing ${targets.length} of ${links.length} links${onlyUnsynced ? " (unsynced only)" : ""}...\n`);

  let synced = 0;
  let totalFiles = 0;
  const failures: { session: string; program: string; variant: string; reason: string }[] = [];

  for (const link of targets) {
    const label = `${link.session.label} · ${link.program.name}${link.variantLabel ? ` (${link.variantLabel})` : ""}`;
    try {
      const result = await syncLink(link);
      if (result.ok) {
        synced++;
        totalFiles += result.count;
        console.log(`  ✓ ${label} — ${result.count} file(s)`);
      } else {
        failures.push({ session: link.session.label, program: link.program.name, variant: link.variantLabel, reason: result.reason ?? "unknown" });
        console.log(`  ✗ ${label} — ${result.reason}`);
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      failures.push({ session: link.session.label, program: link.program.name, variant: link.variantLabel, reason });
      console.log(`  ✗ ${label} — ${reason}`);
    }
  }

  console.log(`\nDone. Synced ${synced}/${targets.length} links, ${totalFiles} files total, ${failures.length} failure(s).`);
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f.session} · ${f.program}${f.variant ? ` (${f.variant})` : ""}: ${f.reason}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
