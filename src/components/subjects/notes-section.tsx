import { extractContentHeadings, preprocessNotesMarkdown } from "@/lib/content/toc";
import { themeValuesToTokens, LEGACY_NOTES_THEME_TO_PRESET } from "@/lib/content/theme-tokens";
import { findNotesLabTheme } from "@/lib/content/theme-presets";
import { NotesReadingChrome } from "@/components/content/notes/reading-chrome";
import { resolveNotesTheme } from "./notes-renderer";
import { DownloadNotesButton } from "./download-notes-button";
import { StructuredNoteRenderer } from "./structured-note-renderer";
import { StructuredNoteExportBar } from "./structured-note-export-bar";
import { StructuredNoteSchema } from "@/lib/note-schema";
import type { ThemeValues } from "@/lib/note-theme";

// Notes get more room than the rest of the (fairly narrow) subject page —
// this breaks out to a wide, centered container regardless of the parent's
// max-width, the standard "full-bleed section inside a narrow page" trick.
// Capped at max-w so it doesn't turn into an unreadable full-bleed slab on
// ultra-wide monitors, but 95% otherwise — most of the screen, not a fixed
// column with big dead gutters on either side.
export function NotesSection({
  content,
  theme,
  subjectName,
  programmeName,
  format = "MARKDOWN",
  structuredJson,
  resolvedTheme,
}: {
  content: string;
  theme: string;
  subjectName: string;
  programmeName?: string;
  format?: "MARKDOWN" | "STRUCTURED";
  structuredJson?: unknown;
  resolvedTheme?: ThemeValues | null;
}) {
  // format defaults to MARKDOWN and structuredJson stays null for every note
  // created before this feature existed — this branch only ever fires for
  // rows an admin has actually generated/authored as a structured note, so
  // every already-published note keeps rendering exactly as before.
  if (format === "STRUCTURED" && structuredJson && resolvedTheme) {
    const parsed = StructuredNoteSchema.safeParse(structuredJson);
    if (parsed.success) {
      return (
        <div className="relative mt-4 ml-[50%] w-screen -translate-x-1/2 px-4 sm:px-6">
          <div className="mx-auto w-[95%] max-w-[1900px]">
            <div className="flex justify-end">
              <StructuredNoteExportBar note={parsed.data} theme={resolvedTheme} />
            </div>
            <div
              className="mt-3 overflow-hidden rounded-2xl border"
              style={{ borderColor: resolvedTheme.colors.border, backgroundColor: resolvedTheme.colors.background }}
            >
              <StructuredNoteRenderer note={parsed.data} theme={resolvedTheme} />
            </div>
          </div>
        </div>
      );
    }
    // Falls through to the markdown path below if the stored JSON somehow
    // doesn't validate — better to show the plain-text fallback than nothing.
  }

  const resolvedNotesTheme = resolveNotesTheme(theme);
  const preprocessed = preprocessNotesMarkdown(content);
  const headings = extractContentHeadings(preprocessed);
  const subjectTokens = resolvedTheme
    ? themeValuesToTokens(resolvedTheme)
    : findNotesLabTheme(LEGACY_NOTES_THEME_TO_PRESET[resolvedNotesTheme]).light;
  const subjectTokensDark = resolvedTheme
    ? themeValuesToTokens(resolvedTheme)
    : findNotesLabTheme(LEGACY_NOTES_THEME_TO_PRESET[resolvedNotesTheme]).dark;

  return (
    <div className="relative mt-4 ml-[50%] w-screen -translate-x-1/2 px-4 sm:px-6">
      <div className="mx-auto w-[95%] max-w-[1900px]">
        <div className="flex justify-end">
          <DownloadNotesButton content={content} title={subjectName} />
        </div>
        <div className="mt-3">
          <NotesReadingChrome
            title={subjectName}
            programmeName={programmeName}
            content={preprocessed}
            headings={headings}
            subjectTheme={{ light: subjectTokens, dark: subjectTokensDark }}
          />
        </div>
      </div>
    </div>
  );
}
