import { prisma } from "@/lib/prisma";

export async function getProgramsWithNotesStatus() {
  const programs = await prisma.program.findMany({
    include: {
      terms: {
        include: {
          subjects: {
            select: {
              id: true,
              notes: { select: { id: true } },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return programs.map((program) => {
    const subjects = program.terms.flatMap((term) => term.subjects);
    const withNotes = subjects.filter((s) => s.notes).length;
    return {
      id: program.id,
      slug: program.slug,
      name: program.name,
      level: program.level,
      subjectCount: subjects.length,
      notesCount: withNotes,
    };
  });
}

export async function getProgramWithSubjectNotesStatus(programId: string) {
  const program = await prisma.program.findUnique({
    where: { id: programId },
    include: {
      terms: {
        orderBy: { order: "asc" },
        include: {
          subjects: {
            orderBy: { name: "asc" },
            select: {
              id: true,
              name: true,
              slug: true,
              upc: true,
              notes: { select: { id: true, updatedAt: true } },
              resources: { where: { type: "PYQ" }, select: { id: true } },
            },
          },
        },
      },
    },
  });
  return program;
}
