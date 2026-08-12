import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { PATHS } from "./config";
import type { ScraperState } from "./types";

export function loadState(): ScraperState {
  if (existsSync(PATHS.state)) {
    return JSON.parse(readFileSync(PATHS.state, "utf-8"));
  }
  const now = new Date().toISOString();
  return {
    startedAt: now,
    updatedAt: now,
    departmentsDiscovered: false,
    papersDiscovered: false,
    sessionsDiscovered: false,
    totalPapers: 0,
    completedPaperIds: [],
    completedDetailIds: [],
    failedPaperIds: [],
    successfulRecordCount: 0,
    failedRecordCount: 0,
  };
}

export function saveState(state: ScraperState): void {
  state.updatedAt = new Date().toISOString();
  writeFileSync(PATHS.state, JSON.stringify(state, null, 2));
}
