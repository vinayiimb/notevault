// Additive seed: the university-wide SEC / VAC / AEC elective pools (offered
// "All Semesters", not tied to one specific term) into the shared Common Pool
// programme created by fix-vac-common-pool.ts. VAC items already seeded there
// under Semester 2 (from real admin uploads) are skipped here to avoid dupes.
//
// Safe to re-run: every create is guarded by a lookup first.
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

const POOL_SLUG = "common-pool-vac-aec-sec-ge";
const ALL_SEMESTERS_ORDER = 0;

const SEC_POOL = [
  "Beginners Course to Calligraphy",
  "Communication in Everyday Life",
  "Communication in Professional Life",
  "Creative Writing",
  "Business Communication",
  "Introduction to Arabic Calligraphy",
  "Negotiation and Leadership",
  "Personality Development and Communication",
  "Political Communication and Leadership",
  "Public Speaking in English Language and Leadership",
  "Patkatha Lekhan",
  "Rangmanch",
  "Rachnatmak Lekhan",
  "Anuvad Kala",
  "Srijnatmak Lekhan",
  "IT Skills and Data Analysis – I",
  "IT Skills and Data Analysis – II",
  "Basic IT Tools",
  "Advanced Spreadsheet Tools",
  "Statistical Software Package",
  "Financial Database and Analysis Software",
  "Statistics with R",
  "R Programming for Business Analytics",
  "Essentials of Python",
  "Analytics with Python",
  "Business Intelligence and Data Visualisation",
  "Digital Marketing",
  "Social Media Marketing",
  "Digital Film Production",
  "Visual Communication and Photography",
  "CAD for Fashion",
  "Graphics Design & Animation",
  "Programming using Python",
  "Document Preparation & Presentation Software",
  "Front End Web Design and Development",
  "Back-End Web Development",
  "App Development using Flutter",
  "Big Data Analytics-I",
  "Big Data Analytics-II",
  "Introduction to Blockchain",
  "Introduction to Cloud Computing (AWS)",
  "Biofertilizers",
  "Bioinoculants for Agriculture and Sustainable Development",
  "Organic Farming",
  "Horticulture",
  "Floriculture",
  "Hydroponic and Aeroponic Farming",
  "Green Belt Development for Smart Cities",
  "Nursery Gardening and Landscaping",
  "Mushroom Culture and Technology-I",
  "Mushroom Culture and Technology-II",
  "Plant Aromatics and Perfumery",
  "Viewing and Capturing Diversity in Nature",
  "Apiculture",
  "Formulation of Fish Feed",
  "Fish Breeding and Larviculture",
  "Ornamental Fish Culture: Opportunity and Scope",
  "Bio-floc Technology",
  "Aquaculture Entrepreneurship",
  "Pearl Culture",
  "Sericulture-I: Mulberry Silkworm Rearing",
  "Sericulture-II: Eri Silkworm Rearing",
  "Sericulture-III: Silk Technology",
  "Sericulture-IV: Therapeutic and Cosmetic Industry",
  "Chemistry Lab Operations and Safety Measures",
  "Basic Analytical Techniques",
  "Lab Testing and Quality Assurance",
  "Essential Food Nutrients",
  "Chemistry of Food Flavors and Colourants",
  "Chemistry of Cosmetics and Hygiene Products",
  "Green Methods in Chemistry",
  "Forensic Chemistry",
  "Environmental Impact and Risk Assessment",
  "Sustainability Reporting",
  "Environmental Auditing",
  "Prospecting E-Waste for Sustainability",
  "Developing Sustainability Plans for a Business",
  "PCB Designing and Fabrication",
  "Electronic Product Testing",
  "Radiation Safety",
  "Healthy and Sustainable Food Choices",
  "Chocolate Crafts",
  "Pasta and Patisserie Technology",
  "Frozen Dessert Technology",
  "Early Child Care and Education Settings",
  "Image Styling",
  "Content Development and Media for Children",
  "Small Scale Catering",
  "Culinary Science",
  "Dairy Processing",
  "Fruits and Vegetable Processing",
  "Minimal Food Processing",
  "Food Waste and By-Product Utilisation",
  "Indian Snack Industry",
  "Sustainable Ecotourism and Entrepreneurship",
  "E Tourism",
  "Design Thinking",
  "Innovation and Entrepreneurship",
  "Museum and Museology",
  "Reading the Archive",
  "Working with People",
  "Life Skill Education",
  "Participatory Learning and Action",
  "Programme Media",
  "Finance for Everyone",
  "Personal Financial Planning",
  "Yoga in Practice",
  "Cyber Sphere and Security Global Concerns",
  "Harmonium",
];

