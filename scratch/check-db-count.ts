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
  const count = await prisma.duQuestionBankPaper.count();
  console.log("Database Count:", count);
  
  // Show a few rows
  const samples = await prisma.duQuestionBankPaper.findMany({
    take: 5,
  });
  console.log("Sample records:", JSON.stringify(samples, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
