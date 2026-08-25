import fs from "fs";
let code = fs.readFileSync("src/lib/pyq-catalog.ts", "utf8");

code = code.replace(
  `  const safeAutomaticMatch =
    (match.matchStatus === "Exact" || match.matchStatus === "Strong") &&`,
  `async function applyOfficialFileMap(paper: CatalogPaper): Promise<CatalogPaper> {
  const match = (await getOfficialArchiveMap()).get(paper.id);
  if (!match) return { ...paper, matchStatus: "Unmatched", matchConfidence: 0 };

  const safeAutomaticMatch =
    (match.matchStatus === "Exact" || match.matchStatus === "Strong") &&`
);

fs.writeFileSync("src/lib/pyq-catalog.ts", code);
