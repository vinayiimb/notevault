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

export type DatesheetProgramme = {
  slug: string;
  label: string;
  sourceFile: string;
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
