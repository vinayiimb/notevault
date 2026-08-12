// Phases 4-6: departments, papers (per department), and sessions. All three
// are fully rendered into the /web-search-adv page HTML (a plain <select>
// each) — no dependent AJAX endpoint exists, confirmed in
// data/du-question-bank/_inspection/. Papers ARE server-side filtered by
// department_id (confirmed: department_id=241 shrinks the 10,788-option
// global list to 781), so getting per-department paper→department
// attribution just means fetching that filtered page once per department.
import { mkdirSync, writeFileSync } from "node:fs";
import { PATHS } from "./config";
import { duGet } from "./http-client";
import { parseDepartments, parsePapersForDepartment, parseSessions } from "./parse";
import type { Department, Paper, SessionOption } from "./types";

export async function discoverDepartmentsAndSessions(): Promise<{ departments: Department[]; sessions: SessionOption[] }> {
  const html = await duGet("/web-search-adv");
  const departments = parseDepartments(html);
  const sessions = parseSessions(html);
  return { departments, sessions };
}

export async function discoverPapers(departments: Department[]): Promise<Paper[]> {
  const all: Paper[] = [];
  for (let i = 0; i < departments.length; i++) {
    const dept = departments[i];
    const html = await duGet(`/web-search-adv?department_id=${encodeURIComponent(dept.departmentId)}`);
    const papers = parsePapersForDepartment(html, dept.departmentId, dept.departmentName);
    all.push(...papers);
    console.log(`[${i + 1}/${departments.length}] ${dept.departmentName}: ${papers.length} papers`);
  }
  return all;
}

async function main() {
  mkdirSync(PATHS.dataDir, { recursive: true });

  console.log("Discovering departments and sessions from /web-search-adv ...");
  const { departments, sessions } = await discoverDepartmentsAndSessions();
  writeFileSync(PATHS.departments, JSON.stringify(departments, null, 2));
  writeFileSync(PATHS.sessions, JSON.stringify(sessions, null, 2));
  console.log(`Departments: ${departments.length} -> ${PATHS.departments}`);
  console.log(`Sessions: ${sessions.length} -> ${PATHS.sessions}`);

  console.log("\nDiscovering papers per department (this makes one request per department) ...");
  const papers = await discoverPapers(departments);
  writeFileSync(PATHS.papers, JSON.stringify(papers, null, 2));
  console.log(`\nPapers: ${papers.length} -> ${PATHS.papers}`);

  const missingCode = papers.filter((p) => !p.paperCode).length;
  if (missingCode > 0) {
    console.warn(`Warning: ${missingCode} papers had an unparseable code (name/type split failed) — they'll be searched by name instead.`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("discover failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
