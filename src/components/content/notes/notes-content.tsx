import type { NotesLabColorTokens } from "@/lib/content/theme-presets";
import { ContentThemeProvider } from "./theme-provider";
import { ContentLightboxProvider } from "./note-image";
import { NotesMarkdown } from "./notes-markdown";

// The bare, no-chrome rendering surface: theme + lightbox providers wrapped
// around NotesMarkdown, drawn as a paper sheet resting on a tinted canvas
// (the canvas takes its colour from the theme, so a note is never a flat
// white box). Used by every smaller embedded context (admin preview, OCR
// paper renderer, AI analysis panel) — contexts that shouldn't inherit the
// full reading experience (TOC sidebar, in-page search, print button) that
// NotesReadingChrome adds on top of this for the main subject notes page.
export function NotesContent({
  content,
  subjectTheme,
  forceMode,
}: {
  content: string;
  subjectTheme?: { light: NotesLabColorTokens; dark: NotesLabColorTokens } | null;
  forceMode?: "light" | "dark";
}) {
  return (
    <ContentThemeProvider subjectTheme={subjectTheme} forceMode={forceMode}>
      <ContentLightboxProvider>
        <div className="nt-canvas">
          <div className="nt-sheet">
            <NotesMarkdown content={content} />
          </div>
        </div>
      </ContentLightboxProvider>
    </ContentThemeProvider>
  );
}
