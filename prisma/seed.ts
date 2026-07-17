import { mkdir, writeFile } from "fs/promises";
import path from "path";
import bcrypt from "bcryptjs";
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

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-");
}

type SubjectSeed = {
  name: string;
  description: string;
  notes: { title: string; lines: string[] }[];
  pyqs: { title: string; year: number; lines: string[] }[];
  questions: {
    q: string;
    a: string;
    marks?: number;
    isRepeated?: boolean;
    repeatCount?: number;
    years?: string;
  }[];
};

async function seedSubject(termId: string, subject: SubjectSeed) {
  const created = await prisma.subject.create({
    data: {
      termId,
      name: subject.name,
      slug: slugify(subject.name),
      description: subject.description,
    },
  });

  for (const note of subject.notes) {
    const file = await saveGeneratedPdf("notes", note.title, note.lines);
    await prisma.resource.create({
      data: { subjectId: created.id, type: "NOTES", title: note.title, ...file },
    });
  }

  for (const pyq of subject.pyqs) {
    const file = await saveGeneratedPdf(
      "pyqs",
      `${subject.name} - ${pyq.year} Question Paper`,
      pyq.lines
    );
    await prisma.resource.create({
      data: {
        subjectId: created.id,
        type: "PYQ",
        title: pyq.title,
        year: pyq.year,
        ...file,
      },
    });
  }

  for (const question of subject.questions) {
    await prisma.question.create({
      data: {
        subjectId: created.id,
        questionText: question.q,
        answerText: question.a,
        marks: question.marks ?? null,
        isRepeated: question.isRepeated ?? false,
        repeatCount: question.repeatCount ?? 1,
        years: question.years ?? null,
      },
    });
  }

  return created;
}

