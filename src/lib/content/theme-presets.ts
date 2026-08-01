// Every theme is a flat set of CSS custom properties applied to the
// [data-nt-theme] wrapper (see theme-provider.tsx) — components never
// hardcode a color, only ever read var(--nt-*), so switching a theme (or
// building a custom one) is a single attribute swap with no per-component
// logic. Split into "light" and "dark" variants so the light/dark toggle
// and the per-theme picker compose instead of fighting each other.

export type NotesLabColorTokens = {
  background: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryText: string;
  secondary: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  link: string;
  selection: string;
  gradientFrom: string;
  gradientTo: string;
};

export type NotesLabTheme = {
  id: string;
  label: string;
  description: string;
  /** Small swatch used by the theme picker — doesn't drive any rendering. */
  swatch: [string, string, string];
  light: NotesLabColorTokens;
  dark: NotesLabColorTokens;
};

export const NOTES_LAB_THEMES: NotesLabTheme[] = [
  {
    id: "ocean",
    label: "Ocean Blue",
    description: "Deep blue, cyan accents, soft blue-white background.",
    swatch: ["#0b5fa8", "#22b8cf", "#eaf6fb"],
    light: {
      background: "#eaf6fb", surface: "#ffffff", surfaceMuted: "#eef7fb", border: "#cfe6f0",
      text: "#0c2733", textMuted: "#4f7688", primary: "#0b5fa8", primaryText: "#ffffff",
      secondary: "#0891b2", accent: "#38bdf8", success: "#0f9d58", warning: "#c77d0a",
      error: "#d1453d", info: "#0b5fa8", link: "#0b5fa8", selection: "#bfe6f7",
      gradientFrom: "#0b5fa8", gradientTo: "#22b8cf",
    },
    dark: {
      background: "#081a24", surface: "#0e2431", surfaceMuted: "#122c3b", border: "#1c3d4e",
      text: "#e6f4fa", textMuted: "#8fb4c4", primary: "#3fa9dc", primaryText: "#04141c",
      secondary: "#2dd4e8", accent: "#67d4ff", success: "#3ecf8e", warning: "#f0a93e",
      error: "#ef6b62", info: "#3fa9dc", link: "#67d4ff", selection: "#154257",
      gradientFrom: "#0b5fa8", gradientTo: "#22b8cf",
    },
  },
  {
    id: "purple",
    label: "Purple Gradient",
    description: "Indigo & violet, pink accent, light lavender background.",
    swatch: ["#4f46e5", "#a855f7", "#f4f1fd"],
    light: {
      background: "#f4f1fd", surface: "#ffffff", surfaceMuted: "#f1ecfb", border: "#e0d6f7",
      text: "#241b3d", textMuted: "#6a5d8c", primary: "#4f46e5", primaryText: "#ffffff",
      secondary: "#a855f7", accent: "#ec4899", success: "#16a34a", warning: "#d97706",
      error: "#dc2626", info: "#4f46e5", link: "#7c3aed", selection: "#e3d6fb",
      gradientFrom: "#4f46e5", gradientTo: "#a855f7",
    },
    dark: {
      background: "#150f28", surface: "#1c1435", surfaceMuted: "#241a44", border: "#332658",
      text: "#f1ecfd", textMuted: "#b3a3d6", primary: "#8b7cf6", primaryText: "#150f28",
      secondary: "#c084fc", accent: "#f472b6", success: "#4ade80", warning: "#fbbf24",
      error: "#f87171", info: "#8b7cf6", link: "#c4b5fd", selection: "#3a2a63",
      gradientFrom: "#6d5bf7", gradientTo: "#c084fc",
    },
  },
  {
    id: "emerald",
    label: "Emerald Green",
    description: "Forest green & emerald, mint accent, pale green background.",
    swatch: ["#0f7a4d", "#10b981", "#eefaf3"],
    light: {
      background: "#eefaf3", surface: "#ffffff", surfaceMuted: "#e7f8ee", border: "#c8ebd7",
      text: "#0d2b1e", textMuted: "#4d7a63", primary: "#0f7a4d", primaryText: "#ffffff",
      secondary: "#10b981", accent: "#34d399", success: "#16a34a", warning: "#ca8a04",
      error: "#dc2626", info: "#0f7a4d", link: "#0f7a4d", selection: "#c6f0d8",
      gradientFrom: "#0f7a4d", gradientTo: "#10b981",
    },
    dark: {
      background: "#0a1d15", surface: "#0f2a1e", surfaceMuted: "#123527", border: "#1c4a34",
      text: "#e4faee", textMuted: "#8fc3a6", primary: "#34d399", primaryText: "#06150e",
      secondary: "#4ade80", accent: "#6ee7b7", success: "#4ade80", warning: "#facc15",
      error: "#f87171", info: "#34d399", link: "#6ee7b7", selection: "#164a34",
      gradientFrom: "#0f7a4d", gradientTo: "#34d399",
    },
  },
  {
    id: "sunset",
    label: "Sunset Orange",
    description: "Orange & coral, yellow accent, warm cream background.",
    swatch: ["#c2410c", "#f97316", "#fdf6ec"],
    light: {
      background: "#fdf6ec", surface: "#ffffff", surfaceMuted: "#fdf1e0", border: "#f4dcb9",
      text: "#3a2210", textMuted: "#8a6743", primary: "#c2410c", primaryText: "#ffffff",
      secondary: "#f97316", accent: "#facc15", success: "#16a34a", warning: "#d97706",
      error: "#dc2626", info: "#c2410c", link: "#c2410c", selection: "#fde3bd",
      gradientFrom: "#ea580c", gradientTo: "#facc15",
    },
    dark: {
      background: "#21120a", surface: "#2e190d", surfaceMuted: "#3a2010", border: "#54321a",
      text: "#fbe9d5", textMuted: "#d3a780", primary: "#fb923c", primaryText: "#241205",
      secondary: "#fdba74", accent: "#fde047", success: "#4ade80", warning: "#fbbf24",
      error: "#f87171", info: "#fb923c", link: "#fdba74", selection: "#5a3417",
      gradientFrom: "#f97316", gradientTo: "#fde047",
    },
  },
  {
    id: "rose",
    label: "Rose Pink",
    description: "Dark rose & pink, peach accent, soft blush background.",
    swatch: ["#9d174d", "#ec4899", "#fdf1f5"],
    light: {
      background: "#fdf1f5", surface: "#ffffff", surfaceMuted: "#fce8ef", border: "#f6cede",
      text: "#3a1223", textMuted: "#8a5a70", primary: "#9d174d", primaryText: "#ffffff",
      secondary: "#ec4899", accent: "#fb923c", success: "#16a34a", warning: "#d97706",
      error: "#dc2626", info: "#9d174d", link: "#be185d", selection: "#f8d2e3",
      gradientFrom: "#9d174d", gradientTo: "#ec4899",
    },
    dark: {
      background: "#210a15", surface: "#2e0f1e", surfaceMuted: "#3a1427", border: "#57203a",
      text: "#fce4ee", textMuted: "#d38aa8", primary: "#f472b6", primaryText: "#210a15",
      secondary: "#fb7185", accent: "#fdba74", success: "#4ade80", warning: "#fbbf24",
      error: "#f87171", info: "#f472b6", link: "#fda4c7", selection: "#5c2340",
      gradientFrom: "#ec4899", gradientTo: "#fb7185",
    },
  },
  {
    id: "teal",
    label: "Teal Academic",
    description: "Dark teal & turquoise, aqua accent, light cyan background.",
    swatch: ["#0f6e6e", "#14b8a6", "#eafbfa"],
    light: {
      background: "#eafbfa", surface: "#ffffff", surfaceMuted: "#e2f8f6", border: "#c2ece8",
      text: "#0c2b2b", textMuted: "#4c7a78", primary: "#0f6e6e", primaryText: "#ffffff",
      secondary: "#14b8a6", accent: "#2dd4bf", success: "#16a34a", warning: "#ca8a04",
      error: "#dc2626", info: "#0f6e6e", link: "#0f6e6e", selection: "#c3efec",
      gradientFrom: "#0f6e6e", gradientTo: "#2dd4bf",
    },
    dark: {
      background: "#081d1d", surface: "#0d2929", surfaceMuted: "#103535", border: "#1a4a49",
      text: "#e0faf7", textMuted: "#83bdb8", primary: "#2dd4bf", primaryText: "#041515",
      secondary: "#5eead4", accent: "#7dd3fc", success: "#4ade80", warning: "#facc15",
      error: "#f87171", info: "#2dd4bf", link: "#7dd3fc", selection: "#154a47",
      gradientFrom: "#0f6e6e", gradientTo: "#5eead4",
    },
  },
  {
    id: "midnight",
    label: "Midnight Dark",
    description: "Indigo & electric blue, purple accent — a dark-native theme.",
    swatch: ["#312e81", "#4338ca", "#0b0f2b"],
    light: {
      background: "#eef0fb", surface: "#ffffff", surfaceMuted: "#e6e9f9", border: "#cdd3f0",
      text: "#191c3a", textMuted: "#5b5f8a", primary: "#4338ca", primaryText: "#ffffff",
      secondary: "#4f46e5", accent: "#818cf8", success: "#16a34a", warning: "#d97706",
      error: "#dc2626", info: "#4338ca", link: "#4338ca", selection: "#dbdffb",
      gradientFrom: "#312e81", gradientTo: "#4f46e5",
    },
    dark: {
      background: "#0b0f2b", surface: "#121736", surfaceMuted: "#171d42", border: "#262d5c",
      text: "#e3e6fa", textMuted: "#9aa0d6", primary: "#818cf8", primaryText: "#0b0f2b",
      secondary: "#60a5fa", accent: "#c084fc", success: "#4ade80", warning: "#fbbf24",
      error: "#f87171", info: "#818cf8", link: "#a5b4fc", selection: "#232a5c",
      gradientFrom: "#312e81", gradientTo: "#7c3aed",
    },
  },
  {
    id: "amoled",
    label: "AMOLED Black",
    description: "Pure black with neon accents — dark-native, battery-friendly.",
    swatch: ["#00e5ff", "#7c3aed", "#000000"],
    light: {
      // AMOLED is defined as a dark-native theme; its "light" slot is a
      // plain, neutral fallback so switching to system-light doesn't break.
      background: "#f5f5f7", surface: "#ffffff", surfaceMuted: "#ececef", border: "#dcdce2",
      text: "#101014", textMuted: "#59596a", primary: "#5b21b6", primaryText: "#ffffff",
      secondary: "#0891b2", accent: "#7c3aed", success: "#16a34a", warning: "#d97706",
      error: "#dc2626", info: "#5b21b6", link: "#5b21b6", selection: "#e4d9fb",
      gradientFrom: "#5b21b6", gradientTo: "#0891b2",
    },
    dark: {
      background: "#000000", surface: "#0a0a0a", surfaceMuted: "#121212", border: "#232323",
      text: "#f2f2f5", textMuted: "#9a9aa5", primary: "#00e5ff", primaryText: "#000000",
      secondary: "#7c3aed", accent: "#39ff14", success: "#39ff88", warning: "#ffd60a",
      error: "#ff5a5a", info: "#00e5ff", link: "#00e5ff", selection: "#123338",
      gradientFrom: "#00e5ff", gradientTo: "#7c3aed",
    },
  },
  {
    id: "sepia",
    label: "Sepia Reading",
    description: "Brown & amber, gold accent, warm paper background.",
    swatch: ["#7c4a20", "#b45309", "#f6ecd9"],
    light: {
      background: "#f6ecd9", surface: "#fbf4e6", surfaceMuted: "#f0e2c6", border: "#e0cca0",
      text: "#3a2a15", textMuted: "#7d6640", primary: "#7c4a20", primaryText: "#fbf4e6",
      secondary: "#b45309", accent: "#d4a017", success: "#3f7d32", warning: "#b45309",
      error: "#a3312a", info: "#7c4a20", link: "#8a5a1e", selection: "#e8d6a8",
      gradientFrom: "#7c4a20", gradientTo: "#d4a017",
    },
    dark: {
      background: "#1e150c", surface: "#291d11", surfaceMuted: "#332415", border: "#4a3520",
      text: "#f1e2c4", textMuted: "#c2a877", primary: "#d4a017", primaryText: "#1e150c",
      secondary: "#e8b04b", accent: "#f2c94c", success: "#7bc47f", warning: "#f2c94c",
      error: "#e07a6d", info: "#d4a017", link: "#f2c94c", selection: "#4a3416",
      gradientFrom: "#7c4a20", gradientTo: "#f2c94c",
    },
  },
  {
    id: "pastel",
    label: "Pastel Study",
    description: "Pastel blue, purple & pink — soft, low-fatigue palette.",
    swatch: ["#7aa7e8", "#b39ddb", "#faf9f7"],
    light: {
      background: "#faf9f7", surface: "#ffffff", surfaceMuted: "#f4f2fb", border: "#e7e2f5",
      text: "#2b2a3a", textMuted: "#71708c", primary: "#7aa7e8", primaryText: "#1a2233",
      secondary: "#b39ddb", accent: "#f6a6c1", success: "#7fc8a9", warning: "#f2c185",
      error: "#e79a9a", info: "#7aa7e8", link: "#6a8fd1", selection: "#e4ecfb",
      gradientFrom: "#a7c7f2", gradientTo: "#f6a6c1",
    },
    dark: {
      background: "#1c1e2b", surface: "#242739", surfaceMuted: "#2c2f45", border: "#3b3f5c",
      text: "#eceafb", textMuted: "#a8a6c8", primary: "#a7c7f2", primaryText: "#1c1e2b",
      secondary: "#cbb8ec", accent: "#f6b8cf", success: "#9fdcc0", warning: "#f2d29b",
      error: "#f0b0b0", info: "#a7c7f2", link: "#cbb8ec", selection: "#333759",
      gradientFrom: "#a7c7f2", gradientTo: "#f6b8cf",
    },
  },
];

