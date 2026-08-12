import fs from "fs";
import path from "path";

async function main() {
  console.log("Reading json files...");
  const catalog = JSON.parse(fs.readFileSync("src/data/ramanujan-pyq-catalog.json", "utf8"));
  const catalogCourses = Array.from(new Set(catalog.map((c: any) => c.course))).sort();

  const qbFullMapped = JSON.parse(fs.readFileSync("src/data/du-question-bank-full-mapped.json", "utf8"));
  const qbCourses = Array.from(new Set(qbFullMapped.map((c: any) => c.officialProgramme))).sort();

  console.log("Main Catalog Courses count:", catalogCourses.length);
  console.log("Scraped QB Courses count:", qbCourses.length);

  fs.writeFileSync("scratch/catalog_courses.txt", catalogCourses.join("\n"));
  fs.writeFileSync("scratch/scraped_courses.txt", qbCourses.join("\n"));
  console.log("Wrote lists to scratch/catalog_courses.txt and scratch/scraped_courses.txt");
}

main().catch(console.error);
