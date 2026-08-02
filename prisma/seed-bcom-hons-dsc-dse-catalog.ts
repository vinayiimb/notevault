// Replaces the entire B.Com (Hons) — DU Official Syllabus catalog with the
// accurate, complete DSC/DSE structure (Semesters 1-8) supplied directly by
// the admin, replacing the old placeholder set (13 plain-named subjects
// across only Semesters 1-5, nothing attached to any of them — verified
// safe to fully replace, not a partial merge).
// Safe to re-run: deletes and recreates every Term/Subject for this program
// each time, so it always ends up exactly matching SEMESTERS below.
import { config } from "dotenv";
import path from "path";
config({ path: path.join(process.cwd(), ".env.local") });
config({ path: path.join(process.cwd(), ".env") });

import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

type Paper = { code: string; title: string };
type Semester = { order: number; dsc: Paper[]; dse: Paper[] };

const SEMESTERS: Semester[] = [
  {
    order: 1,
    dsc: [
      { code: "1.1", title: "Management Principles and Applications" },
      { code: "1.2", title: "Business Laws" },
      { code: "1.3", title: "Financial Accounting" },
    ],
    dse: [],
  },
  {
    order: 2,
    dsc: [
      { code: "2.1", title: "Corporate Accounting" },
      { code: "2.2", title: "Company Law" },
      { code: "2.3", title: "Human Resource Management" },
    ],
    dse: [],
  },
  {
    order: 3,
    dsc: [
      { code: "3.1", title: "Business Mathematics" },
      { code: "3.2", title: "Financial Management" },
      { code: "3.3", title: "Principles of Marketing" },
    ],
    dse: [
      { code: "3.1", title: "Organisational Behaviour" },
      { code: "3.2", title: "Financial Markets and Institutions" },
      { code: "3.3", title: "Brand Management" },
      { code: "3.4", title: "Financial Reporting Analysis & Valuation" },
      { code: "3.5", title: "Yoga and Happiness" },
    ],
  },
  {
    order: 4,
    dsc: [
      { code: "4.1", title: "Business Statistics" },
      { code: "4.2", title: "Cost Accounting" },
      { code: "4.3", title: "International Business" },
    ],
    dse: [
      { code: "4.1", title: "Human Resource Development" },
      { code: "4.2", title: "Investment Management" },
      { code: "4.3", title: "Sustainability Marketing" },
      { code: "4.4", title: "Analysis of Financial Statements" },
      { code: "4.5", title: "Decision Science" },
      { code: "4.6", title: "Bhartiya Gyan Parampara (Indian Knowledge System)" },
    ],
  },
  {
    order: 5,
    dsc: [
      { code: "5.1", title: "Income-Tax Law and Practice" },
      { code: "5.2", title: "Business Economics" },
      { code: "5.3", title: "Management Accounting" },
    ],
    dse: [
      { code: "5.1", title: "Organisational Democracy and Industrial Relations" },
      { code: "5.2", title: "International Finance" },
      { code: "5.3", title: "Consumer Affairs and Sovereignty" },
      { code: "5.4", title: "Accounting for Mergers & Acquisitions and Valuations" },
      { code: "5.5", title: "Auditing" },
      { code: "5.6", title: "Export-Import Management" },
      { code: "5.7", title: "Public Administration and Business" },
      { code: "5.8", title: "Business Tax Procedures and Management" },
    ],
  },
  {
    order: 6,
    dsc: [
      { code: "6.1", title: "Business Analytics" },
      { code: "6.2", title: "Corporate Governance" },
      { code: "6.3", title: "Goods and Services Tax (GST) and Customs Law" },
    ],
    dse: [
      { code: "6.1", title: "Learning and Development" },
      { code: "6.2", title: "Investment Banking and Financial Services" },
      { code: "6.3", title: "Advertising" },
      { code: "6.4", title: "Industrial Relations and Labour Laws" },
      { code: "6.5", title: "International Monetary and Financial Environment" },
      { code: "6.6", title: "Business Research Methods" },
      { code: "6.7", title: "Social and Environmental Accounting" },
    ],
  },
  {
    order: 7,
    dsc: [{ code: "7.1", title: "Business and Macroeconomic Policy" }],
    dse: [
      { code: "7.1", title: "Performance Management" },
      { code: "7.2", title: "Entrepreneurship Development" },
      { code: "7.3", title: "Mind Management" },
      { code: "7.4", title: "Financial Derivatives" },
      { code: "7.5", title: "Business Valuation" },
      { code: "7.6", title: "Financial Technology and Analytics" },
      { code: "7.7", title: "Integrated Marketing Communication" },
      { code: "7.8", title: "Social Media Marketing" },
      { code: "7.9", title: "Marketing Research" },
      { code: "7.10", title: "International Taxation" },
      { code: "7.11", title: "Corporate Tax Planning" },
      { code: "7.12", title: "Personal Tax Planning and Tax Management" },
      { code: "7.13", title: "Business Research Methods" },
    ],
  },
  {
    order: 8,
    dsc: [{ code: "8.1", title: "The Economy of Bharat" }],
    dse: [
      { code: "8.1", title: "Technology in HR" },
      { code: "8.2", title: "Event Management" },
      { code: "8.3", title: "Business Ethics and Human Values" },
      { code: "8.4", title: "Financial Risk Management" },
      { code: "8.5", title: "Behavioural Finance" },
      { code: "8.6", title: "Mergers, Acquisitions and Corporate Restructuring" },
      { code: "8.7", title: "Retail Management" },
      { code: "8.8", title: "Distribution and Logistics Management" },
      { code: "8.9", title: "Rural Marketing" },
      { code: "8.10", title: "Advanced Business Research" },
    ],
  },
];

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-");
}

async function main() {
  const program = await prisma.program.findUnique({ where: { slug: "b-com-hons-du-syllabus" } });
  if (!program) throw new Error("b-com-hons-du-syllabus program not found.");

  const existingTerms = await prisma.term.findMany({ where: { programId: program.id } });
  await prisma.term.deleteMany({ where: { id: { in: existingTerms.map((t) => t.id) } } });
  console.log(`Removed ${existingTerms.length} old term(s) (and their subjects) for ${program.name}.`);

  let subjectCount = 0;
  for (const semester of SEMESTERS) {
    const term = await prisma.term.create({
      data: { programId: program.id, name: `Semester ${semester.order}`, order: semester.order },
    });

    for (const paper of semester.dsc) {
      const name = `DSC-${paper.code} — ${paper.title}`;
      await prisma.subject.create({ data: { termId: term.id, name, slug: slugify(name) } });
      subjectCount++;
    }
    for (const paper of semester.dse) {
      const name = `DSE-${paper.code} — ${paper.title}`;
      await prisma.subject.create({ data: { termId: term.id, name, slug: slugify(name) } });
      subjectCount++;
    }
  }

  console.log(`Created 8 semester(s), ${subjectCount} subject(s) total.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
