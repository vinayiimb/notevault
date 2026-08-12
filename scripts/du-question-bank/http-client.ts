// Thin, rate-limited HTTP layer over Playwright's APIRequestContext, reusing
// the cookies saved by `du:login`. This is the "HTTP scraper" half of the
// browser -> HTTP pipeline: no page rendering, just authenticated GETs,
// which is what lets a 15,000+ record catalogue be scraped without running
// a full browser per request.
import { existsSync } from "node:fs";
import { request, type APIRequestContext } from "playwright";
import { BASE_URL, PATHS, RATE_LIMIT, RETRYABLE_STATUS, USER_AGENT } from "./config";

let ctx: APIRequestContext | null = null;
let inFlight = 0;
const queue: (() => void)[] = [];

export async function getRequestContext(): Promise<APIRequestContext> {
  if (ctx) return ctx;
  if (!existsSync(PATHS.authState)) {
    throw new Error(`No saved session at ${PATHS.authState}. Run "npm run du:login" first.`);
  }
  ctx = await request.newContext({
    storageState: PATHS.authState,
    extraHTTPHeaders: { "User-Agent": USER_AGENT },
    timeout: RATE_LIMIT.requestTimeoutMs,
  });
  return ctx;
}

export async function disposeRequestContext(): Promise<void> {
  if (ctx) {
    await ctx.dispose();
    ctx = null;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Simple counting semaphore so we never exceed RATE_LIMIT.concurrency
// in-flight requests, plus a fixed delay between each request's start —
// conservative on purpose, this is a shared university server.
async function acquireSlot(): Promise<void> {
  if (inFlight < RATE_LIMIT.concurrency) {
    inFlight++;
    return;
  }
  await new Promise<void>((resolve) => queue.push(resolve));
  inFlight++;
}

function releaseSlot() {
  inFlight--;
  const next = queue.shift();
  if (next) next();
}

export class HttpError extends Error {
  constructor(
    message: string,
    public status: number | null,
  ) {
    super(message);
  }
}

// GET with retry/backoff on network errors and retryable HTTP statuses.
// Every call pays the configured inter-request delay, even on the fast
// path — that's the rate limit, not just a retry courtesy.
export async function duGet(path: string): Promise<string> {
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  const context = await getRequestContext();

  await acquireSlot();
  try {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= RATE_LIMIT.maxRetries; attempt++) {
      try {
        await sleep(RATE_LIMIT.delayMs);
        const res = await context.get(url, { timeout: RATE_LIMIT.requestTimeoutMs });
        if (RETRYABLE_STATUS.has(res.status())) {
          throw new HttpError(`HTTP ${res.status()} from ${url}`, res.status());
        }
        if (res.status() >= 400) {
          throw new HttpError(`HTTP ${res.status()} from ${url}`, res.status());
        }
        return await res.text();
      } catch (err) {
        lastErr = err;
        if (attempt === RATE_LIMIT.maxRetries) break;
        const backoff = RATE_LIMIT.retryBaseMs * 2 ** (attempt - 1);
        console.warn(`  retry ${attempt}/${RATE_LIMIT.maxRetries} for ${url} after ${backoff}ms (${err instanceof Error ? err.message : err})`);
        await sleep(backoff);
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  } finally {
    releaseSlot();
  }
}

// Binary GET — only used by the optional du:download-pdfs command.
export async function duGetBinary(url: string): Promise<Buffer> {
  const context = await getRequestContext();
  await acquireSlot();
  try {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= RATE_LIMIT.maxRetries; attempt++) {
      try {
        await sleep(RATE_LIMIT.delayMs);
        const res = await context.get(url, { timeout: RATE_LIMIT.requestTimeoutMs });
        if (res.status() >= 400) throw new HttpError(`HTTP ${res.status()} from ${url}`, res.status());
        return await res.body();
      } catch (err) {
        lastErr = err;
        if (attempt === RATE_LIMIT.maxRetries) break;
        const backoff = RATE_LIMIT.retryBaseMs * 2 ** (attempt - 1);
        await sleep(backoff);
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  } finally {
    releaseSlot();
  }
}

// HEAD request used only by du:validate to confirm a URL is reachable and
// (for PDFs) actually serves PDF content, without downloading the body.
export async function duHead(url: string): Promise<{ status: number; contentType: string | null }> {
  const context = await getRequestContext();
  await acquireSlot();
  try {
    await sleep(RATE_LIMIT.delayMs);
    const res = await context.head(url, { timeout: RATE_LIMIT.requestTimeoutMs });
    return { status: res.status(), contentType: res.headers()["content-type"] ?? null };
  } finally {
    releaseSlot();
  }
}
