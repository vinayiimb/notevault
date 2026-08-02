// Additive fix for B.Com (Programme): Semesters 5-8 each had a single
// placeholder Subject row ("DSE Pool — N Options (e.g. ...)") standing in for
// the whole Discipline Specific Elective pool instead of individual named
// subjects — so DSE papers had nowhere real to attach and couldn't show up in
// per-subject coverage tracking. Real Drive-matched papers already exist for
// several of these named electives (Auditing, Fundamental of Investments,
// Entrepreneurship Development, ...), confirming the split is warranted.
//
// Replaces each placeholder with one Subject per elective, named
// "DSE-<sem>.<n> — <Title>" to match the existing DSC-x.x convention, taken
// verbatim from the official B.Com (Programme) syllabus (Semesters 5-8 DSE
// lists). GE Pool placeholders are left untouched — out of scope.
// Safe to re-run: skips a semester once its placeholder is gone.
import { config } from "dotenv";
import path from "path";
config({ path: path.join(process.cwd(), ".env.local") });
config({ path: path.join(process.cwd(), ".env") });

import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-");
}

const DSE_ELECTIVES: Record<number, { placeholderSlug: string; titles: string[] }> = {
  5: {
    placeholderSlug: "dse-pool-10-options-e-g-organization-behaviour",
    titles: [
      "Organization Behaviour",
      "Yoga and Happiness",
      "Financial Markets and Institutions",
      "Sustainability Marketing",
      "Business Mathematics",
      "Accounting for Mergers and Acquisitions",
      "Auditing",
      "Business Tax Procedures and Management",
      "International Monetary and Financial Environment",
      "Bhartiya Gyan Parampara (Indian Knowledge System)",
    ],
  },
  6: {
    placeholderSlug: "dse-pool-8-options-e-g-human-resource-development",
    titles: [
      "Human Resource Development",
      "Fundamentals of Investment",
      "Advertising",
      "Business Research Methods",
      "Social and Environmental Accounting",
      "Industrial Laws",
      "Export Import Management",
      "Business Incubation",
    ],
  },
  7: {
    placeholderSlug: "dse-pool-13-options-e-g-performance-management",
    titles: [
      "Performance Management",
      "Technology in HR",
      "Mind Management",
      "International Finance",
      "Financial Technology and Analytics",
      "Mergers, Acquisitions and Corporate Restructuring",
      "Integrated Marketing Communication",
      "Retail Management",
      "Consumer Affairs and Sovereignty",
      "International Taxation",
      "Corporate Tax Planning",
      "Personal Tax Planning",
      "Business Research Methods",
    ],
  },
  8: {
    placeholderSlug: "dse-pool-10-options-e-g-compensation-management",
    titles: [
      "Compensation Management",
      "Learning and Development",
      "Business Ethics and Human Values",
      "Investment Banking and Financial Services",
      "Financial Derivatives",
      "Business Valuation",
      "Digital Marketing",
      "Distribution Logistics Management",
      "Brand Management",
      "Advanced Business Research",
    ],
  },
};

async function main() {
  const program = await prisma.program.findUnique({ where: { slug: "bcom-programme" } });
  if (!program) throw new Error("bcom-programme program not found.");

  let created = 0;
  let skippedSemesters = 0;

  for (const [semesterOrder, { placeholderSlug, titles }] of Object.entries(DSE_ELECTIVES)) {
    const order = Number(semesterOrder);
    const term = await prisma.term.findFirst({ where: { programId: program.id, order } });
    if (!term) {
      console.log(`Semester ${order}: term not found, skipping.`);
      continue;
    }

    const placeholder = await prisma.subject.findFirst({ where: { termId: term.id, slug: placeholderSlug } });
    if (!placeholder) {
      skippedSemesters++;
      console.log(`Semester ${order}: placeholder already replaced, skipping.`);
      continue;
    }

    for (let i = 0; i < titles.length; i += 1) {
      const title = titles[i];
      const name = `DSE-${order}.${i + 1} — ${title}`;
      const slug = slugify(name);
      await prisma.subject.upsert({
        where: { termId_slug: { termId: term.id, slug } },
        update: {},
        create: { termId: term.id, name, slug },
      });
      created++;
    }

    await prisma.subject.delete({ where: { id: placeholder.id } });
    console.log(`Semester ${order}: added ${titles.length} DSE elective(s), removed placeholder.`);
  }

  console.log(`\nDone. ${created} DSE elective subject(s) created/confirmed, ${skippedSemesters} semester(s) already done.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
