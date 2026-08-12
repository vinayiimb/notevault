// npm run du:login
//
// Opens a real (headed) Chromium window on the DU Question Paper Bank login
// page. The user logs in by hand — this script never touches credentials.
// Once they confirm login by pressing Enter here, the authenticated
// Playwright storage state (cookies + localStorage) is persisted locally so
// later scraper runs can reuse the session instead of re-authenticating.
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { chromium } from "playwright";
import { BASE_URL, PATHS, USER_AGENT } from "./config";

const POLL_MS = 2000;
const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes to complete login by hand

async function waitForLogin(page: import("playwright").Page): Promise<void> {
  const deadline = Date.now() + TIMEOUT_MS;
  // No Enter-keypress handoff here — this may run from a non-interactive
  // shell. Instead we poll the browser itself: once navigation lands away
  // from /login (and stays there), the manual login is done.
  while (Date.now() < deadline) {
    await page.waitForTimeout(POLL_MS);
    const url = page.url();
    if (!url.includes("/login")) {
      // Confirm it's stable (not a transient redirect mid-flow).
      await page.waitForTimeout(1500);
      if (!page.url().includes("/login")) return;
    }
  }
  throw new Error(`Timed out after ${TIMEOUT_MS / 1000}s waiting for manual login to complete.`);
}

async function main() {
  mkdirSync(dirname(PATHS.authState), { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();

  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });

  console.log("\nA browser window has opened to the DU Question Paper Bank login page.");
  console.log("Please log in manually with your DU credentials in that window.");
  console.log(`Waiting (up to ${TIMEOUT_MS / 60000} minutes) for navigation away from /login...\n`);

  await waitForLogin(page);
  console.log(`Detected navigation to ${page.url()} — treating this as a successful login.`);

  await context.storageState({ path: PATHS.authState });
  console.log(`\nSession saved to ${PATHS.authState} (gitignored, not printed).`);

  await browser.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("du:login failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
