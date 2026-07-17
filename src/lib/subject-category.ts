// Best-effort classification of a subject into DU's paper-type buckets
// (DSC / DSE / GE / SEC / VAC / AEC), for grouping the student-facing
// subject list under tabs. Subjects don't carry an explicit category field —
// this infers it from naming convention (e.g. "DSC-6.2 — ...") plus known
// name lists for the Common Pool electives (see prisma/seed-elective-pools.ts
// and prisma/fix-vac-common-pool.ts, which is where these names come from).
export type SubjectCategory = "DSC" | "DSE" | "GE" | "SEC" | "VAC" | "AEC" | "CORE";

export const CATEGORY_LABELS: Record<SubjectCategory, string> = {
  DSC: "DSC",
  DSE: "DSE",
  GE: "GE",
  SEC: "SEC",
  VAC: "VAC",
  AEC: "AEC",
  CORE: "Core",
};

// Order tabs should render in.
export const CATEGORY_ORDER: SubjectCategory[] = ["CORE", "DSC", "DSE", "GE", "SEC", "VAC", "AEC"];

const KNOWN_VAC = new Set([
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
  "Constitutional Values and Fundamental Duties",
  "Digital Empowerment",
  "Ecology and Literature",
  "Ethics and Values in Ancient Indian Traditions",
  "Fit India",
  "NCC 1",
  "Reading Indian Fiction in English",
  "Sports for Life 1",
  "Srijanatmak Lekhan ke Ayam",
]);

const KNOWN_SEC = new Set([
  "Beginners Course to Calligraphy", "Communication in Everyday Life", "Communication in Professional Life",
  "Creative Writing", "Business Communication", "Introduction to Arabic Calligraphy", "Negotiation and Leadership",
  "Personality Development and Communication", "Political Communication and Leadership",
  "Public Speaking in English Language and Leadership", "Patkatha Lekhan", "Rangmanch", "Rachnatmak Lekhan",
  "Anuvad Kala", "Srijnatmak Lekhan", "IT Skills and Data Analysis – I", "IT Skills and Data Analysis – II",
  "Basic IT Tools", "Advanced Spreadsheet Tools", "Statistical Software Package",
  "Financial Database and Analysis Software", "Statistics with R", "R Programming for Business Analytics",
  "Essentials of Python", "Analytics with Python", "Business Intelligence and Data Visualisation",
  "Digital Marketing", "Social Media Marketing", "Digital Film Production", "Visual Communication and Photography",
  "CAD for Fashion", "Graphics Design & Animation", "Programming using Python",
  "Document Preparation & Presentation Software", "Front End Web Design and Development",
  "Back-End Web Development", "App Development using Flutter", "Big Data Analytics-I", "Big Data Analytics-II",
  "Introduction to Blockchain", "Introduction to Cloud Computing (AWS)", "Biofertilizers",
  "Bioinoculants for Agriculture and Sustainable Development", "Organic Farming", "Horticulture", "Floriculture",
  "Hydroponic and Aeroponic Farming", "Green Belt Development for Smart Cities", "Nursery Gardening and Landscaping",
  "Mushroom Culture and Technology-I", "Mushroom Culture and Technology-II", "Plant Aromatics and Perfumery",
  "Viewing and Capturing Diversity in Nature", "Apiculture", "Formulation of Fish Feed",
  "Fish Breeding and Larviculture", "Ornamental Fish Culture: Opportunity and Scope", "Bio-floc Technology",
  "Aquaculture Entrepreneurship", "Pearl Culture", "Sericulture-I: Mulberry Silkworm Rearing",
  "Sericulture-II: Eri Silkworm Rearing", "Sericulture-III: Silk Technology",
  "Sericulture-IV: Therapeutic and Cosmetic Industry", "Chemistry Lab Operations and Safety Measures",
  "Basic Analytical Techniques", "Lab Testing and Quality Assurance", "Essential Food Nutrients",
  "Chemistry of Food Flavors and Colourants", "Chemistry of Cosmetics and Hygiene Products",
  "Green Methods in Chemistry", "Forensic Chemistry", "Environmental Impact and Risk Assessment",
  "Sustainability Reporting", "Environmental Auditing", "Prospecting E-Waste for Sustainability",
  "Developing Sustainability Plans for a Business", "PCB Designing and Fabrication", "Electronic Product Testing",
  "Radiation Safety", "Healthy and Sustainable Food Choices", "Chocolate Crafts", "Pasta and Patisserie Technology",
  "Frozen Dessert Technology", "Early Child Care and Education Settings", "Image Styling",
  "Content Development and Media for Children", "Small Scale Catering", "Culinary Science", "Dairy Processing",
  "Fruits and Vegetable Processing", "Minimal Food Processing", "Food Waste and By-Product Utilisation",
  "Indian Snack Industry", "Sustainable Ecotourism and Entrepreneurship", "E Tourism", "Design Thinking",
  "Innovation and Entrepreneurship", "Museum and Museology", "Reading the Archive", "Working with People",
  "Life Skill Education", "Participatory Learning and Action", "Programme Media", "Finance for Everyone",
  "Personal Financial Planning", "Yoga in Practice", "Cyber Sphere and Security Global Concerns", "Harmonium",
]);

