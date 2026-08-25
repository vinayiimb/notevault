import fs from "fs";

let code = fs.readFileSync("src/app/(site)/upsc/page.tsx", "utf8");

code = code.replace(
  /import \{\n  ALL_UPSC_QUESTIONS,\n  ALL_UPSC_HIERARCHY,\n  ALL_YEARS,\n  FilterState,\n  filterQuestions,\n  UPSCQuestion,\n\} from "@\/lib\/upsc-data";\n/,
  `import { ALL_YEARS, FilterState, filterQuestions, UPSCQuestion } from "@/lib/upsc-data";\nimport { useUPSCData } from "@/lib/use-upsc-data";\n`
);
code = code.replace(
  /export default function UPSCExactPage\(\) \{\n/,
  `export default function UPSCExactPage() {\n  const { questions: ALL_UPSC_QUESTIONS, hierarchy: ALL_UPSC_HIERARCHY, loading } = useUPSCData();\n`
);

code = code.replace(
  /    <TopicAccordion\n      selectedSubject=\{selectedSubject\}\n      selectedTopic=\{selectedTopic\}\n      onSelectSubject=\{setSelectedSubject\}\n      onSelectTopic=\{handleTopicSelect\}\n    \/>\n/g,
  `    <TopicAccordion\n      hierarchy={ALL_UPSC_HIERARCHY}\n      selectedSubject={selectedSubject}\n      selectedTopic={selectedTopic}\n      onSelectSubject={setSelectedSubject}\n      onSelectTopic={handleTopicSelect}\n    />\n`
);

// We should also display a loading spinner if loading is true.
code = code.replace(
  /  if \(!mounted\) \{\n    return null;\n  \}\n/g,
  `  if (!mounted || loading) {\n    return (\n      <div className="flex h-screen items-center justify-center">\n        <div className="flex flex-col items-center gap-4">\n          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />\n          <p className="text-sm font-medium text-muted">Loading UPSC Data...</p>\n        </div>\n      </div>\n    );\n  }\n`
);

fs.writeFileSync("src/app/(site)/upsc/page.tsx", code);
