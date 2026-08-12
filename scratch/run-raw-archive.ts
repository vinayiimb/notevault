import module from "module";

// Mock server-only
const originalRequire = (module as any).prototype.require;
(module as any).prototype.require = function (id: string) {
  if (id === "server-only") {
    return {};
  }
  return originalRequire.apply(this, arguments);
};

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
      const val = parts.slice(1).join("=").trim().replace(/^['"]|['']$/g, "");
      process.env[key] = val;
    }
  }
}

async function main() {
  const { getRawUnifiedPyqArchive } = await import("../src/lib/pyq-catalog");
  const papers = await getRawUnifiedPyqArchive();
  console.log("Total Raw Papers:", papers.length);
  
  const courseCounts: Record<string, number> = {};
  for (const p of papers) {
    courseCounts[p.course] = (courseCounts[p.course] || 0) + 1;
  }

  console.log("\nCourse distribution in getRawUnifiedPyqArchive:");
  for (const [course, count] of Object.entries(courseCounts).sort()) {
    console.log(`- ${course}: ${count} papers`);
  }
}

main().catch(console.error);
