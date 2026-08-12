// npm run du:inspect
//
// Read-only reconnaissance pass. Reuses the session saved by `du:login` to
// load the (authenticated) Search and Advance Search pages, dumps their DOM
// (dropdown options, form structure) and records every XHR/fetch request the
// page makes — including one live probe where we pick the first department
// option to see whether the Paper dropdown is populated via a dependent
// AJAX call. Nothing here is guessed: every endpoint recorded is one the
// browser itself actually called.
//
// Output goes to data/du-question-bank/_inspection/ for manual review before
// any scraper code assumes a particular endpoint shape.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { chromium, type BrowserContext, type Request as PwRequest } from "playwright";
import { BASE_URL, PATHS, USER_AGENT } from "./config";

type CapturedRequest = {
  method: string;
  url: string;
  resourceType: string;
  postData: string | null;
};

async function capturePage(context: BrowserContext, path: string, label: string) {
  const page = await context.newPage();
  const captured: CapturedRequest[] = [];

  const onRequest = (req: PwRequest) => {
    const type = req.resourceType();
    if (type === "xhr" || type === "fetch") {
      captured.push({
        method: req.method(),
        url: req.url(),
        resourceType: type,
        postData: req.postData(),
      });
    }
  };
  page.on("request", onRequest);

  await page.goto(`${BASE_URL}${path}`, { waitUntil: "networkidle" });
  const finalUrl = page.url();
  const title = await page.title();
  const html = await page.content();

  // Pull every <select> and its options — this is where Department / Paper
  // / Session dropdowns will show up, however they're populated.
  const selects = await page.$$eval("select", (nodes) =>
    nodes.map((el) => ({
      id: (el as HTMLSelectElement).id || null,
      name: (el as HTMLSelectElement).name || null,
      optionCount: (el as HTMLSelectElement).options.length,
      options: Array.from((el as HTMLSelectElement).options)
        .slice(0, 25)
        .map((o) => ({ value: o.value, text: o.text.trim() })),
    })),
  );

  const forms = await page.$$eval("form", (nodes) =>
    nodes.map((el) => ({
      action: (el as HTMLFormElement).action || null,
      method: (el as HTMLFormElement).method || null,
      id: (el as HTMLFormElement).id || null,
    })),
  );

  let dependentProbe: CapturedRequest[] = [];
  const deptSelect = selects.find(
    (s) => /department/i.test(s.name ?? "") || /department/i.test(s.id ?? ""),
  );
  if (deptSelect && deptSelect.options.length > 1) {
    const before = captured.length;
    try {
      const selector = deptSelect.id ? `select[id="${deptSelect.id}"]` : `select[name="${deptSelect.name}"]`;
      const value = deptSelect.options[1].value; // skip index 0 (usually a placeholder)
      await page.selectOption(selector, value);
      await page.waitForTimeout(2000); // let any dependent AJAX fire
    } catch (err) {
      console.warn(`  (dependent-dropdown probe skipped: ${err instanceof Error ? err.message : err})`);
    }
    dependentProbe = captured.slice(before);
  }

  page.off("request", onRequest);
  await page.close();

  const report = { label, path, finalUrl, title, forms, selects, allXhrFetch: captured, dependentProbe };
  writeFileSync(
    `${PATHS.inspectionDir}/${label}.json`,
    JSON.stringify(report, null, 2),
  );
  writeFileSync(`${PATHS.inspectionDir}/${label}.html`, html);
  console.log(`[${label}] title="${title}" finalUrl=${finalUrl}`);
  console.log(`[${label}] forms=${forms.length} selects=${selects.length} xhr/fetch=${captured.length}`);
  for (const s of selects) {
    console.log(`  select name=${s.name} id=${s.id} options=${s.optionCount}`);
  }
  for (const r of captured) {
    console.log(`  XHR/fetch ${r.method} ${r.url}${r.postData ? "  postData=" + r.postData.slice(0, 200) : ""}`);
  }
  return report;
}

async function main() {
  if (!existsSync(PATHS.authState)) {
    console.error(
      `No saved session at ${PATHS.authState}. Run "npm run du:login" first and log in manually.`,
    );
    process.exit(1);
  }
  mkdirSync(PATHS.inspectionDir, { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: PATHS.authState,
    userAgent: USER_AGENT,
  });

  await capturePage(context, "/web-search", "web-search");
  await capturePage(context, "/web-search-adv", "web-search-adv");

  await browser.close();
  console.log(`\nInspection artifacts written to ${PATHS.inspectionDir}`);
  console.log("Review the *.json files before wiring the scraper to any endpoint.");
  process.exit(0);
}

main().catch((err) => {
  console.error("du:inspect failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
