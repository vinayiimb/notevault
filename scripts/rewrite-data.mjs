import fs from "fs";

let code = fs.readFileSync("src/lib/data.ts", "utf8");

// Remove the import
code = code.replace(
  /import \{ MASTER_SYLLABUS_ROWS \} from "\.\/content\/master-syllabus-data";\n/,
  `import { loadDataAsset } from "./pyq-catalog";\nexport type MasterRow = { id: string; course: string; semester: string; type: string; subjectName: string; courseNumber?: string; upc?: string; credits?: string; };\n`
);

// We need an async getter for it.
const getter = `
let cachedMasterSyllabus: MasterRow[] | null = null;
async function getMasterSyllabus(): Promise<MasterRow[]> {
  if (cachedMasterSyllabus) return cachedMasterSyllabus;
  cachedMasterSyllabus = await loadDataAsset("master-syllabus-data.json");
  return cachedMasterSyllabus as MasterRow[];
}
`;

// Insert the getter
code = code.replace(
  /export async function getProgramsByLevel/,
  `${getter}\nexport async function getProgramsByLevel`
);

// Now change buildFallbackProgram to be async.
code = code.replace(
  /function buildFallbackProgram\(programSlug: string\)/,
  `async function buildFallbackProgram(programSlug: string)`
);

code = code.replace(
  /  const courseNames = PROGRAM_SLUG_TO_COURSES\[programSlug\];/,
  `  const courseNames = PROGRAM_SLUG_TO_COURSES[programSlug];\n  const MASTER_SYLLABUS_ROWS = await getMasterSyllabus();`
);

// We need to await buildFallbackProgram in getProgramBySlug and getSubjectById
code = code.replace(
  /const fallback = buildFallbackProgram\(slug\);/,
  `const fallback = await buildFallbackProgram(slug);`
);

code = code.replace(
  /const program = buildFallbackProgram\(programSlug\);/,
  `const program = await buildFallbackProgram(programSlug);`
);

fs.writeFileSync("src/lib/data.ts", code);
