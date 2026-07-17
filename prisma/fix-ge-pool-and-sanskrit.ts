// Three fixes from the latest syllabus paste, per explicit user confirmation:
// 1. GE (Generic Elective) papers get their OWN pool programme, separate from
//    the existing VAC/AEC/SEC Common Pool (user: "make GE a separate pool").
// 2. Common Pool's name is corrected to drop "/ GE" since GE no longer lives
//    there.
// 3. B.A. (Hons.) Sanskrit's placeholder papers (18, 3/semester, from an
//    earlier simplified source) are replaced with the real official
//    DSC-1..DSC-12 titles (2/semester) from the actual DU syllabus document.
//
// Safe to re-run: every create/rename is guarded by a lookup first.
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

const GE_POOL_SLUG = "ge-pool-generic-electives";

// Deduped against every subject already in the DB (exact-match check) —
// skipped: Database Management Systems, Differential Equations, Finance for
// Everyone, Electricity and Magnetism, Media Lekhan, Punjabi Bhasha da
// Mudhla Padhar, Solid State Physics, Thermal Physics.
const NEW_GE_SUBJECTS = [
  "Basic Principles of Ayurveda (Hons.)",
  "Basic Principles of Ayurveda (Prog.)",
  "Basics of Advertising",
  "Bhasha aur Samaj",
  "Cities and Society",
  "Chemistry of Food Nutrients",
  "Data Analysis and Visualization Using Python",
  "Delhi Through the Ages",
  "Delhi through the Ages: From Colonial to Contemporary Times",
  "Genre Fiction",
  "Fitness and Wellness",
  "Ethnobotany",
  "Fundamentals of Indian Philosophy (Prog.)",
  "Fundamentals of Calculus",
  "Financial Management for Beginners",
  "Indian Aesthetics (Hons.)",
  "Hindi Cinema aur Uska Addhyayan",
  "Individual and Society",
  "Introduction to Biology",
  "Human Physiology",
  "Introduction to Linear Algebra",
  "Introduction to Electronics",
  "Ideas in Indian Political Thought",
  "Introduction to the Indian Constitution",
  "Investing in Stock Market",
  "Introductory Astronomy",
  "Making of Post-Colonial India",
  "Literature and Human Rights",
  "Invitation to Sociological Theory",
  "Principles of Microeconomics-I",
  "Life Style Disorders",
  "Medicine in Daily Life",
  "Programming with Python",
  "Modern Physics",
  "Money and Banking",
  "Molecular Modelling",
  "Olympic Education",
  "Sanskrit Narrotology (Prog.)",
  "Sociology and Everyday Life",
  "Sanskrit Narrotology (Hons.)",
  "Punjab Diyan Lok Kalavan",
  "Stress Management",
  "Theory of Public Finance",
  "Viharak Punjabi",
  "Western Political Philosophy",
];

// Official DSC-1 through DSC-12 for B.A. (Hons.) Sanskrit (Major), 2 papers
// per semester.
const SANSKRIT_DSC_BY_SEMESTER: string[][] = [
  ["DSC-1 — Sanskrit Grammar", "DSC-2 — Sanskrit Poetry"],
  ["DSC-3 — Sanskrit Prose", "DSC-4 — Sanskrit Drama"],
  ["DSC-5 — Sanskrit Theatre", "DSC-6 — Gita and Upanishad"],
  ["DSC-7 — Dharmashastra Studies", "DSC-8 — Readings from Vedas"],
  ["DSC-9 — Indian Epigraphy & Paleography", "DSC-10 — Basic Elements of Indian Philosophy"],
  ["DSC-11 — Sanskrit Literature: Katha Kavya", "DSC-12 — Indian Aesthetics"],
];

async function uniqueSlug(base: string, exists: (slug: string) => Promise<boolean>) {
  const root = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  let slug = root;
  let n = 2;
  while (await exists(slug)) {
    slug = `${root}-${n}`;
    n++;
  }
  return slug;
}

async function getOrCreateSubject(termId: string, name: string) {
  const existing = await prisma.subject.findFirst({ where: { termId, name } });
  if (existing) return existing;
  const slug = await uniqueSlug(name, async (s) => {
    const found = await prisma.subject.findUnique({ where: { termId_slug: { termId, slug: s } } });
    return !!found;
  });
  return prisma.subject.create({ data: { termId, name, slug } });
}

async function main() {
  // 1. GE Pool programme
  let gePool = await prisma.program.findUnique({ where: { slug: GE_POOL_SLUG } });
  if (!gePool) {
    gePool = await prisma.program.create({
      data: {
        slug: GE_POOL_SLUG,
        name: "GE Pool (Generic Electives)",
        level: "COLLEGE",
        summary: "Generic Elective papers offered across departments — chosen individually, not tied to one specific programme.",
      },
    });
    console.log("Created programme:", gePool.name);
  }
  let geTerm = await prisma.term.findUnique({
    where: { programId_order: { programId: gePool.id, order: 0 } },
  });
  if (!geTerm) {
    geTerm = await prisma.term.create({ data: { programId: gePool.id, order: 0, name: "All Semesters" } });
    console.log("  created term: All Semesters");
  }
  let created = 0;
  for (const name of NEW_GE_SUBJECTS) {
    const before = await prisma.subject.findFirst({ where: { termId: geTerm.id, name } });
    if (before) continue;
    await getOrCreateSubject(geTerm.id, name);
    created++;
  }
  console.log(`GE Pool: created ${created} / ${NEW_GE_SUBJECTS.length} subject(s)`);

  // 2. Rename Common Pool
  const commonPool = await prisma.program.findUnique({ where: { slug: "common-pool-vac-aec-sec-ge" } });
  if (commonPool && commonPool.name.includes("GE")) {
    await prisma.program.update({
      where: { id: commonPool.id },
      data: { name: "Common Pool (VAC / AEC / SEC)" },
    });
    console.log("Renamed Common Pool programme to drop '/ GE'");
  }

  // 3. Fix Sanskrit DSC papers
  const sanskrit = await prisma.program.findFirst({
    where: { slug: "ba-hons-sanskrit" },
    include: { terms: { orderBy: { order: "asc" }, include: { subjects: true } } },
  });
  if (sanskrit) {
    for (let i = 0; i < sanskrit.terms.length && i < SANSKRIT_DSC_BY_SEMESTER.length; i++) {
      const term = sanskrit.terms[i];
      const officialNames = SANSKRIT_DSC_BY_SEMESTER[i];

      // Remove old placeholder subjects (none have resources yet, confirmed).
      for (const s of term.subjects) {
        if (!officialNames.includes(s.name)) {
          await prisma.subject.delete({ where: { id: s.id } });
        }
      }
      for (const name of officialNames) {
        await getOrCreateSubject(term.id, name);
      }
      console.log(`  Sanskrit ${term.name}: now ${officialNames.join(", ")}`);
    }
  } else {
    console.log("Sanskrit programme not found (slug ba-hons-sanskrit) — skipped.");
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
