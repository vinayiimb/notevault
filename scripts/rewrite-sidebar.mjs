import fs from "fs";
let code = fs.readFileSync("src/components/upsc/QuestionFiltersSidebar.tsx", "utf8");

code = code.replace(
  /import \{ FilterState, QUESTION_TYPES \} from "@\/lib\/upsc-data";\n/,
  `import { FilterState, QUESTION_TYPES, SubjectHierarchy } from "@/lib/upsc-data";\n`
);

code = code.replace(
  /interface QuestionFiltersSidebarProps \{\n/,
  `interface QuestionFiltersSidebarProps {\n  hierarchy: SubjectHierarchy[];\n`
);

code = code.replace(
  /export const QuestionFiltersSidebar: React\.FC<QuestionFiltersSidebarProps> = \(\{\n  filters,\n/,
  `export const QuestionFiltersSidebar: React.FC<QuestionFiltersSidebarProps> = ({\n  hierarchy,\n  filters,\n`
);

code = code.replace(
  /        <TopicAccordion\n          selectedSubject=\{filters.selectedSubject\}\n/g,
  `        <TopicAccordion\n          hierarchy={hierarchy}\n          selectedSubject={filters.selectedSubject}\n`
);

fs.writeFileSync("src/components/upsc/QuestionFiltersSidebar.tsx", code);
