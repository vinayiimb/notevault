import { z } from "zod";

// The presentation half of the content/presentation split — nothing in here
// describes what a note says (see note-schema.ts for that). A NoteTheme row
// stores a ThemeValues blob in draftJson/publishedJson; resolveEffectiveTheme
// merges GLOBAL -> SUBJECT -> NOTE so a note only needs to override the
// handful of fields it actually wants to change.

export const ComponentStyleSchema = z.object({
  background: z.string(),
  border: z.string(),
  text: z.string(),
});
export type ComponentStyle = z.infer<typeof ComponentStyleSchema>;

const NOTE_COMPONENT_KEYS = [
  "summary",
  "keyFacts",
  "definitions",
  "formulas",
  "examples",
  "important",
  "warning",
  "examTip",
  "quote",
  "table",
  "takeaway",
  "sources",
] as const;
export type NoteComponentKey = (typeof NOTE_COMPONENT_KEYS)[number];

export const ThemeValuesSchema = z.object({
  colors: z.object({
    background: z.string(),
    surface: z.string(),
    primaryText: z.string(),
    secondaryText: z.string(),
    primaryAccent: z.string(),
    secondaryAccent: z.string(),
    border: z.string(),
    link: z.string(),
    selection: z.string(),
    highlightYellow: z.string(),
    highlightMint: z.string(),
    highlightPink: z.string(),
    highlightLavender: z.string(),
    success: z.string(),
    warning: z.string(),
    error: z.string(),
    info: z.string(),
  }),
  typography: z.object({
    bodyFont: z.string(),
    headingFont: z.string(),
    subHeadingFont: z.string().default("winkle"),
    bodySize: z.number(), // px
    headingScale: z.number(), // multiplier applied per heading level
    lineHeight: z.number(),
    letterSpacing: z.number(), // em
    paragraphSpacing: z.number(), // rem
    listIndentation: z.number(), // px
  }),
  layout: z.object({
    readingWidth: z.number().min(620).max(840),
    pagePadding: z.number(),
    sectionSpacing: z.number(),
    borderRadius: z.number().min(0).max(16),
    borderVisible: z.boolean(),
    shadowIntensity: z.enum(["none", "subtle", "medium"]),
    tocPosition: z.enum(["left", "right", "top", "hidden"]),
  }),
  components: z.record(z.enum(NOTE_COMPONENT_KEYS), ComponentStyleSchema),
  visuals: z.object({
    nodeColors: z.array(z.string()).min(3).max(8),
    flowchartNodeStyle: z.enum(["rounded", "sharp"]),
    connectorColor: z.string(),
    connectorThickness: z.number().min(1).max(4),
    arrowheadStyle: z.enum(["classic", "round"]),
    timelineColors: z.array(z.string()).min(2).max(8),
    chartPalette: z.array(z.string()).min(2).max(8),
    diagramBackground: z.string(),
    highlightedNode: ComponentStyleSchema,
  }),
});
export type ThemeValues = z.infer<typeof ThemeValuesSchema>;

export type ThemeScope = "GLOBAL" | "SUBJECT" | "NOTE";

// Deep-merges layer-on-layer: NOTE fields win, then SUBJECT, then GLOBAL —
// but only for keys a layer actually sets (partials are allowed on
// SUBJECT/NOTE layers; GLOBAL must be complete, enforced by publishing
// always validating against ThemeValuesSchema in full).
export function mergeThemeLayers(
  base: ThemeValues,
  ...overrides: (Partial<ThemeValues> | null | undefined)[]
): ThemeValues {
  let result: ThemeValues = base;
  for (const override of overrides) {
    if (!override) continue;
    result = {
      colors: { ...result.colors, ...override.colors },
      typography: { ...result.typography, ...override.typography },
      layout: { ...result.layout, ...override.layout },
      components: { ...result.components, ...override.components },
      visuals: { ...result.visuals, ...override.visuals },
    };
  }
  return result;
}

