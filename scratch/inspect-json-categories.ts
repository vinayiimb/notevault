import fs from "fs";

async function main() {
  const qbFullMapped = JSON.parse(fs.readFileSync("src/data/du-question-bank-full-mapped.json", "utf8"));
  console.log(`Loaded ${qbFullMapped.length} rows.`);

  const progMap = {};
  for (const item of qbFullMapped) {
    const prog = item.officialProgramme;
    const cat = item.matchedCategories;
    if (!progMap[prog]) {
      progMap[prog] = new Set();
    }
    if (cat) {
      progMap[prog].add(cat);
    }
  }

  console.log("Unique programmes and their matchedCategories:");
  for (const [prog, cats] of Object.entries(progMap)) {
    console.log(`- "${prog}" => [${Array.from(cats as Set<string>).join(", ")}]`);
  }
}

main().catch(console.error);
