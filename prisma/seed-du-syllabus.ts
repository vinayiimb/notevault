// Additive seed: adds the real University of Delhi B.Com (Hons) LOCF syllabus
// as its own Program, alongside (not replacing) the hand-picked sample
// content from seed.ts. Safe to re-run: skips creating the program if a
// program with this slug already exists.
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { PrismaClient } from "../src/generated/prisma";
import { makeSimplePdf } from "./lib/make-pdf";

const prisma = new PrismaClient();
const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");

async function saveGeneratedPdf(subdir: "notes" | "pyqs", title: string, lines: string[]) {
  const dir = path.join(UPLOAD_ROOT, subdir);
  await mkdir(dir, { recursive: true });
  const fileName = `${crypto.randomUUID()}.pdf`;
  const buffer = makeSimplePdf(title, lines);
  await writeFile(path.join(dir, fileName), buffer);
  return {
    fileUrl: `/uploads/${subdir}/${fileName}`,
    fileName: `${title.replace(/[^\w.\- ]+/g, "").trim()}.pdf`,
    fileSize: buffer.byteLength,
  };
}

type Paper = { code: string; title: string; category: string };

const SEMESTERS: { name: string; order: number; papers: Paper[] }[] = [
  {
    name: "Semester 1",
    order: 1,
    papers: [
      { code: "BC 1.2", title: "Financial Accounting", category: "Core Paper" },
      { code: "BC 1.3", title: "Business Organisation & Management", category: "Core Paper" },
    ],
  },
  {
    name: "Semester 2",
    order: 2,
    papers: [
      { code: "BC 2.2", title: "Business Laws", category: "Core Paper" },
      { code: "BC 2.3", title: "Business Mathematics & Statistics", category: "Core Paper" },
    ],
  },
  {
    name: "Semester 3",
    order: 3,
    papers: [
      { code: "BC 3.1", title: "Company Law", category: "Core Paper" },
      { code: "BC 3.2", title: "Income Tax Law & Practice", category: "Core Paper" },
      { code: "BC 3.4(a)", title: "Computer Applications in Business", category: "Skill Enhancement Course" },
      { code: "BC 3.4(b)", title: "Cyber Crimes & Laws", category: "Skill Enhancement Course" },
    ],
  },
  {
    name: "Semester 4",
    order: 4,
    papers: [
      { code: "BC 4.2", title: "Corporate Accounting", category: "Core Paper" },
      { code: "BC 4.3", title: "Cost Accounting", category: "Core Paper" },
      { code: "BC 4.4(a)", title: "E-Commerce", category: "Skill Enhancement Course" },
      { code: "BC 4.4(b)", title: "Investing in Stock Markets", category: "Skill Enhancement Course" },
      { code: "BC 4.4(c)", title: "Personal Tax Planning", category: "Skill Enhancement Course" },
    ],
  },
  {
    name: "Semester 5",
    order: 5,
    papers: [
      { code: "BC 5.1(a)", title: "Human Resource Management", category: "Discipline Specific Elective" },
      { code: "BC 5.1(b)", title: "Principles of Marketing", category: "Discipline Specific Elective" },
      { code: "BC 5.1(c)", title: "Auditing and Corporate Governance", category: "Discipline Specific Elective" },
      { code: "BC 5.1(d)", title: "Financial Reporting and Analysis", category: "Discipline Specific Elective" },
      { code: "BC 5.1(e)", title: "Document Management System", category: "Discipline Specific Elective" },
      { code: "BC 5.2(a)", title: "Fundamentals of Financial Management", category: "Discipline Specific Elective" },
      { code: "BC 5.2(b)", title: "Goods & Services Tax (GST) and Customs Laws", category: "Discipline Specific Elective" },
      { code: "BC 5.2(c)", title: "Training and Development", category: "Discipline Specific Elective" },
      { code: "BC 5.2(d)", title: "Industrial Laws", category: "Discipline Specific Elective" },
      { code: "BC 5.3(a)", title: "Entrepreneurship Development", category: "Skill Enhancement Course" },
      { code: "BC 5.3(b)", title: "Personal Finance", category: "Skill Enhancement Course" },
      { code: "BC 5.4(a)", title: "Human Resource Management", category: "Generic Elective" },
      { code: "BC 5.4(b)", title: "Basics of Accounting", category: "Generic Elective" },
      { code: "BC 5.4(c)", title: "Fundamentals of Marketing", category: "Generic Elective" },
      { code: "BC 5.4(d)", title: "Business Ethics and Sustainability", category: "Generic Elective" },
    ],
  },
  {
    name: "Semester 6",
    order: 6,
    papers: [
      { code: "BC 6.1(a)", title: "Corporate Tax Planning", category: "Discipline Specific Elective" },
      { code: "BC 6.1(b)", title: "Banking and Insurance", category: "Discipline Specific Elective" },
      { code: "BC 6.1(c)", title: "Management Accounting", category: "Discipline Specific Elective" },
      { code: "BC 6.1(d)", title: "Computerised Accounting System", category: "Discipline Specific Elective" },
      { code: "BC 6.1(e)", title: "Financial Markets, Institutions and Services", category: "Discipline Specific Elective" },
      { code: "BC 6.2(a)", title: "International Business", category: "Discipline Specific Elective" },
      { code: "BC 6.2(b)", title: "Fundamentals of Investment", category: "Discipline Specific Elective" },
      { code: "BC 6.2(c)", title: "Consumer Protection", category: "Discipline Specific Elective" },
      { code: "BC 6.2(d)", title: "Organizational Behaviour", category: "Discipline Specific Elective" },
      { code: "BC 6.3(a)", title: "Advertising, Personal Selling & Salesmanship", category: "Skill Enhancement Course" },
      { code: "BC 6.3(b)", title: "Collective Bargaining and Negotiation Skills", category: "Skill Enhancement Course" },
      { code: "BC 6.4(a)", title: "Entrepreneurship Development", category: "Generic Elective" },
      { code: "BC 6.4(b)", title: "Training and Development", category: "Generic Elective" },
      { code: "BC 6.4(c)", title: "Finance for Non-Finance Executives", category: "Generic Elective" },
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
  const slug = "b-com-hons-du-syllabus";
  const existing = await prisma.program.findUnique({ where: { slug } });
  if (existing) {
    console.log("DU syllabus program already exists, skipping (delete it first to re-seed).");
    return;
  }

  const program = await prisma.program.create({
    data: {
      level: "COLLEGE",
      name: "B.Com (Hons) — DU Official Syllabus",
      slug,
      summary:
        "Full semester-wise syllabus as approved by the University of Delhi (LOCF, effective 2019-20): core papers, discipline-specific electives, skill-enhancement courses, and generic electives.",
    },
  });

  for (const semester of SEMESTERS) {
    const term = await prisma.term.create({
      data: { programId: program.id, name: semester.name, order: semester.order },
    });

    for (const paper of semester.papers) {
      await prisma.subject.create({
        data: {
          termId: term.id,
          name: `${paper.code} — ${paper.title}`,
          slug: slugify(`${paper.code}-${paper.title}`),
          description: paper.category,
        },
      });
    }
  }

  // Real syllabus content for BC 1.2 Financial Accounting, taken verbatim
  // from the official unit breakdown, so at least one paper in this program
  // has a genuine downloadable notes PDF rather than just a title.
  const sem1 = await prisma.term.findFirst({ where: { programId: program.id, order: 1 } });
  const financialAccounting = sem1
    ? await prisma.subject.findFirst({
        where: { termId: sem1.id, slug: slugify("BC 1.2-Financial Accounting") },
      })
    : null;

  if (financialAccounting) {
    const file = await saveGeneratedPdf(
      "notes",
      "BC 1.2 Financial Accounting — Full Syllabus (DU)",
      [
        "UNIT I: INTRODUCTION",
        "Conceptual Framework: Accounting principles, Concepts and Conventions,",
        "Introduction to Accounting Standards and Ind AS. Accounting Process:",
        "Journal, ledger, Trial Balance, Financial Statements (overview). Capital",
        "and Revenue Expenditure/Receipts, Deferred Revenue Expenditure.",
        "Preparation of Financial Statements of a sole proprietorship trading firm",
        "and of a not-for-profit organisation.",
        "",
        "UNIT II: DEPRECIATION ACCOUNTING AND INVENTORY VALUATION",
        "Accounting for Plant, Property and Equipment & Depreciation: meaning of",
        "depreciation, depletion and amortization; objectives and methods",
        "(Straight Line, Diminishing Balance); change of method. Inventory",
        "Valuation: meaning, significance, periodic vs perpetual systems, FIFO,",
        "LIFO and Weighted Average methods.",
        "",
        "UNIT III: ACCOUNTING FOR HIRE PURCHASE AND LEASE TRANSACTIONS",
        "Hire Purchase Accounting: calculation of interest, partial and full",
        "repossession, profit computation (Stock & Debtors System). Lease",
        "Transactions: concept and classification of leases (overview).",
        "",
        "UNIT IV: BRANCH AND DEPARTMENTAL ACCOUNTING",
        "Accounting for Branches (excluding foreign branches): Debtors System and",
        "Stock & Debtors System. Departmental Accounting: concept, types of",
        "departments, basis of allocation of expenses, methods of departmental",
        "accounting.",
        "",
        "UNIT V (a): COMPUTERISED ACCOUNTING SYSTEM",
        "Creating a company; configuring accounts and features; ledgers and",
        "groups; stock items and groups; voucher entry; generating reports (Cash",
        "Book, Ledger, Trial Balance, P&L, Balance Sheet, Funds Flow, Cash Flow);",
        "backup and restore.",
        "",
        "UNIT V (b): ACCOUNTING FOR PARTNERSHIP FIRMS",
        "Fundamentals; admission, retirement and death of a partner (overview).",
        "Dissolution of Partnership Firm including insolvency of partners",
        "(excluding sale to a limited company); gradual realisation of assets and",
        "piecemeal payment of liabilities.",
        "",
        "Course objective: build conceptual and practical knowledge of financial",
        "accounting and the techniques for preparing accounts across different",
        "types of business organisations.",
      ]
    );
    await prisma.resource.create({
      data: {
        subjectId: financialAccounting.id,
        type: "NOTES",
        title: "Full Syllabus Notes (Units I-V) — Official DU Structure",
        ...file,
      },
    });
  }

  console.log("DU B.Com syllabus seeded:", program.name);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
