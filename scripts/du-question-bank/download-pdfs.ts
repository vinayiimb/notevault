// npm run du:download-pdfs
//
// OPTIONAL, off by default. Downloads every unique pdf_url from
// question-papers.json into data/du-question-bank/pdfs/. Resumable: skips
// files that already exist on disk. Rate-limited via the same du:scrape
// config (DU_SCRAPER_CONCURRENCY / DU_SCRAPER_DELAY_MS).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { PATHS } from "./config";
import { disposeRequestContext, duGetBinary } from "./http-client";
import type { QuestionPaperRecord } from "./types";

async function main() {
  if (!existsSync(PATHS.questionPapersJson)) {
    console.error(`No scraped data at ${PATHS.questionPapersJson}. Run "npm run du:scrape" first.`);
    process.exit(1);
  }
  mkdirSync(PATHS.pdfDir, { recursive: true });

  const records: QuestionPaperRecord[] = JSON.parse(readFileSync(PATHS.questionPapersJson, "utf-8"));
  const uniqueByFilename = new Map<string, string>(); // filename -> pdf_url
  for (const r of records) {
    if (r.pdf_url && r.pdf_filename) uniqueByFilename.set(r.pdf_filename, r.pdf_url);
  }

  console.log(`${uniqueByFilename.size} unique PDFs to download into ${PATHS.pdfDir}`);

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  const failures: { url: string; message: string }[] = [];

  let i = 0;
  for (const [filename, url] of uniqueByFilename) {
    i++;
    const dest = `${PATHS.pdfDir}/${filename}`;
    if (existsSync(dest)) {
      skipped++;
      continue;
    }
    try {
      const bytes = await duGetBinary(url);
      writeFileSync(dest, bytes);
      downloaded++;
    } catch (err) {
      failed++;
      failures.push({ url, message: err instanceof Error ? err.message : String(err) });
    }
    if (i % 50 === 0) {
      console.log(`[${i}/${uniqueByFilename.size}] downloaded=${downloaded} skipped=${skipped} failed=${failed}`);
    }
  }

  console.log(`\nDone. downloaded=${downloaded} skipped=${skipped} failed=${failed}`);
  if (failures.length > 0) {
    writeFileSync(`${PATHS.dataDir}/download-pdf-errors.json`, JSON.stringify(failures, null, 2));
    console.log(`Failures written to ${PATHS.dataDir}/download-pdf-errors.json`);
  }

  await disposeRequestContext();
}

main().catch(async (err) => {
  console.error("du:download-pdfs failed:", err instanceof Error ? err.message : err);
  await disposeRequestContext();
  process.exit(1);
});
