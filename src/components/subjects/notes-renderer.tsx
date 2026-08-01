import { NotesContent } from "@/components/content/notes/notes-content";
import { themeValuesToTokens, LEGACY_NOTES_THEME_TO_PRESET } from "@/lib/content/theme-tokens";
import { findNotesLabTheme } from "@/lib/content/theme-presets";
import { preprocessNotesMarkdown } from "@/lib/content/toc";
import type { ThemeValues } from "@/lib/note-theme";

export const NOTES_THEMES = ["sky", "violet", "emerald", "amber"] as const;
export type NotesTheme = (typeof NOTES_THEMES)[number];

export function resolveNotesTheme(value: string | null | undefined): NotesTheme {
  return (NOTES_THEMES as readonly string[]).includes(value ?? "")
    ? (value as NotesTheme)
    : "sky";
}

// Thin compatibility wrapper kept so every existing call site (notes-section,
// the admin notes editor preview, the OCR paper renderer, the AI analysis
// panel) keeps working unmodified — the actual rendering engine is the
// shared NotesMarkdown pipeline under src/components/content/notes/, which
// also backs OCR text and MDX-free structured content elsewhere in the app.
export function NotesRenderer({
  content,
  theme = "sky",
  resolvedTheme,
}: {
  content: string;
  theme?: NotesTheme;
  // When set, this Note Designer theme (see src/lib/note-theme.ts) drives
  // the rendered colors/fonts; the legacy sky/violet/emerald/amber palette
  // below is only the fallback for subjects that haven't been given one.
  resolvedTheme?: ThemeValues | null;
}) {
  const markdown = preprocessNotesMarkdown(content);
  const tokens = resolvedTheme
    ? themeValuesToTokens(resolvedTheme)
    : findNotesLabTheme(LEGACY_NOTES_THEME_TO_PRESET[theme]).light;
  const darkTokens = resolvedTheme
    ? themeValuesToTokens(resolvedTheme)
    : findNotesLabTheme(LEGACY_NOTES_THEME_TO_PRESET[theme]).dark;

  return <NotesContent content={markdown} subjectTheme={{ light: tokens, dark: darkTokens }} />;
}
