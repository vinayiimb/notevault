import { PrismaClient } from "../src/generated/prisma";
import { getFullPyqCatalog } from "../src/lib/pyq-catalog";
import fs from "fs";
import path from "path";

// Load environment variables from .env.local
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const parts = trimmed.split("=");
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join("=").trim().replace(/^['"]|['"]$/g, "");
      process.env[key] = val;
    }
  }
}

const prisma = new PrismaClient();

async function main() {
  // Get all unique course names in the main catalog
  const catalog = await getFullPyqCatalog();
  const catalogCourses = Array.from(new Set(catalog.map(c => c.course))).sort();

  // Get all unique course names in DuQuestionBankPaper
  const dbQpCourses = Array.from(new Set((await prisma.duQuestionBankPaper.findMany({
    select: { officialProgramme: true }
  })).map(d => d.officialProgramme))).sort();

  console.log("--- Main Catalog Courses Count:", catalogCourses.length);
  console.log("Sample Main Catalog Courses (first 10):", catalogCourses.slice(0, 10));

  console.log("\n--- scraped DU Question Bank Courses Count:", dbQpCourses.length);
  console.log("Sample Scraped Courses (first 10):", dbQpCourses.slice(0, 10));

  // Write all names to check differences
  fs.writeFileSync("scratch/catalog_courses.txt", catalogCourses.join("\n"));
  fs.writeFileSync("scratch/scraped_courses.txt", dbQpCourses.join("\n"));
  console.log("\nWrote list of courses to scratch/catalog_courses.txt and scratch/scraped_courses.txt");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
