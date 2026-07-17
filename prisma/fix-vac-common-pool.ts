// One-off fix + seed: VAC / AEC / SEC / GE papers are common across every DU
// undergraduate programme (B.Com, BA, B.Sc, ...) — they don't belong to any one
// degree course. This script:
//   1. creates a single shared "Common Pool" programme with Semester 1-8 terms
//   2. migrates resources that got auto-matched into the wrong subject
//      (Financial Literacy -> Financial Accounting, Yoga P&P -> Income Tax Law)
//      into correct common-pool subjects
//   3. migrates the one-off "Art of being happy" programme into the pool
//   4. pre-creates the remaining common subjects (empty) so future bulk
//      uploads of these papers auto-match instead of asking to create new.
//
// Safe to re-run: every create is guarded by a lookup first.
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

const POOL_SLUG = "common-pool-vac-aec-sec-ge";
const DEFAULT_TERM_ORDER = 2; // these papers were being filed under Semester 2

async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>
) {
  const root = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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
    const found = await prisma.subject.findUnique({
      where: { termId_slug: { termId, slug: s } },
    });
    return !!found;
  });
  return prisma.subject.create({ data: { termId, name, slug } });
}

async function main() {
  let pool = await prisma.program.findUnique({ where: { slug: POOL_SLUG } });
  if (!pool) {
    pool = await prisma.program.create({
      data: {
        slug: POOL_SLUG,
        name: "Common Pool (VAC / AEC / SEC / GE)",
        level: "COLLEGE",
        summary:
          "Value Added, Ability Enhancement, Skill Enhancement and Generic Elective papers — shared across every UG programme, not tied to a specific course.",
      },
    });
    console.log("Created programme:", pool.name);
  }

  const terms = new Map<number, { id: string }>();
  for (let order = 1; order <= 8; order++) {
    let term = await prisma.term.findUnique({
      where: { programId_order: { programId: pool.id, order } },
    });
    if (!term) {
      term = await prisma.term.create({
        data: { programId: pool.id, order, name: `Semester ${order}` },
      });
      console.log("  created term", term.name);
    }
    terms.set(order, term);
  }
  const defaultTerm = terms.get(DEFAULT_TERM_ORDER)!;

  const commonSubjectNames = [
    "Swachh Bharat",
    "Ayurveda & Nutrition",
    "Ethics & Culture",
    "Yoga Philosophy & Practice",
    "Panchkosha",
    "Vedic Mathematics I",
    "Vedic Mathematics II",
    "Vedic Mathematics IV",
    "Vedic Mathematics",
    "Culture & Communication",
    "Emotional Intelligence",
    "Social & Emotional Learning",
    "Sahitya Sanskriti aur Cinema",
    "Bhartiya Bhakti Parampara aur Manav Mulya",
    "Gandhi & Education",
    "Science & Society",
    "Financial Literacy",
    "Art of Being Happy",
  ];

  const subjectByName = new Map<string, { id: string; name: string }>();
  for (const name of commonSubjectNames) {
    const subj = await getOrCreateSubject(defaultTerm.id, name);
    subjectByName.set(name, subj);
    console.log("  subject ready:", subj.name);
  }

  // --- migrate misfiled resources -------------------------------------
  const financialAccounting = await prisma.subject.findFirst({
    where: { name: "Financial Accounting" },
  });
  if (financialAccounting) {
    const target = subjectByName.get("Financial Literacy")!;
    const moved = await prisma.resource.updateMany({
      where: {
        subjectId: financialAccounting.id,
        fileName: { contains: "Financial" },
        title: { contains: "Literacy" },
      },
      data: { subjectId: target.id },
    });
    console.log(
      `Moved ${moved.count} "Financial Literacy" resource(s) out of "Financial Accounting"`
    );
  }

  const incomeTaxLaw = await prisma.subject.findFirst({
    where: { name: "BC 3.2 — Income Tax Law & Practice" },
  });
  if (incomeTaxLaw) {
    const target = subjectByName.get("Yoga Philosophy & Practice")!;
    const moved = await prisma.resource.updateMany({
      where: { subjectId: incomeTaxLaw.id, title: { contains: "Yoga" } },
      data: { subjectId: target.id },
    });
    console.log(
      `Moved ${moved.count} "Yoga Philosophy & Practice" resource(s) out of "BC 3.2 — Income Tax Law & Practice"`
    );
  }

  // --- fold the one-off "Art of being happy" programme into the pool --
  const strayProgram = await prisma.program.findFirst({
    where: { name: { equals: "Art of being happy" } },
  });
  if (strayProgram) {
    const strayTerms = await prisma.term.findMany({
      where: { programId: strayProgram.id },
      include: { subjects: { include: { resources: true } } },
    });
    const target = subjectByName.get("Art of Being Happy")!;
    let movedCount = 0;
    for (const term of strayTerms) {
      for (const subj of term.subjects) {
        for (const resource of subj.resources) {
          await prisma.resource.update({
            where: { id: resource.id },
            data: { subjectId: target.id },
          });
          movedCount++;
        }
      }
    }
    await prisma.program.delete({ where: { id: strayProgram.id } });
    console.log(
      `Folded stray "Art of being happy" programme into the common pool (${movedCount} resource(s) moved), then removed the stray programme.`
    );
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
