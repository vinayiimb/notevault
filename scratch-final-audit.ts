import { prisma } from "./src/lib/prisma";

async function main() {
  const totalUnlinked = await prisma.driveSubject.count({ where: { subjectId: null } });
  const totalDriveSubjects = await prisma.driveSubject.count();
  console.log(`Total DriveSubjects: ${totalDriveSubjects}. Still unlinked: ${totalUnlinked}.`);

  const byProgram = await prisma.driveSubject.groupBy({ by: ["programId"], _count: { id: true } });
  const unlinkedByProgram = await prisma.driveSubject.groupBy({
    by: ["programId"],
    where: { subjectId: null },
    _count: { id: true },
  });
  const programs = await prisma.program.findMany({ select: { id: true, name: true } });
  const unlinkedMap = new Map(unlinkedByProgram.map((u) => [u.programId, u._count.id]));
  console.log("\nPer program:");
  for (const row of byProgram) {
    const name = programs.find((p) => p.id === row.programId)?.name ?? row.programId;
    const unlinked = unlinkedMap.get(row.programId) ?? 0;
    console.log(`  ${name}: ${row._count.id} total, ${unlinked} unlinked (${Math.round(((row._count.id - unlinked) / row._count.id) * 100)}%)`);
  }
}
main().finally(() => prisma.$disconnect());
