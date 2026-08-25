import fs from "fs";
// Just use regex to extract the array, or eval it if possible.
// Since it's TS, let's compile it first.
import { execSync } from "child_process";
execSync("npx tsc src/lib/content/master-syllabus-data.ts --outDir tmp");
const data = await import("../tmp/master-syllabus-data.js");
fs.writeFileSync("public/data/master-syllabus-data.json", JSON.stringify(data.MASTER_SYLLABUS_ROWS, null, 2));
