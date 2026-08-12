import { PrismaClient } from "../src/generated/prisma";
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
  console.log("Loading du-question-bank-full-mapped.json...");
  const jsonPath = path.join(process.cwd(), "src/data/du-question-bank-full-mapped.json");
  const rows = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  console.log(`Loaded ${rows.length} rows.`);

  console.log("Clearing existing duQuestionBankPaper records...");
  const deleteResult = await prisma.duQuestionBankPaper.deleteMany();
  console.log(`Deleted ${deleteResult.count} existing records.`);

  console.log("Inserting rows in chunks...");
  const CHUNK_SIZE = 1000;
  let imported = 0;

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    
    // map/sanitize if necessary
    const data = chunk.map((r: any) => ({
      officialProgramme: r.officialProgramme || "",
      semester: r.semester || null,
      paperType: r.paperType || null,
      subjectPaperName: r.subjectPaperName || "",
      courseNumber: r.courseNumber || null,
      upc: r.upc || null,
      credits: r.credits ? String(r.credits) : null,
      matchedCategories: r.matchedCategories || null,
      sourceType: r.sourceType || null,
      officialPageUrl: r.officialPageUrl || null,
      officialPaperLink: r.officialPaperLink || null,
      questionPaperLink: r.questionPaperLink || null,
      questionPaperSession: r.questionPaperSession || null,
      questionPaperYear: r.questionPaperYear ? String(r.questionPaperYear) : null,
      questionPaperSet: r.questionPaperSet || null,
      questionPaperMarks: r.questionPaperMarks ? String(r.questionPaperMarks) : null,
      matchSource: r.matchSource || null,
      recoveredUpc: r.recoveredUpc || null,
    }));

    const result = await prisma.duQuestionBankPaper.createMany({ data });
    imported += result.count;
    console.log(`Progress: Imported ${imported}/${rows.length} rows...`);
  }

  console.log("Import completed successfully!");
}

main()
  .catch((err) => {
    console.error("Import failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
