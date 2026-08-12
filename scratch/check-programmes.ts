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
  const total = await prisma.duQuestionBankPaper.count();
  console.log("Total Records in DB:", total);

  const groups = await prisma.duQuestionBankPaper.groupBy({
    by: ["officialProgramme"],
    _count: {
      _all: true,
      questionPaperLink: true, // Counts non-null links
    }
  });

  console.log("\n--- Programme Distribution ---");
  for (const g of groups.sort((a, b) => a.officialProgramme.localeCompare(b.officialProgramme))) {
    const totalCount = g._count._all;
    const withLink = g._count.questionPaperLink;
    const missingLink = totalCount - withLink;
    console.log(`- ${g.officialProgramme}: Total ${totalCount} | With Link: ${withLink} | Missing Link: ${missingLink}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
