// npm run du:scrape [-- --resume]
//
// Phase 7: for every discovered paper, search DU's own search endpoint by
// paper code (falls back to name if the code couldn't be parsed), paginate
// through results, visit each new detail page once, and record full
// metadata. Resumable via data/du-question-bank/state.json — rerunning
// after an interruption skips papers already marked complete and details
// already fetched.
//
// This deliberately does NOT do a department x paper x session Cartesian
// product: /web-search-adv requires an exact (department, paper, session)
// triple to return anything, so searching by paper code against the plain
// /web-search endpoint (which returns every session/set that actually
// exists for that code) is an ~8x cheaper, equally complete substitute —
// verified by hand in data/du-question-bank/_inspection/ before this was
// written.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { PATHS, RATE_LIMIT } from "./config";
import { loadState, saveState } from "./checkpoint";
import { discoverDepartmentsAndSessions, discoverPapers } from "./discover";
import { disposeRequestContext, duGet } from "./http-client";
import { extractDetailId, parseDetailPage, parseSearchResults } from "./parse";
import { writeDuplicatesCsv } from "./duplicates";
import { writeQuestionPapersCsv } from "./csv-writer";
import type { Paper, QuestionPaperRecord, ScrapeError } from "./types";

const SAVE_EVERY = 25; // papers between checkpoint + output flushes

function loadJsonArray<T>(path: string): T[] {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf-8")) : [];
}

async function ensureDiscovery(): Promise<Paper[]> {
  const state = loadState();
  if (existsSync(PATHS.papers) && existsSync(PATHS.departments) && existsSync(PATHS.sessions)) {
    console.log("Reusing existing departments.json / papers.json / sessions.json (delete them to rediscover).");
    return loadJsonArray<Paper>(PATHS.papers);
  }
  console.log("No prior discovery output found — discovering departments, papers, sessions first.");
  const { departments, sessions } = await discoverDepartmentsAndSessions();
  writeFileSync(PATHS.departments, JSON.stringify(departments, null, 2));
  writeFileSync(PATHS.sessions, JSON.stringify(sessions, null, 2));
  const papers = await discoverPapers(departments);
  writeFileSync(PATHS.papers, JSON.stringify(papers, null, 2));
  state.departmentsDiscovered = true;
  state.sessionsDiscovered = true;
  state.papersDiscovered = true;
  state.totalPapers = papers.length;
  saveState(state);
  return papers;
}

async function searchAllPages(searchTerm: string): Promise<string[]> {
  const urls = new Set<string>();
  let page = 1;
  while (true) {
    const path = `/web-search?search_term=${encodeURIComponent(searchTerm)}${page > 1 ? `&page=${page}` : ""}`;
    const html = await duGet(path);
    const { detailUrls, noResults, totalResults } = parseSearchResults(html);
    detailUrls.forEach((u) => urls.add(u));
    if (noResults || detailUrls.length === 0) break;
    if (totalResults === null || urls.size >= totalResults) break;
    page++;
    if (page > 200) break; // sanity guard against a pagination loop
  }
  return [...urls];
}

function printProgress(opts: {
  deptTotal: number;
  paperTotal: number;
  papersDone: number;
  detailsDone: number;
  successCount: number;
  failCount: number;
}) {
  console.log(
    `Papers: ${opts.papersDone}/${opts.paperTotal}  |  Detail pages fetched: ${opts.detailsDone}  |  ` +
      `Records: ${opts.successCount} ok, ${opts.failCount} failed`,
  );
}

