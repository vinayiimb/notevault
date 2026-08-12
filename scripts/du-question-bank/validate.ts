// npm run du:validate
//
// Phase 13: sanity-check the scraped catalogue. Counts + a random sample of
// >=30 records get their detail_url and pdf_url HEAD-checked (no full
// downloads) to confirm they're actually reachable and the PDF really looks
// like a PDF.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { PATHS } from "./config";
import { disposeRequestContext, duHead } from "./http-client";
import type { QuestionPaperRecord, ScrapeError } from "./types";

const SAMPLE_SIZE = 30;

function loadJson<T>(path: string, fallback: T): T {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf-8")) : fallback;
}

function sample<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < Math.min(n, copy.length); i++) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

async function main() {
  const records = loadJson<QuestionPaperRecord[]>(PATHS.questionPapersJson, []);
  const errors = loadJson<ScrapeError[]>(PATHS.errors, []);
  const departments = loadJson<unknown[]>(PATHS.departments, []);
  const papers = loadJson<unknown[]>(PATHS.papers, []);
  const sessions = loadJson<unknown[]>(PATHS.sessions, []);

  if (records.length === 0) {
    console.error(`No records found at ${PATHS.questionPapersJson}. Run "npm run du:scrape" first.`);
    process.exit(1);
  }

  const uniquePdfUrls = new Set(records.map((r) => r.pdf_url).filter(Boolean));
  const missingPdf = records.filter((r) => !r.pdf_url).length;
  const missingUpc = records.filter((r) => !r.upc).length;

  console.log("DU Question Bank — Validation Report\n");
  console.log(`Departments:          ${departments.length}`);
  console.log(`Papers (catalog):     ${papers.length}`);
  console.log(`Sessions:             ${sessions.length}`);
  console.log(`Question papers:      ${records.length}`);
  console.log(`  unique PDF URLs:    ${uniquePdfUrls.size}`);
  console.log(`  missing PDF URL:    ${missingPdf}`);
  console.log(`  missing UPC:       ${missingUpc}`);
  console.log(`Failed requests:      ${errors.length}\n`);

  const sampled = sample(records, SAMPLE_SIZE);
  console.log(`Sampling ${sampled.length} records for live HEAD checks...\n`);

  let detailOk = 0;
  let pdfOk = 0;
  const problems: string[] = [];

  for (const r of sampled) {
    const detailCheck = await duHead(r.detail_url);
    const detailGood = detailCheck.status >= 200 && detailCheck.status < 400;
    if (detailGood) detailOk++;
    else problems.push(`detail_url ${r.detail_url} -> HTTP ${detailCheck.status}`);

    if (r.pdf_url) {
      const pdfCheck = await duHead(r.pdf_url);
      const pdfGood = pdfCheck.status >= 200 && pdfCheck.status < 400;
      const looksLikePdf = (pdfCheck.contentType ?? "").toLowerCase().includes("pdf");
      if (pdfGood && looksLikePdf) pdfOk++;
      else problems.push(`pdf_url ${r.pdf_url} -> HTTP ${pdfCheck.status}, content-type=${pdfCheck.contentType}`);
    }
  }

  console.log(`Detail pages reachable: ${detailOk}/${sampled.length}`);
  console.log(`PDFs reachable + look like PDFs: ${pdfOk}/${sampled.filter((r) => r.pdf_url).length}\n`);

  if (problems.length > 0) {
    console.log("Problems found:");
    for (const p of problems) console.log(`  - ${p}`);
  } else {
    console.log("No problems found in sample.");
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    counts: {
      departments: departments.length,
      papers: papers.length,
      sessions: sessions.length,
      questionPapers: records.length,
      uniquePdfUrls: uniquePdfUrls.size,
      missingPdf,
      missingUpc,
      failedRequests: errors.length,
    },
    sample: {
      size: sampled.length,
      detailOk,
      pdfChecked: sampled.filter((r) => r.pdf_url).length,
      pdfOk,
      problems,
    },
  };
  writeFileSync(`${PATHS.dataDir}/validation-report.json`, JSON.stringify(summary, null, 2));
  console.log(`\nFull report: ${PATHS.dataDir}/validation-report.json`);

  await disposeRequestContext();
}

main().catch(async (err) => {
  console.error("du:validate failed:", err instanceof Error ? err.message : err);
  await disposeRequestContext();
  process.exit(1);
});
