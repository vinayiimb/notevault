import type { NotesLabColorTokens } from "@/lib/content/theme-presets";
import { ContentThemeProvider } from "./theme-provider";
import { ContentLightboxProvider } from "./note-image";
import { NotesMarkdown } from "./notes-markdown";

// The bare, no-chrome rendering surface: theme + lightbox providers wrapped
// around NotesMarkdown, styled as a single card. Used by every smaller
// embedded context (admin preview, OCR paper renderer, AI analysis panel) —
// contexts that shouldn't inherit the full reading experience (TOC sidebar,
// in-page search, print button) that NotesReadingChrome adds on top of this
// for the main subject notes page.
export function NotesContent({
  content,
  subjectTheme,
}: {
  content: string;
  subjectTheme?: { light: NotesLabColorTokens; dark: NotesLabColorTokens } | null;
}) {
  return (
    <ContentThemeProvider subjectTheme={subjectTheme}>
      <ContentLightboxProvider>
        <div
          className="rounded-2xl border p-5 sm:p-8"
          style={{ background: "var(--nt-surface)", borderColor: "var(--nt-border)", color: "var(--nt-text)" }}
        >
          <NotesMarkdown content={content} />
        </div>
      </ContentLightboxProvider>
    </ContentThemeProvider>
  );
}
