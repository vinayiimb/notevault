// One-off import of course-name -> Program associations confirmed by hand
// during a real Consolidated Upload session, so those same course names
// (however differently punctuated/abbreviated a future zip's filenames
// are) auto-match without picking the course again.
//
// Only one representative filename per distinct canonical key is listed —
// the grouping fix already collapses every differently-punctuated variant
// of the same course to one key (see canonicalKey() in
// consolidated-upload-client.tsx, duplicated here since this script runs
// standalone), so re-listing all ~184 original rows would just write the
// same handful of keys over and over.
//
// Deliberately excludes:
//  - Every row the admin mapped to "Unsorted (Pending Categorization)"
//    (all Biochemistry papers) — that's a placeholder bucket, not a real
//    match, and teaching it as one would make future Biochemistry uploads
//    auto-route into Unsorted forever. Once the Biochemistry programme
//    exists (see seed-biochemistry.ts) those uploads should get a real,
//    deliberate pick instead.
//  - Two "B.A.(Hons) History ... Semester-2022" rows that were mapped to
//    "B.A. (Hons.) Hindi" — almost certainly a mis-click while working
//    through 184 rows, not a real association. Confirm and re-map by hand
//    rather than have this script silently teach it.
//  - Three near-identical "B.A(prog.) English ... Semester ..." rows that
//    were mapped inconsistently (two to "B.A. (Hons.) English", one to
//    "Common Pool (VAC / AEC / SEC)") — contradictory, so none are taught;
//    pick one and it'll be remembered from then on.
//
// Safe to re-run: every row is an upsert keyed by the canonical key.
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

const MINIMAL_NOISE = new Set(["b", "a", "of", "the", "and"]);
const WORD_SYNONYMS: Record<string, string> = {
  h: "hons", hon: "hons", hons: "hons", honours: "hons", honors: "hons",
  prog: "prog", programme: "prog", program: "prog",
  pol: "political",
};

function canonicalKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .filter((w) => !MINIMAL_NOISE.has(w))
    .map((w) => WORD_SYNONYMS[w] ?? w)
    .join(" ");
}

const MAPPINGS: [string, string][] = [
  ["B.A.(H) History-1st Semester-2017", "B.A. (Hons.) History"],
  ["B. A. (Honours) Political Science 2nd Semester 2023-2024", "B.A. (Hons.) Political Science"],
  ["B.A.(H) Sanskrit-1st Semester-2017", "B.A. (Hons.) Sanskrit"],
  ["B.A.(Hons) Hindi 6th Semester-2018", "B.A. (Hons.) Hindi"],
  ["B. A. (Hons.) Economics I Semester 2022-2023", "B.A. (Hons.) Economics"],
  ["B.Com (H) 1st Semester 2017", "B.Com (Hons) — DU Official Syllabus"],
  ["B.Sc. Programme 1st Semester 2017", "B.Sc. (Programme) Life Science"],
  ["B. A. (Prog.) SEC 4th Semester 2017-2023", "Common Pool (VAC / AEC / SEC)"],
  ["B. Sc. (Hons. & Prog.) SEC 3rd Semester 2017-2022", "Common Pool (VAC / AEC / SEC)"],
  ["B. Sc. (Hons., Prog. and Physical Science) SEC 6th Semester 2018-2023", "Common Pool (VAC / AEC / SEC)"],
  ["B.A. & B.Com (Hons.) SEC 4th Semester 2017-2023", "Common Pool (VAC / AEC / SEC)"],
  ["B.A. (Hons.) SEC 3rd Semester 2017-2022", "Common Pool (VAC / AEC / SEC)"],
];

async function main() {
  const programs = await prisma.program.findMany({ select: { id: true, name: true } });
  const byName = new Map(programs.map((p) => [p.name, p.id]));

  const keyToProgram = new Map<string, { programId: string; sourceText: string }>();
  for (const [text, programName] of MAPPINGS) {
    const programId = byName.get(programName);
    if (!programId) {
      console.warn(`Skipping "${text}" — no Program named "${programName}" found.`);
      continue;
    }
    keyToProgram.set(canonicalKey(text), { programId, sourceText: text });
  }

  let count = 0;
  for (const [key, { programId, sourceText }] of keyToProgram) {
    await prisma.courseMatchMemory.upsert({
      where: { key },
      create: { key, programId },
      update: { programId },
    });
    console.log(`  [${key}] <- "${sourceText}"`);
    count++;
  }
  console.log(`Seeded ${count} course-match memory entries (from ${MAPPINGS.length} source rows).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
