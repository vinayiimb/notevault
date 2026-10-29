export type DatesheetEntry = {
  date: string; // ISO yyyy-mm-dd
  day: string;
  startTime: string;
  subject: string;
  semester: string | null;
  paperCode: string;
  description: string;
  typeLabel: string;
  category: string; // DSC | DSE | GE | SEC | SBC | VAC | AEC | OTHER
};

/** nep = NEP-UGCF-2022 regular sheets (default), sol = School of Open Learning, cbcs = CBCS-LOCF (2020 & 2021 admissions). */
export type DatesheetGroup = "nep" | "sol" | "cbcs";

export type DatesheetProgramme = {
  slug: string;
  label: string;
  group: DatesheetGroup;
  scheme: string; // "NEP-UGCF-2022" | "CBCS-LOCF"
  sourceFile: string;
  sourceUrl: string; // the official PDF on misc.exam.du.ac.in
  entryCount: number;
};

export type DatesheetManifest = {
  generatedAt: string;
  examSession: string;
  programmes: DatesheetProgramme[];
};

export const CATEGORY_LABELS: Record<string, string> = {
  DSC: "Core (DSC)",
  DSE: "Elective (DSE)",
  GE: "Generic Elective (GE)",
  SEC: "Skill Enhancement (SEC)",
  SBC: "Skill Based Course (SBC)",
  VAC: "Value Addition (VAC)",
  AEC: "Ability Enhancement (AEC)",
  QUALIFYING: "Qualifying",
  MINOR: "Minor",
  OTHER: "Other",
};

/** "09:30 AM" / "2:30 PM" -> minutes after midnight, so afternoon papers sort after morning ones. */
export function timeMinutes(t: string): number {
  const m = /(\d{1,2}):(\d{2})\s*([AP])M/i.exec(t);
  if (!m) return 0;
  return ((Number(m[1]) % 12) + (m[3].toUpperCase() === "P" ? 12 : 0)) * 60 + Number(m[2]);
}

export function compareByDateTime(a: Pick<DatesheetEntry, "date" | "startTime">, b: Pick<DatesheetEntry, "date" | "startTime">): number {
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  return timeMinutes(a.startTime) - timeMinutes(b.startTime);
}
