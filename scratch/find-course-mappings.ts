import fs from "fs";

const TARGET_COURSES = [
  "AEC",
  "Another Question Papers",
  "Applied Psychology",
  "B. Com. (H)",
  "B. Com. (P)",
  "B. Voc.",
  "B.A. (P)",
  "BBA",
  "BMS",
  "Computer Science",
  "Economics",
  "English",
  "Environmental Science",
  "Generic Elective",
  "Hindi",
  "History",
  "Mathematics",
  "Philosophy",
  "Political Science",
  "SEC",
  "Statistics",
  "VAC"
];

async function main() {
  const qbFullMapped = JSON.parse(fs.readFileSync("src/data/du-question-bank-full-mapped.json", "utf8"));
  
  const progToCats = {};
  for (const item of qbFullMapped) {
    const prog = item.officialProgramme;
    const cat = item.matchedCategories;
    if (!progToCats[prog]) progToCats[prog] = new Set();
    if (cat) {
      // Split by pipe
      cat.split("|").forEach(c => progToCats[prog].add(c.trim()));
    }
  }

  const mappings = {};
  const unmapped = [];

  for (const [prog, cats] of Object.entries(progToCats)) {
    let mapped = null;
    const catList = Array.from(cats as Set<string>);

    // Heuristics based on cats list and prog name
    if (prog.includes("Ability Enhancement") || catList.some(c => c === "AEC")) {
      mapped = "AEC";
    } else if (prog.includes("Skill Enhancement") || catList.some(c => c === "SEC")) {
      mapped = "SEC";
    } else if (prog.includes("Value Addition") || catList.some(c => c === "VAC")) {
      mapped = "VAC";
    } else if (prog.includes("B.Com. (Hons.)") || prog.includes("B.Com (Hons)") || catList.some(c => c.includes("B. Com. (H)") || c.includes("B.Com (Hons)"))) {
      mapped = "B. Com. (H)";
    } else if (prog.includes("B.Com (P)") || prog.includes("B.Com. (Prog.)") || catList.some(c => c.includes("B. Com. (P)") || c.includes("B.Com. (Programme)"))) {
      mapped = "B. Com. (P)";
    } else if (prog.includes("B.A. (Hons.) Economics") || prog.includes("B.A (Prog.) Economics") || prog.includes("Economics Honours") || catList.some(c => c === "Economics")) {
      mapped = "Economics";
    } else if (prog.includes("B.A (Prog.) History") || prog.includes("History Honours") || catList.some(c => c === "History")) {
      mapped = "History";
    } else if (prog.includes("B.A. (Hons.) Political Science") || prog.includes("Political Science Honours") || catList.some(c => c === "Political Science")) {
      mapped = "Political Science";
    } else if (prog.includes("B.A. (Hons.) Philosophy") || prog.includes("B.A. (Prog) Philosophy") || catList.some(c => c === "Philosophy")) {
      mapped = "Philosophy";
    } else if (prog.includes("B.A. (Hons) Hindi") || prog.includes("B.A. (Hons.) Hindi") || catList.some(c => c === "Hindi")) {
      mapped = "Hindi";
    } else if (prog.includes("B.A. (Hons) English") || prog.includes("B.A. (Prog) English") || catList.some(c => c === "English")) {
      mapped = "English";
    } else if (prog.includes("Applied Psychology") || catList.some(c => c === "Applied Psychology")) {
      mapped = "Applied Psychology";
    } else if (prog.includes("Computer Science") || catList.some(c => c === "Computer Science")) {
      mapped = "Computer Science";
    } else if (prog.includes("Mathematics") || catList.some(c => c === "Mathematics")) {
      mapped = "Mathematics";
    } else if (prog.includes("Statistics") || catList.some(c => c === "Statistics")) {
      mapped = "Statistics";
    } else if (prog.includes("B. Voc") || prog.includes("Vocational") || catList.some(c => c === "B. Voc.")) {
      mapped = "B. Voc.";
    } else if (prog.includes("BBA") || catList.some(c => c === "BBA")) {
      mapped = "BBA";
    } else if (prog.includes("BMS") || catList.some(c => c === "BMS")) {
      mapped = "BMS";
    } else if (prog.includes("Environmental Science") || catList.some(c => c === "Environmental Science")) {
      mapped = "Environmental Science";
    } else if (prog.startsWith("B. A Program") || prog.startsWith("B.A (Prog)") || prog.startsWith("B.A. (Prog)") || catList.some(c => c === "B.A. (P)" || c === "B.A. (Programme)")) {
      mapped = "B.A. (P)";
    } else if (catList.some(c => c.includes("Generic Elective") || c.includes("GE Pool"))) {
      mapped = "Generic Elective";
    } else {
      // Fallback
      mapped = "Another Question Papers";
    }

    mappings[prog] = mapped;
  }

  console.log("Mapped results preview:");
  const mappedCount = {};
  for (const [prog, mapped] of Object.entries(mappings)) {
    mappedCount[mapped as string] = (mappedCount[mapped as string] || 0) + 1;
    console.log(`- "${prog}" => "${mapped}"`);
  }

  console.log("\nSummary of Mapped Course Categories:");
  for (const [cat, count] of Object.entries(mappedCount)) {
    console.log(`- ${cat}: ${count} programmes`);
  }

  // Save the mapping to a file
  fs.writeFileSync("scratch/programme_mappings.json", JSON.stringify(mappings, null, 2));
}

main().catch(console.error);
