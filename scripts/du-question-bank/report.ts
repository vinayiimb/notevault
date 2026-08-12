// npm run du:report
//
// Human-readable summary of everything on disk right now: discovery
// progress, scrape progress, error counts, duplicate counts. Safe to run at
// any point, including mid-scrape.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { PATHS } from "./config";
import type { ScraperState, ScrapeError, QuestionPaperRecord } from "./types";

function loadJson<T>(path: string, fallback: T): T {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf-8")) : fallback;
}

function countCsvDataRows(path: string): number {
  if (!existsSync(path)) return 0;
  const text = readFileSync(path, "utf-8").trimEnd();
  if (!text) return 0;
  return text.split("\n").length - 1; // minus header
}

function main() {
  const departments = loadJson<unknown[]>(PATHS.departments, []);
  const papers = loadJson<unknown[]>(PATHS.papers, []);
  const sessions = loadJson<unknown[]>(PATHS.sessions, []);
  const records = loadJson<QuestionPaperRecord[]>(PATHS.questionPapersJson, []);
  const errors = loadJson<ScrapeError[]>(PATHS.errors, []);
  const state = loadJson<ScraperState | null>(PATHS.state, null);
  const duplicateRows = countCsvDataRows(PATHS.duplicatesCsv);
  const importCandidateRows = countCsvDataRows(PATHS.importCandidatesCsv);

  const uniquePaperKeys = new Set(
    (papers as { paperCode: string | null; paperName: string }[]).map((p) => p.paperCode ?? p.paperName),
  ).size;

  const lines = [
    "DU Question Bank Scraper — Status Report",
    "",
    `Departments:         ${departments.length}`,
    `Papers discovered:   ${papers.length}  (${uniquePaperKeys} unique search terms)`,
    `Sessions discovered: ${sessions.length}`,
    "",
    `Question papers extracted: ${records.length}`,
    `Failed requests:           ${errors.length}`,
    `Flagged duplicates:        ${duplicateRows}`,
    `Import candidates:         ${importCandidateRows}`,
    "",
  ];

  if (state) {
    const pctPapers = state.totalPapers > 0 ? ((state.completedPaperIds.length / state.totalPapers) * 100).toFixed(1) : "0.0";
    lines.push(
      `Scrape progress: ${state.completedPaperIds.length} / ${state.totalPapers} search terms processed (${pctPapers}%)`,
      `Detail pages fetched: ${state.completedDetailIds.length}`,
      `Successful records: ${state.successfulRecordCount}, failed: ${state.failedRecordCount}`,
      `Started: ${state.startedAt}`,
      `Last updated: ${state.updatedAt}`,
    );
  } else {
    lines.push("No state.json yet — run npm run du:scrape to begin.");
  }

  const text = lines.join("\n");
  console.log("\n" + text + "\n");
  writeFileSync(PATHS.reportMd, "# " + text.replace(/\n/g, "  \n"));
  console.log(`Written: ${PATHS.reportMd}`);
}

main();
