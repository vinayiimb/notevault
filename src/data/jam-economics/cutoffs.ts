// IIT JAM Economics (EN) qualifying cutoffs, marks out of 100.
// 2025: IIT Delhi "JAM 2025 Statistical and Performance Report" (Tables 1–2).
// 2026: IIT Bombay "JAM 2026 Statistical and Performance Report" (Tables 3–5).
// 2021, 2023, 2024: as published with the results (OBC-NCL/EWS = 90% and
// SC/ST/PwD = 50% of the General cutoff, truncated to two decimals).
// 2022: no Economics cutoff in the published listing.

export type JamCutoffYear = {
  year: number;
  /** null when not published */
  cutoff: { gen: number; obc: number; sc: number } | null;
  raw?: { max: number; min: number };
  candidates?: { registered: number; appeared: number; qualified: number };
  qualifiedBy?: { GEN: number; EWS: number; "OBC-NCL": number; SC: number; ST: number; PwD: number };
  official: boolean;
};

export const JAM_EN_CUTOFFS: JamCutoffYear[] = [
  {
    year: 2026,
    cutoff: { gen: 40.63, obc: 36.56, sc: 20.31 },
    raw: { max: 87.33, min: -6.67 },
    candidates: { registered: 3563, appeared: 2807, qualified: 629 },
    qualifiedBy: { GEN: 390, EWS: 50, "OBC-NCL": 81, SC: 90, ST: 18, PwD: 4 },
    official: true,
  },
  {
    year: 2025,
    cutoff: { gen: 42.55, obc: 38.29, sc: 21.27 },
    raw: { max: 83, min: -9 },
    candidates: { registered: 3661, appeared: 2834, qualified: 592 },
    qualifiedBy: { GEN: 366, EWS: 37, "OBC-NCL": 79, SC: 89, ST: 21, PwD: 9 },
    official: true,
  },
  { year: 2024, cutoff: { gen: 24.64, obc: 22.17, sc: 12.32 }, official: false },
  { year: 2023, cutoff: { gen: 23.06, obc: 20.75, sc: 11.53 }, official: false },
  { year: 2022, cutoff: null, official: false },
  { year: 2021, cutoff: { gen: 20.77, obc: 18.69, sc: 10.39 }, official: false },
];

export const CUTOFF_CATEGORIES = [
  { key: "gen", label: "General", color: "#8b80dc" },
  { key: "obc", label: "OBC-NCL / EWS", color: "#7fcd99" },
  { key: "sc", label: "SC / ST / PwD", color: "#f7c35c" },
] as const;