// Colorblind-safe presets — deliberately built from palettes with large
// perceptual distance under each deficiency (avoiding red/green or
// blue/yellow pairs as adjacent semantic colors) rather than re-tinting an
// existing theme, since the usual red=error/green=success pairing is
// exactly what deuteranopia/protanopia can't distinguish.
export const NOTES_LAB_COLORBLIND_THEMES: NotesLabTheme[] = [
  {
    id: "cb-deuteranopia",
    label: "Deuteranopia-friendly",
    description: "Blue/orange/yellow palette — avoids red-green pairings.",
    swatch: ["#0057b8", "#e69f00", "#f5f5f5"],
    light: {
      background: "#f7f8fa", surface: "#ffffff", surfaceMuted: "#eef1f5", border: "#d7dce3",
      text: "#12181f", textMuted: "#586472", primary: "#0057b8", primaryText: "#ffffff",
      secondary: "#e69f00", accent: "#56b4e9", success: "#0072b2", warning: "#e69f00",
      error: "#d55e00", info: "#0057b8", link: "#0057b8", selection: "#cfe0f5",
      gradientFrom: "#0057b8", gradientTo: "#56b4e9",
    },
    dark: {
      background: "#0d1117", surface: "#151b23", surfaceMuted: "#1b232e", border: "#2b3644",
      text: "#eef2f7", textMuted: "#9aa7b7", primary: "#56b4e9", primaryText: "#0d1117",
      secondary: "#f0a828", accent: "#83c9f4", success: "#4ea8de", warning: "#f0a828",
      error: "#e67e33", info: "#56b4e9", link: "#83c9f4", selection: "#22384f",
      gradientFrom: "#0057b8", gradientTo: "#83c9f4",
    },
  },
  {
    id: "cb-protanopia",
    label: "Protanopia-friendly",
    description: "Blue/amber palette, high contrast — avoids red confusion.",
    swatch: ["#004488", "#ddaa33", "#f5f5f5"],
    light: {
      background: "#f7f8fa", surface: "#ffffff", surfaceMuted: "#eef1f5", border: "#d7dce3",
      text: "#12181f", textMuted: "#586472", primary: "#004488", primaryText: "#ffffff",
      secondary: "#ddaa33", accent: "#66aadd", success: "#117733", warning: "#ddaa33",
      error: "#994455", info: "#004488", link: "#004488", selection: "#d3e2f2",
      gradientFrom: "#004488", gradientTo: "#66aadd",
    },
    dark: {
      background: "#0d1117", surface: "#151b23", surfaceMuted: "#1b232e", border: "#2b3644",
      text: "#eef2f7", textMuted: "#9aa7b7", primary: "#66aadd", primaryText: "#0d1117",
      secondary: "#eec06a", accent: "#8fc2ea", success: "#4a9c6d", warning: "#eec06a",
      error: "#c47a89", info: "#66aadd", link: "#8fc2ea", selection: "#243b4f",
      gradientFrom: "#004488", gradientTo: "#8fc2ea",
    },
  },
  {
    id: "cb-tritanopia",
    label: "Tritanopia-friendly",
    description: "Red/teal palette — avoids blue-yellow confusion.",
    swatch: ["#c1272d", "#00838f", "#f5f5f5"],
    light: {
      background: "#f8f7f7", surface: "#ffffff", surfaceMuted: "#f1eeee", border: "#e0d9d9",
      text: "#1f1414", textMuted: "#725f5f", primary: "#c1272d", primaryText: "#ffffff",
      secondary: "#00838f", accent: "#e07a5f", success: "#00838f", warning: "#c1272d",
      error: "#8c1a1f", info: "#00838f", link: "#c1272d", selection: "#f0d2d2",
      gradientFrom: "#c1272d", gradientTo: "#00838f",
    },
    dark: {
      background: "#171010", surface: "#211717", surfaceMuted: "#2a1d1d", border: "#432c2c",
      text: "#f6ecec", textMuted: "#c2a3a3", primary: "#e0656a", primaryText: "#171010",
      secondary: "#26c3d1", accent: "#e79b86", success: "#26c3d1", warning: "#e0656a",
      error: "#c94c51", info: "#26c3d1", link: "#e0656a", selection: "#452626",
      gradientFrom: "#e0656a", gradientTo: "#26c3d1",
    },
  },
];

export const ALL_NOTES_LAB_THEMES = [...NOTES_LAB_THEMES, ...NOTES_LAB_COLORBLIND_THEMES];

export const DEFAULT_THEME_ID = "ocean";

export function findNotesLabTheme(id: string): NotesLabTheme {
  return ALL_NOTES_LAB_THEMES.find((t) => t.id === id) ?? NOTES_LAB_THEMES[0];
}

export const NOTES_LAB_TOKEN_KEYS = [
  "background", "surface", "surfaceMuted", "border", "text", "textMuted",
  "primary", "primaryText", "secondary", "accent", "success", "warning",
  "error", "info", "link", "selection", "gradientFrom", "gradientTo",
] as const satisfies readonly (keyof NotesLabColorTokens)[];