const KNOWN_AEC = new Set([
  "Punjabi Bhasha da Mudhla Padhar", "Punjabi Bhasha da Uchera Padhar",
  "Translation and Interpretation in Assamese", "Translation and Interpretation in Bengali",
  "Translation and Interpretation in Bodo", "Translation and Interpretation in Dogri",
  "Translation and Interpretation in Gujarati", "Translation and Interpretation in Kannada",
  "Translation and Interpretation in Kashmiri", "Translation and Interpretation in Konkani",
  "Translation and Interpretation in Malayalam", "Translation and Interpretation in Manipuri",
  "Translation and Interpretation in Marathi", "Translation and Interpretation in Maithili",
  "Translation and Interpretation in Nepali", "Translation and Interpretation in Odia",
  "Translation and Interpretation in Santali", "Translation and Interpretation in Sindhi",
  "Translation and Interpretation in Tamil", "Translation and Interpretation in Telugu",
  "Basic Assamese", "Basic Bengali", "Basic Bodo", "Basic Dogri", "Basic Gujarati", "Basic Kannada",
  "Basic Kashmiri", "Basic Konkani", "Basic Malayalam", "Basic Manipuri", "Basic Marathi", "Basic Maithili",
  "Basic Nepali", "Basic Odia", "Basic Santali", "Basic Sindhi", "Basic Tamil", "Basic Telugu",
  "Environmental Science - Theory into Practice", "Hindi Bhasha - Sampreshan aur Sanchar",
  "Hindi Aupcharik Lekhan", "Social Media aur Blog Lekhan", "Sanskrit A - Advanced Neeti Literature",
  "Sanskrit B - Introductory Upanishad and Gita", "Sanskrit C - Introduction to Sanskrit Language",
  "Urdu A (12th with Urdu)", "Urdu B (10th with Urdu)",
]);

export function categorizeSubject(name: string): SubjectCategory {
  if (/^DSC[\s-]/i.test(name)) return "DSC";
  if (/^DSE\b/i.test(name) || /DSE Pool/i.test(name)) return "DSE";
  if (/^SEC[\s-]/i.test(name) || /SEC Pool/i.test(name)) return "SEC";
  if (/^AEC\b/i.test(name)) return "AEC";
  if (/^GE[\s:-]/i.test(name) || /GE Pool/i.test(name) || /Generic Elective/i.test(name)) return "GE";

  if (KNOWN_SEC.has(name)) return "SEC";
  if (KNOWN_AEC.has(name)) return "AEC";
  if (KNOWN_VAC.has(name)) return "VAC";

  return "CORE";
}
