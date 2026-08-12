import fs from "fs";

async function main() {
  const catalog = JSON.parse(fs.readFileSync("src/data/ramanujan-pyq-catalog.json", "utf8"));
  
  const courseSubjects = {};
  for (const item of catalog) {
    const course = item.course;
    const subject = item.subject;
    if (!courseSubjects[course]) {
      courseSubjects[course] = new Set();
    }
    courseSubjects[course].add(subject);
  }

  console.log("Course and Subject count in Ramanujan Catalog:");
  for (const [course, subs] of Object.entries(courseSubjects).sort()) {
    console.log(`- ${course}: ${(subs as Set<string>).size} subjects`);
  }
}

main().catch(console.error);
