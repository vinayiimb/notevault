import type { ThemeValues } from "@/lib/note-theme";
import type { NotesLabColorTokens } from "./theme-presets";

function readableOn(hex: string): string {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return "#FFFFFF";
  const r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#111111" : "#FFFFFF";
}

// Maps the admin-configured Note Designer palette (ThemeValues, ~17 color
// keys) onto the 18-key token set the shared content renderer's CSS reads
// (--nt-*). ThemeValues doesn't model separate light/dark variants of a
// single theme (an admin picks one palette and it renders the same
// regardless of the site's dark-mode toggle, matching how the legacy
// NotesRenderer already behaved) — so both slots below use the same tokens.
export function themeValuesToTokens(theme: ThemeValues): NotesLabColorTokens {
  return {
    background: theme.colors.background,
    surface: theme.colors.surface,
    surfaceMuted: theme.colors.background,
    border: theme.colors.border,
    text: theme.colors.primaryText,
    textMuted: theme.colors.secondaryText,
    primary: theme.colors.primaryAccent,
    primaryText: readableOn(theme.colors.primaryAccent),
    secondary: theme.colors.secondaryAccent,
    accent: theme.colors.primaryAccent,
    success: theme.colors.success,
    warning: theme.colors.warning,
    error: theme.colors.error,
    info: theme.colors.info,
    link: theme.colors.link,
    selection: theme.colors.selection,
    gradientFrom: theme.colors.primaryAccent,
    gradientTo: theme.colors.secondaryAccent,
  };
}

// The legacy fixed NotesTheme identity (src/components/subjects/notes-renderer.tsx)
// a subject can be given before it has a Note Designer theme resolved —
// mapped onto the closest-feeling built-in preset so call sites that never
// pass a resolvedTheme (OCR paper renderer, AI analysis panel) still get a
// reasonable, distinct color identity instead of all collapsing to one look.
export const LEGACY_NOTES_THEME_TO_PRESET: Record<"sky" | "violet" | "emerald" | "amber", string> = {
  sky: "ocean",
  violet: "purple",
  emerald: "emerald",
  amber: "sunset",
};