export type ThemeLookup = {
  globalDefault: ThemeValues;
  subjectTheme?: Partial<ThemeValues> | null;
  noteTheme?: Partial<ThemeValues> | null;
};

/** The whole "theme hierarchy" requirement in one pure, testable function. */
export function resolveEffectiveTheme({ globalDefault, subjectTheme, noteTheme }: ThemeLookup): ThemeValues {
  return mergeThemeLayers(globalDefault, subjectTheme, noteTheme);
}

// ---------- Contrast validation (WCAG 2.x relative luminance) ----------

function srgbToLinear(channel: number) {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function hexToRgb(hex: string): [number, number, number] | null {
  const match = hex.trim().replace(/^#/, "").match(/^([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return null;
  const full = match[1].length === 3 ? match[1].split("").map((c) => c + c).join("") : match[1];
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function relativeLuminance([r, g, b]: [number, number, number]) {
  const [rl, gl, bl] = [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

/** WCAG contrast ratio between two hex colors, 1 (no contrast) to 21 (max). */
export function contrastRatio(hexA: string, hexB: string): number | null {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  if (!a || !b) return null;
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

/** AA for normal text is 4.5:1, AA for large text (>=18pt/14pt bold) is 3:1. */
export function meetsWcagAa(hexA: string, hexB: string, large = false): boolean {
  const ratio = contrastRatio(hexA, hexB);
  if (ratio == null) return false;
  return ratio >= (large ? 3 : 4.5);
}

// ---------- Preset palettes ----------
// "Default" mirrors the site's own original fixed design system (background
// #FAF9F6, text #172033, accent #2563EB, Manrope/Inter) — kept as the actual
// global default theme. The five named presets below are additional,
// selectable palettes an admin can switch a subject or note to; all are
// seeded once by prisma/seed-note-themes.ts and marked isPreset so they're
// always recoverable even after heavy customization.

function baseComponents(soft: { yellow: string; mint: string; pink: string; lavender: string }, surface: string, border: string, text: string): ThemeValues["components"] {
  return {
    summary: { background: surface, border, text },
    keyFacts: { background: soft.mint, border, text },
    definitions: { background: soft.lavender, border, text },
    formulas: { background: soft.yellow, border, text },
    examples: { background: surface, border, text },
    important: { background: soft.lavender, border, text },
    warning: { background: soft.pink, border, text },
    examTip: { background: soft.yellow, border, text },
    quote: { background: surface, border, text },
    table: { background: surface, border, text },
    takeaway: { background: soft.mint, border, text },
    sources: { background: surface, border, text },
  };
}

export const DEFAULT_THEME: ThemeValues = {
  colors: {
    background: "#FAF9F6",
    surface: "#FFFFFF",
    primaryText: "#172033",
    secondaryText: "#667085",
    primaryAccent: "#2563EB",
    secondaryAccent: "#172033",
    border: "#E5E7EB",
    link: "#2563EB",
    selection: "#DCE7FF",
    highlightYellow: "#FEF3C7",
    highlightMint: "#DDF7E8",
    highlightPink: "#FCE7F3",
    highlightLavender: "#E8E1FF",
    success: "#16A34A",
    warning: "#CA8A04",
    error: "#DC2626",
    info: "#2563EB",
  },
  typography: {
    bodyFont: "winkle",
    headingFont: "winkle",
    subHeadingFont: "winkle",
    bodySize: 18,
    headingScale: 1.35,
    lineHeight: 1.75,
    letterSpacing: 0,
    paragraphSpacing: 1.25,
    listIndentation: 20,
  },
  layout: {
    readingWidth: 760,
    pagePadding: 24,
    sectionSpacing: 32,
    borderRadius: 12,
    borderVisible: true,
    shadowIntensity: "subtle",
    tocPosition: "right",
  },
  components: baseComponents(
    { yellow: "#FEF3C7", mint: "#DDF7E8", pink: "#FCE7F3", lavender: "#E8E1FF" },
    "#FFFFFF",
    "#E5E7EB",
    "#172033",
  ),
  visuals: {
    nodeColors: ["#2563EB", "#DDF7E8", "#FEF3C7", "#FCE7F3", "#E8E1FF"],
    flowchartNodeStyle: "rounded",
    connectorColor: "#2563EB",
    connectorThickness: 2,
    arrowheadStyle: "round",
    timelineColors: ["#2563EB", "#7C9CF0"],
    chartPalette: ["#2563EB", "#93C5FD", "#1E3A8A"],
    diagramBackground: "#FFFFFF",
    highlightedNode: { background: "#2563EB", border: "#1D4ED8", text: "#FFFFFF" },
  },
};

const SCHOLAR_BLUE: ThemeValues = {
  ...DEFAULT_THEME,
  colors: {
    ...DEFAULT_THEME.colors,
    background: "#F7F9FC",
    primaryText: "#172033",
    primaryAccent: "#315EFB",
    highlightYellow: "#FFF0B8",
    selection: "#DCE7FF",
  },
  visuals: { ...DEFAULT_THEME.visuals, connectorColor: "#315EFB", nodeColors: ["#315EFB", "#DCE7FF", "#FFF0B8", "#FCE7F3", "#E8E1FF"] },
};

const BOTANICAL: ThemeValues = {
  ...DEFAULT_THEME,
  colors: {
    ...DEFAULT_THEME.colors,
    background: "#F4F8F5",
    primaryText: "#173229",
    primaryAccent: "#26735B",
    highlightMint: "#D8F0E5",
    highlightYellow: "#F6E7A7",
    selection: "#D8F0E5",
  },
  visuals: { ...DEFAULT_THEME.visuals, connectorColor: "#26735B", nodeColors: ["#26735B", "#D8F0E5", "#F6E7A7", "#FCE7F3", "#E8E1FF"] },
};

const LAVENDER_STUDY: ThemeValues = {
  ...DEFAULT_THEME,
  colors: {
    ...DEFAULT_THEME.colors,
    background: "#F8F7FC",
    primaryText: "#28233D",
    primaryAccent: "#7158C7",
    highlightLavender: "#E8E1FF",
    highlightPink: "#FCE3EC",
    selection: "#E8E1FF",
  },
  visuals: { ...DEFAULT_THEME.visuals, connectorColor: "#7158C7", nodeColors: ["#7158C7", "#E8E1FF", "#FCE3EC", "#DDF7E8", "#FEF3C7"] },
};

const ROSE_INK: ThemeValues = {
  ...DEFAULT_THEME,
  colors: {
    ...DEFAULT_THEME.colors,
    background: "#FCF7F8",
    primaryText: "#371F2A",
    primaryAccent: "#A63D62",
    highlightPink: "#F8DCE7",
    highlightYellow: "#F6EDB8",
    selection: "#F8DCE7",
  },
  visuals: { ...DEFAULT_THEME.visuals, connectorColor: "#A63D62", nodeColors: ["#A63D62", "#F8DCE7", "#F6EDB8", "#DDF7E8", "#E8E1FF"] },
};

const MIDNIGHT_FOCUS: ThemeValues = {
  ...DEFAULT_THEME,
  colors: {
    ...DEFAULT_THEME.colors,
    background: "#111521",
    surface: "#1A2030",
    primaryText: "#F4F6FA",
    secondaryText: "#9AA4C0",
    primaryAccent: "#79A6FF",
    border: "#2A3350",
    link: "#79A6FF",
    highlightYellow: "#4A3D28",
    highlightMint: "#1E3B34",
    highlightPink: "#3B2430",
    highlightLavender: "#2A2650",
    selection: "#263B66",
  },
  components: baseComponents(
    { yellow: "#4A3D28", mint: "#1E3B34", pink: "#3B2430", lavender: "#2A2650" },
    "#1A2030",
    "#2A3350",
    "#F4F6FA",
  ),
  visuals: { ...DEFAULT_THEME.visuals, connectorColor: "#79A6FF", diagramBackground: "#1A2030", nodeColors: ["#79A6FF", "#263B66", "#4A3D28", "#3B2430", "#2A2650"] },
};

const SUNSET_AMBER: ThemeValues = {
  ...DEFAULT_THEME,
  colors: {
    ...DEFAULT_THEME.colors,
    background: "#FFF8F2",
    primaryText: "#3A2216",
    primaryAccent: "#EA7317",
    highlightYellow: "#FDE4B8",
    highlightPink: "#FBE0D2",
    selection: "#FDE4B8",
  },
  visuals: { ...DEFAULT_THEME.visuals, connectorColor: "#EA7317", nodeColors: ["#EA7317", "#FDE4B8", "#FBE0D2", "#DDF7E8", "#E8E1FF"] },
};

const OCEAN_TEAL: ThemeValues = {
  ...DEFAULT_THEME,
  colors: {
    ...DEFAULT_THEME.colors,
    background: "#F2FAFB",
    primaryText: "#0F2E33",
    primaryAccent: "#0E8A97",
    highlightMint: "#CFF3EE",
    selection: "#CFF3EE",
  },
  visuals: { ...DEFAULT_THEME.visuals, connectorColor: "#0E8A97", nodeColors: ["#0E8A97", "#CFF3EE", "#FEF3C7", "#FCE7F3", "#E8E1FF"] },
};

const TERRACOTTA_CLAY: ThemeValues = {
  ...DEFAULT_THEME,
  colors: {
    ...DEFAULT_THEME.colors,
    background: "#FBF6F1",
    primaryText: "#3D2A20",
    primaryAccent: "#B5542A",
    highlightYellow: "#F3DCC0",
    highlightPink: "#F1D9CE",
    selection: "#F3DCC0",
  },
  visuals: { ...DEFAULT_THEME.visuals, connectorColor: "#B5542A", nodeColors: ["#B5542A", "#F3DCC0", "#F1D9CE", "#DDF7E8", "#E8E1FF"] },
};

const GRAPHITE_MONO: ThemeValues = {
  ...DEFAULT_THEME,
  colors: {
    ...DEFAULT_THEME.colors,
    background: "#17181C",
    surface: "#1F2126",
    primaryText: "#EDEDEF",
    secondaryText: "#9A9CA3",
    primaryAccent: "#E0A458",
    border: "#2E3038",
    link: "#E0A458",
    highlightYellow: "#3A331F",
    highlightMint: "#1E2B26",
    highlightPink: "#2E2226",
    highlightLavender: "#26242E",
    selection: "#332B1C",
  },
  components: baseComponents(
    { yellow: "#3A331F", mint: "#1E2B26", pink: "#2E2226", lavender: "#26242E" },
    "#1F2126",
    "#2E3038",
    "#EDEDEF",
  ),
  visuals: { ...DEFAULT_THEME.visuals, connectorColor: "#E0A458", diagramBackground: "#1F2126", nodeColors: ["#E0A458", "#332B1C", "#3A331F", "#2E2226", "#26242E"] },
};

export const NOTE_THEME_PRESETS: { name: string; values: ThemeValues; isDefaultGlobal?: boolean }[] = [
  { name: "Default", values: DEFAULT_THEME, isDefaultGlobal: true },
  { name: "Scholar Blue", values: SCHOLAR_BLUE },
  { name: "Botanical", values: BOTANICAL },
  { name: "Lavender Study", values: LAVENDER_STUDY },
  { name: "Rose Ink", values: ROSE_INK },
  { name: "Sunset Amber", values: SUNSET_AMBER },
  { name: "Ocean Teal", values: OCEAN_TEAL },
  { name: "Terracotta Clay", values: TERRACOTTA_CLAY },
  { name: "Midnight Focus", values: MIDNIGHT_FOCUS },
  { name: "Graphite Mono", values: GRAPHITE_MONO },
];
