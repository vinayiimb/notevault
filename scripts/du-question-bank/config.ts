// Shared configuration for the DU Question Paper Bank scraper (read-only,
// rate-limited). All paths are relative to the notevault repo root.
import { join } from "node:path";

const ROOT = process.cwd();

export const BASE_URL = "https://qb.exam.du.ac.in";

export const PATHS = {
  authState: join(ROOT, ".tmp/du-question-bank/auth.json"),
  dataDir: join(ROOT, "data/du-question-bank"),
  inspectionDir: join(ROOT, "data/du-question-bank/_inspection"),
  pdfDir: join(ROOT, "data/du-question-bank/pdfs"),
  departments: join(ROOT, "data/du-question-bank/departments.json"),
  papers: join(ROOT, "data/du-question-bank/papers.json"),
  sessions: join(ROOT, "data/du-question-bank/sessions.json"),
  questionPapersJson: join(ROOT, "data/du-question-bank/question-papers.json"),
  questionPapersCsv: join(ROOT, "data/du-question-bank/question-papers.csv"),
  duplicatesCsv: join(ROOT, "data/du-question-bank/duplicates.csv"),
  importCandidatesCsv: join(ROOT, "data/du-question-bank/import-candidates.csv"),
  errors: join(ROOT, "data/du-question-bank/errors.json"),
  state: join(ROOT, "data/du-question-bank/state.json"),
  reportMd: join(ROOT, "data/du-question-bank/report.md"),
};

export const RATE_LIMIT = {
  // Conservative defaults; override via env. Keep low — this is a shared
  // university server, not ours, and the scrape is read-only.
  concurrency: Number(process.env.DU_SCRAPER_CONCURRENCY ?? 3),
  delayMs: Number(process.env.DU_SCRAPER_DELAY_MS ?? 750),
  maxRetries: Number(process.env.DU_SCRAPER_MAX_RETRIES ?? 5),
  retryBaseMs: Number(process.env.DU_SCRAPER_RETRY_BASE_MS ?? 1000),
  requestTimeoutMs: Number(process.env.DU_SCRAPER_TIMEOUT_MS ?? 20000),
};

export const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36 (NoteVault-DU-QB-research-scraper; read-only)";

export const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