// Items already covered (possibly under slightly different spelling) by
// fix-vac-common-pool.ts's Semester-2 seed: Art of Being Happy, Ayurveda &
// Nutrition, Culture & Communication, Emotional Intelligence, Ethics &
// Culture, Financial Literacy, Gandhi & Education, Panchkosha, Sahitya
// Sanskriti aur Cinema, Science & Society, Social & Emotional Learning,
// Swachh Bharat, Vedic Mathematics I, Yoga Philosophy & Practice, Bhartiya
// Bhakti Parampara aur Manav Mulya.
const VAC_POOL_NEW = [
  "Constitutional Values and Fundamental Duties",
  "Digital Empowerment",
  "Ecology and Literature",
  "Ethics and Values in Ancient Indian Traditions",
  "Fit India",
  "NCC 1",
  "Reading Indian Fiction in English",
  "Sports for Life 1",
  "Srijanatmak Lekhan ke Ayam",
];

const AEC_POOL = [
  "Punjabi Bhasha da Mudhla Padhar",
  "Punjabi Bhasha da Uchera Padhar",
  "Translation and Interpretation in Assamese",
  "Translation and Interpretation in Bengali",
  "Translation and Interpretation in Bodo",
  "Translation and Interpretation in Dogri",
  "Translation and Interpretation in Gujarati",
  "Translation and Interpretation in Kannada",
  "Translation and Interpretation in Kashmiri",
  "Translation and Interpretation in Konkani",
  "Translation and Interpretation in Malayalam",
  "Translation and Interpretation in Manipuri",
  "Translation and Interpretation in Marathi",
  "Translation and Interpretation in Maithili",
  "Translation and Interpretation in Nepali",
  "Translation and Interpretation in Odia",
  "Translation and Interpretation in Santali",
  "Translation and Interpretation in Sindhi",
  "Translation and Interpretation in Tamil",
  "Translation and Interpretation in Telugu",
  "Basic Assamese",
  "Basic Bengali",
  "Basic Bodo",
  "Basic Dogri",
  "Basic Gujarati",
  "Basic Kannada",
  "Basic Kashmiri",
  "Basic Konkani",
  "Basic Malayalam",
  "Basic Manipuri",
  "Basic Marathi",
  "Basic Maithili",
  "Basic Nepali",
  "Basic Odia",
  "Basic Santali",
  "Basic Sindhi",
  "Basic Tamil",
  "Basic Telugu",
  "Environmental Science - Theory into Practice",
  "Hindi Bhasha - Sampreshan aur Sanchar",
  "Hindi Aupcharik Lekhan",
  "Social Media aur Blog Lekhan",
  "Sanskrit A - Advanced Neeti Literature",
  "Sanskrit B - Introductory Upanishad and Gita",
  "Sanskrit C - Introduction to Sanskrit Language",
  "Urdu A (12th with Urdu)",
  "Urdu B (10th with Urdu)",
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
  const pool = await prisma.program.findUnique({ where: { slug: POOL_SLUG } });
  if (!pool) {
    throw new Error(
      `Common Pool programme not found (slug: ${POOL_SLUG}). Run fix-vac-common-pool.ts first.`
    );
  }

  let allSemestersTerm = await prisma.term.findUnique({
    where: { programId_order: { programId: pool.id, order: ALL_SEMESTERS_ORDER } },
  });
  if (!allSemestersTerm) {
    allSemestersTerm = await prisma.term.create({
      data: { programId: pool.id, order: ALL_SEMESTERS_ORDER, name: "All Semesters" },
    });
    console.log("Created term: All Semesters");
  }

  const groups: Array<[string, string[]]> = [
    ["SEC", SEC_POOL],
    ["VAC", VAC_POOL_NEW],
    ["AEC", AEC_POOL],
  ];

  for (const [label, names] of groups) {
    let created = 0;
    for (const name of names) {
      const existing = await prisma.subject.findFirst({
        where: { termId: allSemestersTerm.id, name },
      });
      if (existing) continue;
      const slug = await uniqueSlug(name, async (s) => {
        const found = await prisma.subject.findUnique({
          where: { termId_slug: { termId: allSemestersTerm!.id, slug: s } },
        });
        return !!found;
      });
      await prisma.subject.create({ data: { termId: allSemestersTerm.id, name, slug } });
      created++;
    }
    console.log(`${label}: created ${created} / ${names.length} subject(s)`);
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