async function main() {
  console.log("Clearing existing data...");
  await prisma.question.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.term.deleteMany();
  await prisma.program.deleteMany();
  await prisma.admin.deleteMany();

  const adminEmail = process.env.ADMIN_SEED_EMAIL ?? "admin@notevault.dev";
  const adminPassword = process.env.ADMIN_SEED_PASSWORD ?? "ChangeMe123!";
  await prisma.admin.create({
    data: {
      email: adminEmail,
      name: "Admin",
      passwordHash: await bcrypt.hash(adminPassword, 10),
    },
  });
  console.log(`Seeded admin: ${adminEmail} / ${adminPassword}`);

  // ---------------- College: B.Com (Hons) ----------------
  const bcom = await prisma.program.create({
    data: {
      level: "COLLEGE",
      name: "B.Com (Hons)",
      slug: "b-com-hons",
      summary: "Bachelor of Commerce (Honours), semesters 1 to 6.",
    },
  });

  const semesterNames = [
    "Semester 1",
    "Semester 2",
    "Semester 3",
    "Semester 4",
    "Semester 5",
    "Semester 6",
  ];
  const terms: Record<number, string> = {};
  for (let i = 0; i < semesterNames.length; i++) {
    const term = await prisma.term.create({
      data: { programId: bcom.id, name: semesterNames[i], order: i + 1 },
    });
    terms[i + 1] = term.id;
  }

  await seedSubject(terms[1], {
    name: "Financial Accounting",
    description: "Fundamentals of bookkeeping, financial statements, and partnership accounts.",
    notes: [
      {
        title: "Unit 1 - Scope and Purpose of Financial Accounting",
        lines: [
          "Financial accounting is the process of recording, summarising, and reporting",
          "business transactions to external stakeholders such as investors, lenders,",
          "and regulators. It follows the double-entry system of bookkeeping and results",
          "in three primary statements: the Balance Sheet, the Income Statement (Profit",
          "and Loss Account), and the Cash Flow Statement.",
        ],
      },
      {
        title: "Unit 2 - Partnership Accounting",
        lines: [
          "Covers admission and retirement of a partner, treatment of goodwill,",
          "revaluation of assets and liabilities, and preparation of the partner's",
          "capital accounts under fluctuating and fixed capital methods.",
        ],
      },
    ],
    pyqs: [
      {
        title: "Financial Accounting End-Term 2023",
        year: 2023,
        lines: [
          "Q1. Explain the accounting equation with suitable examples. (5 marks)",
          "Q2. Prepare a Balance Sheet from the given Trial Balance. (10 marks)",
          "Q3. Explain the treatment of goodwill on admission of a new partner. (8 marks)",
        ],
      },
      {
        title: "Financial Accounting End-Term 2024",
        year: 2024,
        lines: [
          "Q1. Explain the accounting equation with suitable examples. (5 marks)",
          "Q2. Prepare a Cash Flow Statement using the indirect method. (10 marks)",
          "Q3. Distinguish between capital and revenue expenditure. (5 marks)",
        ],
      },
    ],
    questions: [
      {
        q: "Explain the Accounting Equation with suitable examples.",
        a: "The Accounting Equation states Assets = Liabilities + Capital. Every transaction affects at least two accounts so that the equation always remains balanced. For example, when a business purchases furniture for cash, one asset (cash) decreases while another asset (furniture) increases, keeping the equation in balance.",
        marks: 5,
        isRepeated: true,
        repeatCount: 3,
        years: "2021, 2023, 2024",
      },
      {
        q: "Explain the treatment of goodwill on admission of a new partner.",
        a: "Goodwill represents the value of a firm's reputation. On admission of a new partner, existing partners are compensated for the share of goodwill they sacrifice, either by the new partner bringing in cash for goodwill, or by adjusting the goodwill through the partners' capital accounts in the old profit-sharing ratio.",
        marks: 8,
        isRepeated: true,
        repeatCount: 2,
        years: "2022, 2023",
      },
      {
        q: "Distinguish between capital and revenue expenditure.",
        a: "Capital expenditure creates a long-term asset or benefit (e.g. purchase of machinery) and is capitalised on the Balance Sheet. Revenue expenditure is incurred for day-to-day operations (e.g. rent, wages) and is charged fully to the Income Statement in the period it is incurred.",
        marks: 5,
      },
      {
        q: "What are the users of accounting information?",
        a: "Users include internal users (management, employees) who use accounting information for decision-making and performance evaluation, and external users (investors, creditors, government, tax authorities, and the public) who use it to assess financial health, creditworthiness, and compliance.",
        marks: 5,
      },
    ],
  });

  await seedSubject(terms[2], {
    name: "Principles of Management",
    description: "Core management functions: planning, organising, staffing, directing, controlling.",
    notes: [
      {
        title: "Unit 1 - Functions of Management",
        lines: [
          "Henri Fayol identified five functions of management: planning, organising,",
          "commanding, coordinating, and controlling. Modern textbooks typically group",
          "these into planning, organising, staffing, directing, and controlling (POSDC).",
        ],
      },
    ],
    pyqs: [
      {
        title: "Principles of Management Mid-Term 2024",
        year: 2024,
        lines: [
          "Q1. Explain the functions of management given by Henri Fayol. (10 marks)",
          "Q2. Differentiate between management and administration. (5 marks)",
        ],
      },
    ],
    questions: [
      {
        q: "Explain the functions of management as given by Henri Fayol.",
        a: "Fayol identified five functions: Planning (setting objectives and deciding a course of action), Organising (arranging resources and tasks), Commanding (directing employees), Coordinating (synchronising activities), and Controlling (monitoring performance against plans and correcting deviations).",
        marks: 10,
        isRepeated: true,
        repeatCount: 3,
        years: "2021, 2022, 2024",
      },
      {
        q: "What is the difference between management and administration?",
        a: "Administration is a top-level, policy-determining function concerned with setting objectives and broad policies, while management is concerned with executing those policies and coordinating day-to-day operations to achieve them.",
        marks: 5,
      },
    ],
  });

  await seedSubject(terms[3], {
    name: "Business Statistics",
    description: "Descriptive statistics, probability, random variables, and distributions.",
    notes: [
      {
        title: "Unit 1 - Measures of Central Tendency and Dispersion",
        lines: [
          "Covers mean, median, mode, range, variance, and standard deviation for",
          "grouped and ungrouped data, along with the Five Number Summary and Box Plots.",
        ],
      },
      {
        title: "Unit 2 - Probability and Bayes' Theorem",
        lines: [
          "Introduces basic probability rules, conditional probability, and Bayes'",
          "Theorem with worked examples involving diagnostic tests and quality control.",
        ],
      },
      {
        title: "Unit 3 - Random Variables and Distributions",
        lines: [
          "Covers Binomial, Poisson, Uniform, Exponential, and Normal distributions,",
          "along with their properties, means, variances, and typical applications.",
        ],
      },
    ],
    pyqs: [
      {
        title: "Business Statistics End-Term 2022",
        year: 2022,
        lines: [
          "Q1. State and prove Bayes' Theorem with an example. (10 marks)",
          "Q2. Distinguish between Binomial and Poisson distributions. (8 marks)",
          "Q3. Calculate mean and standard deviation for the given grouped data. (10 marks)",
        ],
      },
      {
        title: "Business Statistics End-Term 2023",
        year: 2023,
        lines: [
          "Q1. State and prove Bayes' Theorem with an example. (10 marks)",
          "Q2. Explain the properties of the Normal Distribution. (8 marks)",
          "Q3. Distinguish between Binomial and Poisson distributions. (8 marks)",
        ],
      },
      {
        title: "Business Statistics End-Term 2024",
        year: 2024,
        lines: [
          "Q1. State and prove Bayes' Theorem with an example. (10 marks)",
          "Q2. Explain the Central Limit Theorem with an example. (10 marks)",
          "Q3. Calculate the Karl Pearson coefficient of correlation for given data. (10 marks)",
        ],
      },
    ],
    questions: [
      {
        q: "State and prove Bayes' Theorem with an example.",
        a: "Bayes' Theorem gives the probability of an event A given that event B has occurred: P(A|B) = [P(B|A) x P(A)] / P(B). For example, if 1% of a population has a disease, and a test is 95% accurate, Bayes' Theorem is used to calculate the probability that a person who tests positive actually has the disease, accounting for false positives.",
        marks: 10,
        isRepeated: true,
        repeatCount: 3,
        years: "2022, 2023, 2024",
      },
      {
        q: "Distinguish between Binomial and Poisson distributions.",
        a: "The Binomial distribution models the number of successes in a fixed number of independent trials, each with the same probability of success. The Poisson distribution models the number of events occurring in a fixed interval of time or space, and is often used as an approximation to the Binomial when the number of trials is large and the probability of success is small.",
        marks: 8,
        isRepeated: true,
        repeatCount: 2,
        years: "2022, 2023",
      },
      {
        q: "Explain the properties of the Normal Distribution.",
        a: "The Normal distribution is symmetric and bell-shaped, with mean, median, and mode all equal. It is fully described by its mean and standard deviation, follows the empirical rule (68-95-99.7%), and the total area under its curve equals 1.",
        marks: 8,
      },
      {
        q: "Calculate the Karl Pearson coefficient of correlation for given data.",
        a: "Karl Pearson's coefficient of correlation r = covariance(X,Y) / (standard deviation of X x standard deviation of Y). It measures the strength and direction of the linear relationship between two variables, ranging from -1 (perfect negative correlation) to +1 (perfect positive correlation).",
        marks: 10,
      },
    ],
  });

  await seedSubject(terms[4], {
    name: "Cost Accounting",
    description: "Costing methods, cost classification, and cost control techniques.",
    notes: [
      {
        title: "Unit 1 - Introduction to Cost Accounting",
        lines: [
          "Cost accounting classifies, records, and analyses costs to help management",
          "with planning, control, and decision-making, unlike financial accounting",
          "which reports overall financial performance to external stakeholders.",
        ],
      },
      {
        title: "Unit 2 - Methods of Costing",
        lines: [
          "Covers Job Costing, Process Costing, and Contract Costing, with worked",
          "examples for computing cost per unit and cost sheets.",
        ],
      },
    ],
    pyqs: [
      {
        title: "Cost Accounting End-Term 2023",
        year: 2023,
        lines: [
          "Q1. Distinguish between Cost Accounting and Financial Accounting. (5 marks)",
          "Q2. Explain the various methods of costing with examples. (10 marks)",
          "Q3. Prepare a cost sheet from the following data. (10 marks)",
        ],
      },
    ],
    questions: [
      {
        q: "Distinguish between Cost Accounting and Financial Accounting.",
        a: "Cost Accounting focuses on ascertaining and controlling costs for internal management decisions, is not mandatory for all firms, and can be prepared at any frequency. Financial Accounting focuses on reporting overall profit or loss to external stakeholders, is mandatory, and follows a fixed annual reporting cycle.",
        marks: 5,
        isRepeated: true,
        repeatCount: 2,
        years: "2022, 2023",
      },
      {
        q: "Explain the various methods of costing with examples.",
        a: "Job Costing is used where production is carried out against specific orders (e.g. furniture making). Process Costing is used for continuous, standardised production (e.g. chemicals, textiles). Contract Costing is used for large-scale, long-duration projects such as construction contracts.",
        marks: 10,
        isRepeated: true,
        repeatCount: 2,
        years: "2023, 2024",
      },
    ],
  });

  await seedSubject(terms[5], {
    name: "Entrepreneurship",
    description: "Foundations of entrepreneurship, opportunity recognition, and venture creation.",
    notes: [
      {
        title: "Unit 1 - What is Entrepreneurship",
        lines: [
          "Entrepreneurship is the process of identifying, evaluating, and exploiting",
          "opportunities to create value, often under conditions of uncertainty and",
          "resource constraints.",
        ],
      },
      {
        title: "Unit 2 - Necessity vs Opportunity-Based Entrepreneurship",
        lines: [
          "Necessity-based entrepreneurship arises when individuals start a venture",
          "due to a lack of other employment options, while opportunity-based",
          "entrepreneurship arises from actively identifying and pursuing a market gap.",
        ],
      },
    ],
    pyqs: [
      {
        title: "Entrepreneurship Mid-Term 2024",
        year: 2024,
        lines: [
          "Q1. Define entrepreneurship and distinguish necessity-based from opportunity-based entrepreneurship. (10 marks)",
          "Q2. What are the common ways of starting a new venture? (8 marks)",
        ],
      },
    ],
    questions: [
      {
        q: "Define entrepreneurship and distinguish necessity-based from opportunity-based entrepreneurship.",
        a: "Entrepreneurship is the process of identifying and exploiting opportunities to create value under uncertainty. Necessity-based entrepreneurship is driven by a lack of alternative employment, while opportunity-based entrepreneurship is driven by deliberately recognising and pursuing an unmet market need.",
        marks: 10,
        isRepeated: true,
        repeatCount: 2,
        years: "2023, 2024",
      },
      {
        q: "What are the common ways of starting a new venture?",
        a: "Common routes include starting a venture from scratch, acquiring an existing business, taking a franchise, or entering through a strategic partnership or licensing arrangement, each with different trade-offs in risk, capital requirement, and speed to market.",
        marks: 8,
      },
    ],
  });

  // ---------------- School: CBSE Class 12 Commerce ----------------
  const cbse = await prisma.program.create({
    data: {
      level: "SCHOOL",
      name: "CBSE Class 12 (Commerce)",
      slug: "cbse-class-12-commerce",
      summary: "Business Studies, Accountancy, and Economics for CBSE Class 12 Commerce.",
    },
  });
  const cbseTerm = await prisma.term.create({
    data: { programId: cbse.id, name: "Full Year", order: 1 },
  });

  await seedSubject(cbseTerm.id, {
    name: "Business Studies",
    description: "Principles and functions of management for Class 12 CBSE.",
    notes: [
      {
        title: "Chapter 2 - Principles of Management",
        lines: [
          "Covers Henri Fayol's 14 principles of management and F.W. Taylor's",
          "principles of scientific management, with comparisons and applications.",
        ],
      },
    ],
    pyqs: [
      {
        title: "CBSE Business Studies Board Paper 2023",
        year: 2023,
        lines: [
          "Q1. Explain any five principles of management given by Fayol. (5 marks)",
          "Q2. What is meant by 'Directing' as a function of management? (3 marks)",
        ],
      },
    ],
    questions: [
      {
        q: "Explain any five principles of management given by Fayol.",
        a: "Key principles include Division of Work (specialisation improves efficiency), Unity of Command (each employee reports to one superior), Unity of Direction (one plan for a group of activities with the same objective), Discipline (obedience to agreed rules), and Espirit de Corps (promoting team spirit).",
        marks: 5,
        isRepeated: true,
        repeatCount: 3,
        years: "2021, 2022, 2023",
      },
      {
        q: "What is meant by 'Directing' as a function of management?",
        a: "Directing is the management function of instructing, guiding, motivating, and supervising employees so that organisational objectives are achieved. It includes supervision, motivation, leadership, and communication.",
        marks: 3,
      },
    ],
  });

  await seedSubject(cbseTerm.id, {
    name: "Accountancy",
    description: "Partnership accounts, company accounts, and financial statement analysis.",
    notes: [
      {
        title: "Chapter 3 - Admission of a Partner",
        lines: [
          "Explains treatment of goodwill, revaluation of assets and liabilities,",
          "and adjustment of capital accounts on admission of a new partner.",
        ],
      },
    ],
    pyqs: [
      {
        title: "CBSE Accountancy Board Paper 2024",
        year: 2024,
        lines: [
          "Q1. Explain the accounting treatment of goodwill on admission of a partner. (6 marks)",
          "Q2. Prepare a Cash Flow Statement from the given information. (8 marks)",
        ],
      },
    ],
    questions: [
      {
        q: "Explain the accounting treatment of goodwill on admission of a partner.",
        a: "On admission, the new partner compensates old partners for the share of goodwill acquired, either by bringing in goodwill in cash (credited to old partners in the sacrificing ratio) or through an adjustment entry in the partners' capital accounts when goodwill is not brought in cash.",
        marks: 6,
        isRepeated: true,
        repeatCount: 2,
        years: "2023, 2024",
      },
    ],
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
