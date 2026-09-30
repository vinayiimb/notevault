// Client-safe (no Prisma import): the nav, the page gate and the admin
// Features page all read this one list. An admin override (FeatureFlag row)
// replaces `defaultStatus`; no row means the default applies.

export type FeatureStatus = "live" | "soon" | "hidden";

export const FEATURE_STATUSES: { value: FeatureStatus; label: string; hint: string }[] = [
  { value: "live", label: "Live", hint: "Shown in the menu and usable" },
  { value: "soon", label: "Coming soon", hint: "Shown greyed out with a “Soon” badge; the page shows a coming-soon notice" },
  { value: "hidden", label: "Hidden", hint: "Removed from the menu; the page shows a not-available notice" },
];

export interface Feature {
  key: string;
  label: string;
  href: string;
  desc: string;
  menu: "sidebar" | "others";
  defaultStatus: FeatureStatus;
}

export const FEATURES: Feature[] = [
  { key: "exam-kit", label: "Exam Kit", href: "/tools/exam-kit", desc: "Generate practice questions", menu: "sidebar", defaultStatus: "live" },
  { key: "datesheet", label: "Datesheet", href: "/exam-help/datesheet", desc: "Official DU exam datesheet, by course", menu: "others", defaultStatus: "live" },
  { key: "result-doctor", label: "Result Doctor", href: "/tools/result-doctor", desc: "Analyse your marksheet", menu: "others", defaultStatus: "live" },
  { key: "blog", label: "Blog", href: "/blog", desc: "Latest DU updates", menu: "others", defaultStatus: "live" },
  { key: "action-engine", label: "Action Engine", href: "/tools/action-engine", desc: "Prioritized DU alerts", menu: "others", defaultStatus: "hidden" },
  { key: "migration-radar", label: "Migration Radar", href: "/tools/migration-radar", desc: "Track college vacancies", menu: "others", defaultStatus: "hidden" },
  { key: "money-finder", label: "Money Finder", href: "/tools/money-finder", desc: "Master Scholarship Database", menu: "others", defaultStatus: "hidden" },
  { key: "paper-code-finder", label: "Paper Code Finder", href: "/tools/du-paper-code-finder", desc: "Find exact UPCs", menu: "others", defaultStatus: "hidden" },
  { key: "elective-finder", label: "Elective Finder", href: "/tools/elective-finder", desc: "Discover SEC/VAC options", menu: "others", defaultStatus: "hidden" },
  { key: "degree-planner", label: "Degree & 4th-Year Planner", href: "/tools/degree-planner", desc: "Plan your course credits", menu: "others", defaultStatus: "hidden" },
  { key: "er-decoder", label: "ER & Improvement Decoder", href: "/tools/er-decoder", desc: "Decode ER status", menu: "others", defaultStatus: "hidden" },
  { key: "revaluation", label: "Revaluation Hub", href: "/tools/revaluation", desc: "Track Reval dates", menu: "others", defaultStatus: "hidden" },
];

export type FeatureFlagMap = Record<string, FeatureStatus>;

export function isFeatureStatus(value: unknown): value is FeatureStatus {
  return value === "live" || value === "soon" || value === "hidden";
}

export function defaultFlags(): FeatureFlagMap {
  return Object.fromEntries(FEATURES.map((f) => [f.key, f.defaultStatus]));
}

export function resolveFlags(overrides: { key: string; status: string }[]): FeatureFlagMap {
  const flags = defaultFlags();
  for (const { key, status } of overrides) {
    if (key in flags && isFeatureStatus(status)) flags[key] = status;
  }
  return flags;
}

export function featureForPath(pathname: string): Feature | undefined {
  return FEATURES.find((f) => pathname === f.href || pathname.startsWith(`${f.href}/`));
}
