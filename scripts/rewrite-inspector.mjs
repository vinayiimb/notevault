import fs from "fs";

let code = fs.readFileSync("src/components/admin/master-syllabus-inspector.tsx", "utf8");

code = code.replace(
  /import \{ MASTER_SYLLABUS_ROWS, type MasterRow \} from "@\/lib\/content\/master-syllabus-data";\n/,
  `import { useEffect, useState } from "react";\ntype MasterRow = { id: string; course: string; semester: string; type: string; subjectName: string; courseNumber?: string; upc?: string; credits?: string; };\n`
);
code = code.replace(
  /import \{ useMemo, useState \} from "react";\n/,
  `import { useMemo } from "react";\n`
);

code = code.replace(
  /export function MasterSyllabusInspector\(\) \{\n/,
  `export function MasterSyllabusInspector() {\n  const [MASTER_SYLLABUS_ROWS, setMasterSyllabusRows] = useState<MasterRow[]>([]);\n  useEffect(() => { fetch("/data/master-syllabus-data.json").then(r => r.json()).then(setMasterSyllabusRows); }, []);\n`
);

fs.writeFileSync("src/components/admin/master-syllabus-inspector.tsx", code);
