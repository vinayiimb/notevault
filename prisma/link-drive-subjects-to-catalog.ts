// Bridges the two parallel B.Com (Programme) subject systems: the clean,
// syllabus-derived catalog (Program -> Term -> Subject, named "DSC-2.1 —
// Corporate Accounting") and the Drive-matched flow (DriveSubject, named
// straight off PDF filenames, e.g. "Corporate Accounting" or "Company Law
// III"). Several DriveSubject naming variants can point at the same catalog
// Subject, which is why DriveSubject.subjectId is the link (not the other
// direction). Strips the "DSC-x.x — " / "DSE-x.x — " / "SEC-x.x — " code
// prefix from catalog names before comparing, then reuses the existing
// matchDriveSubjectName fuzzy matcher (src/lib/subject-quality.ts) — same
// logic the Drive sync itself already uses to recognize a re-synced name as
// the same subject across years.
// Safe to re-run: only touches DriveSubjects with subjectId still null.
// Program defaults to bcom-programme; pass a different slug as the first
// CLI arg to run it against another program's catalog, e.g.:
//   npx tsx prisma/link-drive-subjects-to-catalog.ts b-com-hons-du-syllabus
import { config } from "dotenv";
import path from "path";
config({ path: path.join(process.cwd(), ".env.local") });
config({ path: path.join(process.cwd(), ".env") });

import { PrismaClient } from "../src/generated/prisma";
import { matchDriveSubjectName } from "../src/lib/subject-quality";

const prisma = new PrismaClient();
const CODE_PREFIX = /^[A-Za-z]{2,4}-\d+\.\d+\s*[—–-]\s*/;

async function main() {
  const slug = process.argv[2] || "bcom-programme";
  const program = await prisma.program.findUnique({ where: { slug } });
  if (!program) throw new Error(`${slug} program not found.`);

  const catalogSubjects = await prisma.subject.findMany({
    where: { term: { programId: program.id } },
    select: { id: true, name: true },
  });
  const candidates = catalogSubjects.map((s) => ({ id: s.id, name: s.name.replace(CODE_PREFIX, "").trim() }));

  const unlinked = await prisma.driveSubject.findMany({
    where: { programId: program.id, subjectId: null },
    select: { id: true, name: true },
  });

  let linked = 0;
  const stillUnlinked: { name: string; bestGuess: string | null; confidence: number }[] = [];

  for (const ds of unlinked) {
    const { subject, confidence } = matchDriveSubjectName(candidates, ds.name);
    if (subject && confidence >= 0.85) {
      await prisma.driveSubject.update({ where: { id: ds.id }, data: { subjectId: subject.id } });
      linked++;
    } else {
      stillUnlinked.push({
        name: ds.name,
        bestGuess: subject?.name ?? null,
        confidence: Math.round(confidence * 100) / 100,
      });
    }
  }

  console.log(`Linked ${linked}/${unlinked.length} DriveSubject(s) to the catalog (confidence >= 0.85).`);
  if (stillUnlinked.length) {
    console.log(`\n${stillUnlinked.length} left unlinked for manual review:`);
    for (const u of stillUnlinked.sort((a, b) => b.confidence - a.confidence)) {
      console.log(
        `  "${u.name}"${u.bestGuess ? ` — closest guess: "${u.bestGuess}" (${u.confidence})` : " — no plausible match"}`
      );
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
