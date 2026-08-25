import fs from "fs";
let code = fs.readFileSync("prisma/build-bcom-catalog.ts", "utf8");
code = code.replace(
  /import \{ MASTER_SYLLABUS_ROWS \} from "\.\.\/src\/lib\/content\/master-syllabus-data";\n/,
  `import MASTER_SYLLABUS_ROWS from "../public/data/master-syllabus-data.json";\n`
);
fs.writeFileSync("prisma/build-bcom-catalog.ts", code);
