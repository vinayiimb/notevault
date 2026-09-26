import fs from "fs";
import path from "path";
import type { DatesheetEntry, DatesheetManifest } from "./datesheet-types";

export type { DatesheetEntry, DatesheetProgramme, DatesheetManifest } from "./datesheet-types";
export { CATEGORY_LABELS } from "./datesheet-types";

const DATA_DIR = path.join(process.cwd(), "public", "data", "datesheet");

export function getDatesheetManifest(): DatesheetManifest {
  const raw = fs.readFileSync(path.join(DATA_DIR, "manifest.json"), "utf8");
  return JSON.parse(raw);
}

export function getProgrammeEntries(slug: string): DatesheetEntry[] {
  const filePath = path.join(DATA_DIR, `${slug}.json`);
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

/** All entries across every programme file, tagged with their programme slug. */
export function getAllEntries(): (DatesheetEntry & { programmeSlug: string; programmeLabel: string })[] {
  const manifest = getDatesheetManifest();
  const out: (DatesheetEntry & { programmeSlug: string; programmeLabel: string })[] = [];
  for (const p of manifest.programmes) {
    const entries = getProgrammeEntries(p.slug);
    for (const e of entries) {
      out.push({ ...e, programmeSlug: p.slug, programmeLabel: p.label });
    }
  }
  return out;
}

export function getSemestersForProgramme(slug: string): string[] {
  const entries = getProgrammeEntries(slug);
  const sems = new Set<string>();
  for (const e of entries) {
    if (e.semester) sems.add(e.semester);
  }
  return Array.from(sems).sort((a, b) => Number(a) - Number(b));
}

export function sortByDateTime(entries: DatesheetEntry[]): DatesheetEntry[] {
  return [...entries].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.startTime.localeCompare(b.startTime);
  });
}
