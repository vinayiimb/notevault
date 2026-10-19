import fs from "node:fs";
import path from "node:path";
import { parseJamPaper, type JamQuestion } from "@/lib/jam-economics";

// Server-only: the /jameco pages are static, so this runs at build time.
export function loadJamQuestions(): JamQuestion[] {
  const dir = path.join(process.cwd(), "src", "data", "jam-economics");
  return fs
    .readdirSync(dir)
    .filter((f) => /^\d{4}\.md$/.test(f))
    .sort()
    .flatMap((f) => parseJamPaper(f.slice(0, 4), fs.readFileSync(path.join(dir, f), "utf8")));
}
