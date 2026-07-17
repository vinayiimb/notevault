// Additive seed for the wider DU UGCF programme list (semester-wise subject
// spreadsheet). Skips B.Com (Hons.) entirely since a fuller, code-accurate
// version of that programme already exists from the official syllabus seed —
// re-adding a shallower version here would just create a confusing duplicate.
//
// Safe to re-run: every create is guarded by a lookup first (by program slug,
// then by term order, then by subject name within the term).
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

type ProgramSpec = {
  name: string;
  slug: string;
  semesters: string[][]; // index 0 = Semester 1
};

const PROGRAMS: ProgramSpec[] = [
  {
    name: "B.A. (Programme)",
    slug: "ba-programme",
    semesters: [
      ["Discipline A Paper 1", "Discipline B Paper 1", "Minor Paper 1"],
      ["Discipline A Paper 2", "Discipline B Paper 2", "Minor Paper 2"],
      ["Discipline A Paper 3", "Discipline B Paper 3", "Minor Paper 3"],
      ["Discipline A Paper 4", "Discipline B Paper 4", "Minor Paper 4"],
      ["Discipline A Paper 5", "Discipline B Paper 5", "Minor Paper 5"],
      ["Discipline A Paper 6", "Discipline B Paper 6", "Minor Paper 6"],
    ],
  },
  {
    name: "B.A. (Hons.) Economics",
    slug: "ba-hons-economics",
    semesters: [
      [
        "HC11 — Mathematical Methods for Economics I",
        "HC12 — Introductory Microeconomics",
        "GE — Art of Communication",
      ],
      [
        "HC21 — Mathematical Methods for Economics II",
        "HC22 — Introductory Macroeconomics",
        "GE — Environmental Science",
      ],
      [
        "HC31 — Intermediate Microeconomics I",
        "HC32 — Intermediate Macroeconomics I",
        "HC33 — Statistical Methods for Economics / Data Analysis (HS31) / GE",
      ],
      [
        "HC41 — Intermediate Microeconomics II",
        "HC42 — Intermediate Macroeconomics II",
        "HC43 — Introductory Econometrics / Research Methodology (HS41) / Contemporary Economic Issues",
      ],
      [
        "HC51 — Indian Economy I",
        "HC52 — Development Economics I",
        "DSE — Choose two from HE51 to HE57 (e.g. Game Theory)",
      ],
      [
        "HC61 — Indian Economy II",
        "HC62 — Development Economics II",
        "DSE — Choose two from HE62 to HE68 (e.g. Economics of Health)",
      ],
    ],
  },
  {
    name: "B.A. (Hons.) English",
    slug: "ba-hons-english",
    semesters: [
      ["Indian Classical Literature", "European Classical Literature", "AECC / Generic Elective (GE)"],
      ["Indian Writing in English", "British Poetry and Drama (14th-17th C)", "AECC / Generic Elective (GE)"],
      ["American Literature", "Popular Literature / British Poetry & Drama (17th-18th C)", "SEC / Generic Elective (GE)"],
      ["British Literature: 18th Century", "British Romantic Literature / British Literature: 19th C", "SEC / Generic Elective (GE)"],
      ["Women's Writing", "British Literature: The Early 20th Century", "DSE-1 / DSE-2"],
      ["Modern European Drama", "Postcolonial Literatures", "DSE-3 / DSE-4"],
    ],
  },
  {
    name: "B.A. (Hons.) Hindi",
    slug: "ba-hons-hindi",
    semesters: [
      ["Hindi Bhasha aur Uski Lipi ka Itihas", "Hindi Kavita (Aadikal evam Bhaktikal)", "Hindi Sahitya ka Itihas (Aadikal aur Madhyakal)"],
      ["Hindi Sahitya ka Itihas (Aadhunik Kaal)", "Hindi Kavita (Ritikal)", "Hindi Natak aur Ekanki"],
      ["Hindi Kahani", "Hindi Upanyas", "Hindi Nibandh aur Anya Gadya Vidhayein"],
      ["Bharatiya Kavyashastra", "Paschatya Kavyashastra", "Hindi Bhasha: Vyavaharik Vyakaran"],
      ["Hindi Patrakarita", "Chhayavad", "Lok Sahitya"],
      ["Chhayavadottar Kavita", "Prayojanmulak Hindi", "Media Lekhan"],
    ],
  },
  {
    name: "B.A. (Hons.) History",
    slug: "ba-hons-history",
    semesters: [
      ["History of India-I (C 1)", "Social Formations & Cultural Patterns of Ancient World (C 2)", "English/MIL / EVS / GE: Delhi Through Ages OR History of Science"],
      ["History of India-II (C 3)", "Social Formations & Cultural Patterns, Ancient & Medieval (C 4)", "English/MIL / EVS / GE: Issues in Contemporary World OR Cultural Diversity"],
      ["History of India-III c. 750-1200 (C 5) / Rise of Modern West-I (C 6) / History of India-IV (C 7)", "SEC: Understanding Heritage OR Archives and Museums", "GE: Perspectives on Environmental History OR Making of Contemporary India"],
      ["Rise of Modern West-II (C 8) / History of India-V (C 9) / History of India-VI (C 10)", "SEC: Indian Art & Architecture OR Understanding Popular Culture", "GE: Religion and Religiosity OR Inequality and Difference"],
      ["History of Modern Europe-I (C 11) / History of India-VII (C 12)", "DSE 1: History of USA OR USSR OR Africa OR Gender up to 1500", "DSE 2: History of Modern China OR Southeast Asia OR Global Environment"],
      ["History of India-VIII (C 13) / History of Modern Europe-II (C 14)", "DSE 3: History of USA OR USSR OR Latin America OR Gender c. 1500-1950", "DSE 4: History of Modern Japan & Korea OR Modern Southeast Asia OR Contemporary India"],
    ],
  },
  {
    name: "B.A. (Hons.) Political Science",
    slug: "ba-hons-political-science",
    semesters: [
      ["Understanding Political Theory", "Ideas and Institutions in Indian Political Thought", "Colonialism and Nationalism in India"],
      ["Political Theory: Concepts and Debates", "Political Process in India", "Introduction to Comparative Government"],
      ["Perspectives on Public Administration", "Perspectives on International Relations", "Ancient Indian Political Thought"],
      ["Political Processes in Comparative Perspective", "Public Policy in India", "Global Politics"],
      ["Classical Political Philosophy", "Modern Indian Political Thought-I", "Human Rights in a Comparative Perspective"],
      ["Modern Political Philosophy", "Modern Indian Political Thought-II", "India's Foreign Policy"],
    ],
  },
  {
    name: "B.A. (Hons.) Sanskrit",
    slug: "ba-hons-sanskrit",
    semesters: [
      ["Classical Sanskrit Literature (Poetry)", "Critical Survey of Sanskrit Literature", "Sanskrit Composition"],
      ["Classical Sanskrit Literature (Prose)", "Self-Management in the Gita", "Sanskrit Grammar"],
      ["Classical Sanskrit Literature (Drama)", "Poetics and Literary Criticism", "Indian Social Institutions"],
      ["Indian Epigraphy and Chronology", "Modern Sanskrit Literature", "Sanskrit and World Literature"],
      ["Vedic Literature", "Indian Grammar", "Ontology and Epistemology"],
      ["Indian Architectural System", "Ayurveda", "Indian Linguistics"],
    ],
  },
  {
    name: "B.A. (Hons.) Sociology",
    slug: "ba-hons-sociology",
    semesters: [
      ["Introduction to Sociology I", "Sociology of India I", "Sociological Thinkers I"],
      ["Introduction to Sociology II", "Sociology of India II", "Sociological Thinkers II"],
      ["Political Sociology", "Sociology of Religion", "Sociology of Gender"],
      ["Economic Sociology", "Sociology of Kinship", "Social Stratification"],
      ["Sociological Research Methods I", "Urban Sociology", "Agrarian Sociology"],
      ["Sociological Research Methods II", "Environmental Sociology", "Visual Culture"],
    ],
  },
  {
    name: "B.Com. (Programme)",
    slug: "bcom-programme",
    semesters: [
      [
        "DSC-1.1 — Business Organisation and Management",
        "DSC-1.2 — Business Laws",
        "DSC-1.3 — Financial Accounting",
        "SEC-1.1 — Business Communication",
        "SEC-1.2 — Finance for Everyone",
        "SEC-1.3 — Fundamentals of Marketing",
      ],
      [
        "DSC-2.1 — Corporate Accounting",
        "DSC-2.2 — Company Law",
        "DSC-2.3 — Human Resource Management",
        "SEC-2.1 — Personality Development",
        "SEC-2.2 — Personal Financial Planning",
        "SEC-2.3 — Social Media Marketing",
        "SEC-2.4 — Financial Reporting Analysis and Valuation",
      ],
      [
        "DSC-3.1 — Business Statistics",
        "DSC-3.2 — Fundamentals of Financial Management",
        "DSC-3.3 — Principles of Marketing",
        "SEC-3.1 — Team Building",
        "SEC-3.2 — Advanced Spreadsheet Applications in Business",
        "SEC-3.3 — E-Commerce",
      ],
      [
        "DSC-4.1 — Entrepreneurship and New Venture Planning",
        "DSC-4.2 — Cost Accounting",
        "DSC-4.3 — International Business",
        "SEC-4.1 — Emotional Intelligence",
        "SEC-4.2 — Data Visualisation",
        "SEC-4.3 — Customer Relationship Management",
        "SEC-4.4 — Analysis of Financial Statements",
        "SEC-4.5 — Cyber Crimes and Laws",
      ],
      [
        "DSC-5.1 — Income-Tax Law and Practice",
        "DSC-5.2 — Business Economics",
        "DSC-5.3 — Management Accounting",
        "SEC-5.1 — Social Media Analytics",
        "SEC-5.2 — Banking and Insurance",
        "SEC-5.3 — Personal Selling",
        "SEC-5.4 — EXIM Procedures and Documentation",
        "DSE Pool — 10 Options (e.g. Organization Behaviour)",
        "GE Pool — 10 Options (e.g. General Management)",
      ],
      [
        "DSC-6.1 — Business Analytics",
        "DSC-6.2 — Corporate Governance",
        "DSC-6.3 — GST and Customs Law",
        "SEC-6.1 — Artificial Intelligence in Business",
        "SEC-6.2 — Sales Promotions and Public Relations",
        "SEC-6.3 — Forensic Accounting and Fraud Detection",
        "SEC-6.4 — International Trade Logistics",
        "SEC-6.5 — Investing in Stock Markets",
        "SEC-6.6 — E-Filing of Returns",
        "DSE Pool — 8 Options (e.g. Human Resource Development)",
        "GE Pool — 5 Options (e.g. Business Organisation)",
      ],
      [
        "DSC-7.1 — Business and Macroeconomic Policy",
        "DSE Pool — 13 Options (e.g. Performance Management)",
        "GE Pool — 11 Options (e.g. Fundamentals of HRM)",
      ],
      [
        "DSC-8.1 — The Economy of Bharat",
        "DSE Pool — 10 Options (e.g. Compensation Management)",
        "GE Pool — 7 Options (e.g. Basics of Organisational Behaviour)",
      ],
    ],
  },
  {
    name: "B.Sc. (Programme) Life Science",
    slug: "bsc-programme-life-science",
    semesters: [
      ["Chemistry I / Computer Science I / Electronics I (CHPT/CSPT/ELPT-101)", "Physics I (PHPT-101)", "Maths I / Technical Writing / Computational Skills"],
      ["Chemistry II / Computer Science II / Electronics II", "Physics II", "Maths II / Technical Writing / EVS"],
      ["Chemistry III / Computer Science III / Electronics III", "Physics III", "Maths III / Biology I (LSPT-101)"],
      ["Chemistry IV / Computer Science IV / Electronics IV", "Physics IV", "Maths IV / Biology II (LSPT-202)"],
      ["Chemistry V / Computer Science V / Electronics V", "Physics V", "Maths V / Concurrent Course-I"],
      ["Chemistry VI / Computer Science VI / Electronics VI", "Physics VI", "Maths VI / Concurrent Course-II"],
    ],
  },
  {
    name: "B.Sc. (Programme) Physical Science",
    slug: "bsc-programme-physical-science",
    semesters: [
      ["Mechanics", "Atomic Structure and Chemical Bonding", "Calculus and Matrices"],
      ["Electricity and Magnetism", "States of Matter and Chemical Kinetics", "Calculus and Geometry"],
      ["Thermal Physics and Statistical Mechanics", "Solutions and Phase Equilibrium", "Algebra"],
      ["Waves and Optics", "Chemistry of s- and p-Block Elements", "Real Analysis"],
      ["Digital and Analog Instrumentation", "Organic Chemistry", "Differential Equations"],
      ["Solid State Physics", "Organometallics and Bioinorganic Chemistry", "Numerical Methods"],
    ],
  },
  {
    name: "B.Sc. (Hons.) Botany",
    slug: "bsc-hons-botany",
    semesters: [
      ["Microbiology and Phycology", "Biomolecules and Cell Biology", "Mycology and Phytopathology"],
      ["Archegoniatae", "Anatomy of Angiosperms", "Plant Ecology and Phytogeography"],
      ["Morphology of Angiosperms", "Genetics", "Plant Systematics"],
      ["Molecular Biology", "Ecology", "Plant Physiology"],
      ["Reproductive Biology of Angiosperms", "Plant Physiology", "Plant Metabolism"],
      ["Plant Biotechnology", "Analytical Techniques in Plant Sciences", "Biostatistics"],
    ],
  },
  {
    name: "B.Sc. (Hons.) Chemistry",
    slug: "bsc-hons-chemistry",
    semesters: [
      ["Inorganic Chemistry I", "Physical Chemistry I", "Organic Chemistry I"],
      ["Organic Chemistry II", "Physical Chemistry II", "Inorganic Chemistry II"],
      ["Physical Chemistry III", "Inorganic Chemistry III", "Organic Chemistry III"],
      ["Inorganic Chemistry IV", "Organic Chemistry IV", "Physical Chemistry IV"],
      ["Organic Chemistry V", "Physical Chemistry V", "Quantum Chemistry"],
      ["Inorganic Chemistry V", "Organic Chemistry VI", "Spectroscopy"],
    ],
  },
  {
    name: "B.Sc. (Hons.) Mathematics",
    slug: "bsc-hons-mathematics",
    semesters: [
      ["Calculus", "Algebra", "Analytic Geometry"],
      ["Real Analysis", "Differential Equations", "Discrete Mathematics"],
      ["Theory of Real Functions", "Group Theory I", "Multivariate Calculus"],
      ["Partial Differential Equations", "Riemann Integration", "Ring Theory and Linear Algebra I"],
      ["Metric Spaces", "Group Theory II", "Numerical Methods"],
      ["Complex Analysis", "Ring Theory and Linear Algebra II", "Probability Theory and Statistics"],
    ],
  },
  {
    name: "B.Sc. (Hons.) Physics",
    slug: "bsc-hons-physics",
    semesters: [
      ["Mathematical Physics I", "Mechanics", "Waves and Optics"],
      ["Electricity and Magnetism", "Mathematical Physics II", "Thermal Physics"],
      ["Mathematical Physics III", "Digital Systems", "Analog Systems"],
      ["Quantum Mechanics", "Solid State Physics", "Statistical Mechanics"],
      ["Electromagnetic Theory", "Advanced Mathematical Physics", "Nuclear and Particle Physics"],
      ["Advanced Quantum Mechanics", "Atomic and Molecular Physics", "Experimental Physics"],
    ],
  },
  {
    name: "B.Sc. (Hons.) Zoology",
    slug: "bsc-hons-zoology",
    semesters: [
      ["Non-chordates I: Protista to Pseudocoelomates", "Principles of Ecology", "AECC: English/Hindi/MIL / EVS / GE-1"],
      ["Non-chordates II: Coelomates", "Cell Biology", "AECC: English/Hindi/MIL / EVS / GE-2"],
      ["Diversity of Chordates", "Physiology: Controlling and Coordinating Systems", "Fundamentals of Biochemistry / SEC-1 / GE-3"],
      ["Comparative Anatomy of Vertebrates", "Physiology: Life Sustaining Systems", "Biochemistry of Metabolic Processes / SEC-2 / GE-4"],
      ["Molecular Biology", "Principles of Genetics", "DSE-1 / DSE-2"],
      ["Developmental Biology", "Evolutionary Biology", "DSE-3 / DSE-4"],
    ],
  },
  {
    name: "B.Sc. (Hons.) Computer Science",
    slug: "bsc-hons-computer-science",
    semesters: [
      ["Programming Fundamentals using C++", "Computer System Architecture", "Generic Elective 1 (GE-1)"],
      ["Programming in Java", "Discrete Structure", "Generic Elective 2 (GE-2)"],
      ["Data Structures / Operating System", "Computer Networks", "SEC-1 / Generic Elective 3 (GE-3)"],
      ["Design and Analysis of Algorithms / Software Engineering", "Database Management Systems", "SEC-2 / Generic Elective 4 (GE-4)"],
      ["Internet Technologies", "Theory of Computation", "DSE-1 / DSE-2"],
      ["Artificial Intelligence", "Computer Graphics", "DSE-3 / DSE-4"],
    ],
  },
  {
    name: "B.A. / B.Sc. (Hons.) Geography",
    slug: "ba-bsc-hons-geography",
    semesters: [
      ["Geomorphology (Core)", "Cartographic Techniques (Practical)", "GE: Disaster Management / Geography of Tourism"],
      ["Human Geography (Core)", "Thematic Cartography (Practical)", "GE: Spatial Information Technology / Coupled Human System"],
      ["Climatology / Statistical Methods / Geography of India", "SEC: GIS / Advanced Spatial Statistics", "GE: Climate Change / Rural Development"],
      ["Economic Geography / Environmental Geography / Field Work", "SEC: Introduction to GIScience / Thematic Atlas", "GE: Industrial Development Sustainable / Resource Development"],
      ["Regional Planning / Remote Sensing & GIS", "DSE: Demography / Hydrology / Urbanization / Agriculture"],
      ["Evolution of Geographical Thought / Disaster Management Project", "DSE: Health / Political Geography / Biogeography / Social Wellbeing"],
    ],
  },
];

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

async function main() {
  for (const spec of PROGRAMS) {
    let program = await prisma.program.findUnique({ where: { slug: spec.slug } });
    if (!program) {
      program = await prisma.program.create({
        data: { slug: spec.slug, name: spec.name, level: "COLLEGE" },
      });
      console.log("Created programme:", program.name);
    } else {
      console.log("Programme already exists, adding any missing terms/subjects:", program.name);
    }

    for (let i = 0; i < spec.semesters.length; i++) {
      const order = i + 1;
      let term = await prisma.term.findUnique({
        where: { programId_order: { programId: program.id, order } },
      });
      if (!term) {
        term = await prisma.term.create({
          data: { programId: program.id, order, name: `Semester ${order}` },
        });
      }

      for (const paperName of spec.semesters[i]) {
        const existing = await prisma.subject.findFirst({
          where: { termId: term.id, name: paperName },
        });
        if (existing) continue;
        const slug = await uniqueSlug(paperName, async (s) => {
          const found = await prisma.subject.findUnique({
            where: { termId_slug: { termId: term!.id, slug: s } },
          });
          return !!found;
        });
        await prisma.subject.create({ data: { termId: term.id, name: paperName, slug } });
      }
    }
  }
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