async function main() {
  mkdirSync(PATHS.dataDir, { recursive: true });
  const papers = await ensureDiscovery();
  const state = loadState();
  state.totalPapers = papers.length;

  const records: QuestionPaperRecord[] = loadJsonArray<QuestionPaperRecord>(PATHS.questionPapersJson);
  const errors: ScrapeError[] = loadJsonArray<ScrapeError>(PATHS.errors);
  const completedPaperIds = new Set(state.completedPaperIds);
  const completedDetailIds = new Set(state.completedDetailIds);

  // Papers sharing the same search key (code, or name when code is
  // unparseable) only need to be searched once — reuse that result for
  // every Paper row with the same key, attributing department info from
  // whichever row we're currently processing.
  const paperByKey = new Map<string, Paper[]>();
  for (const p of papers) {
    const key = p.paperCode ?? p.paperName;
    paperByKey.set(key, [...(paperByKey.get(key) ?? []), p]);
  }

  const searchKeysPending = [...paperByKey.keys()].filter((key) => {
    const rows = paperByKey.get(key)!;
    return !rows.every((r) => completedPaperIds.has(r.paperId));
  });

  console.log(`\nDU Question Bank Scraper`);
  console.log(`Departments: ${loadJsonArray(PATHS.departments).length}`);
  console.log(`Papers discovered: ${papers.length} (${searchKeysPending.length} unique search terms remaining)\n`);

  let done = 0;
  const total = searchKeysPending.length;

  function flushCheckpoint() {
    state.completedPaperIds = [...completedPaperIds];
    state.completedDetailIds = [...completedDetailIds];
    saveState(state);
    writeFileSync(PATHS.questionPapersJson, JSON.stringify(records, null, 2));
    writeFileSync(PATHS.errors, JSON.stringify(errors, null, 2));
    writeQuestionPapersCsv(records, PATHS.questionPapersCsv);
    printProgress({
      deptTotal: loadJsonArray(PATHS.departments).length,
      paperTotal: total,
      papersDone: done,
      detailsDone: completedDetailIds.size,
      successCount: state.successfulRecordCount,
      failCount: state.failedRecordCount,
    });
  }

  async function processKey(key: string) {
    const rows = paperByKey.get(key)!;
    const primary = rows[0];
    try {
      const detailUrls = await searchAllPages(key);
      for (const detailUrl of detailUrls) {
        const detailId = extractDetailId(detailUrl);
        if (completedDetailIds.has(detailId)) continue;
        try {
          const html = await duGet(detailUrl);
          const parsed = parseDetailPage(html, detailUrl);
          if (!parsed) {
            errors.push({ stage: "detail", detailId, url: detailUrl, message: "Unparseable detail page", attempts: 1, timestamp: new Date().toISOString() });
            state.failedRecordCount++;
            continue;
          }
          parsed.department_id = primary.departmentId;
          parsed.department_name = primary.departmentName;
          parsed.paper_id = primary.paperId;
          parsed.paper_code = primary.paperCode;
          parsed.paper_type = primary.paperType;
          if (!parsed.paper_name) parsed.paper_name = primary.paperName;
          records.push(parsed);
          completedDetailIds.add(detailId);
          state.successfulRecordCount++;
        } catch (err) {
          errors.push({
            stage: "detail",
            detailId,
            url: detailUrl,
            message: err instanceof Error ? err.message : String(err),
            attempts: RATE_LIMIT.maxRetries,
            timestamp: new Date().toISOString(),
          });
          state.failedRecordCount++;
        }
      }
      for (const r of rows) completedPaperIds.add(r.paperId);
    } catch (err) {
      for (const r of rows) state.failedPaperIds.push(r.paperId);
      errors.push({
        stage: "search",
        paperCode: key,
        url: `/web-search?search_term=${encodeURIComponent(key)}`,
        message: err instanceof Error ? err.message : String(err),
        attempts: RATE_LIMIT.maxRetries,
        timestamp: new Date().toISOString(),
      });
    }

    done++;
    if (done % SAVE_EVERY === 0 || done === total) flushCheckpoint();
  }

  // Bounded worker pool: each worker pulls the next key off the shared
  // queue as soon as it's free. Actual request pacing (delay + max
  // concurrent in-flight HTTP calls) is still enforced centrally by
  // http-client's semaphore, so this just keeps that pipeline full instead
  // of processing one paper fully before starting the next.
  let cursor = 0;
  async function worker() {
    while (cursor < searchKeysPending.length) {
      const key = searchKeysPending[cursor];
      cursor++;
      await processKey(key);
    }
  }
  const workerCount = Math.max(1, RATE_LIMIT.concurrency);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  state.completedPaperIds = [...completedPaperIds];
  state.completedDetailIds = [...completedDetailIds];
  saveState(state);
  writeFileSync(PATHS.questionPapersJson, JSON.stringify(records, null, 2));
  writeFileSync(PATHS.errors, JSON.stringify(errors, null, 2));
  writeQuestionPapersCsv(records, PATHS.questionPapersCsv);

  const dupCount = writeDuplicatesCsv(records);

  console.log(`\nDone. ${records.length} question paper records, ${errors.length} errors, ${dupCount} flagged as possible duplicates.`);
  console.log(`Output: ${PATHS.questionPapersJson}\n        ${PATHS.questionPapersCsv}\n        ${PATHS.duplicatesCsv}\n        ${PATHS.errors}`);

  await disposeRequestContext();
}

main().catch(async (err) => {
  console.error("du:scrape failed:", err instanceof Error ? err.message : err);
  await disposeRequestContext();
  process.exit(1);
});
