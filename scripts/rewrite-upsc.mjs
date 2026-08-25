import fs from "fs";

let code = fs.readFileSync("src/lib/upsc-data.ts", "utf8");

code = code.replace(
  /import masterQuestions from "@\/\.\.\/data\/upsc-pyq\/upsc_questions_master\.json";\n/,
  ""
);
code = code.replace(
  /import topicHierarchy from "@\/\.\.\/data\/upsc-pyq\/upsc_topics_hierarchy\.json";\n/,
  ""
);
code = code.replace(
  /export const ALL_UPSC_QUESTIONS: UPSCQuestion\[\] = masterQuestions as UPSCQuestion\[\];\n/,
  ""
);
code = code.replace(
  /export const ALL_UPSC_HIERARCHY: SubjectHierarchy\[\] = topicHierarchy as SubjectHierarchy\[\];\n/,
  ""
);

fs.writeFileSync("src/lib/upsc-data.ts", code);
