// Adds the missing "B.Sc. (Hons.) Biochemistry" Program — referenced by
// Consolidated Upload's course-name suggestions but never actually seeded
// anywhere, so every Biochemistry paper had nowhere real to land. Unlike
// the other Hons. programs in seed-du-more-programs.ts (which have
// specific named papers per semester from the official DU syllabus), this
// college's actual Biochemistry papers are one combined paper per
// semester — so this seeds a bare Program + 6 semester Terms only; the
// "Biochemistry" subject itself is created on the fly per semester the
// first time a paper is uploaded to it (same as any other course).
//
// Safe to re-run: guarded by slug/order lookups, same as
// seed-du-more-programs.ts.
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

const PROGRAM_NAME = "B.Sc. (Hons.) Biochemistry";
const PROGRAM_SLUG = "bsc-hons-biochemistry";
const SEMESTER_COUNT = 6;

async function main() {
  let program = await prisma.program.findUnique({ where: { slug: PROGRAM_SLUG } });
  if (!program) {
    program = await prisma.program.create({
      data: { slug: PROGRAM_SLUG, name: PROGRAM_NAME, level: "COLLEGE" },
    });
    console.log("Created programme:", program.name);
  } else {
    console.log("Programme already exists, adding any missing terms:", program.name);
  }

  for (let order = 1; order <= SEMESTER_COUNT; order++) {
    const existing = await prisma.term.findUnique({
      where: { programId_order: { programId: program.id, order } },
    });
    if (existing) continue;
    await prisma.term.create({
      data: { programId: program.id, order, name: `Semester ${order}` },
    });
    console.log(`  Created Semester ${order}`);
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
