import type { ContentHeading } from "@/lib/content/toc";
import type { NotesLabColorTokens } from "@/lib/content/theme-presets";
import { ContentThemeProvider } from "./theme-provider";
import { ContentLightboxProvider } from "./note-image";
import { ContentReadingProgress } from "./reading-progress";
import { ContentTocSidebar } from "./toc-sidebar";
import { NotesMarkdown } from "./notes-markdown";
import { ContentReadingHeader } from "./reading-header";

const ARTICLE_ID = "notes-article";

// The full reading experience — sticky header (search / print / theme
// picker), reading-progress bar, and TOC sidebar wrapped around
// NotesMarkdown. Used only for the main compiled-notes block on a subject
// page (src/components/subjects/notes-section.tsx); embedded contexts use
// the lighter NotesContent instead.
export function NotesReadingChrome({
  title,
  content,
  headings,
  subjectTheme,
}: {
  title: string;
  content: string;
  headings: ContentHeading[];
  subjectTheme?: { light: NotesLabColorTokens; dark: NotesLabColorTokens } | null;
}) {
  return (
    <ContentThemeProvider subjectTheme={subjectTheme}>
      <ContentLightboxProvider>
        <div className="nt-bg-gradient overflow-hidden rounded-2xl border" style={{ borderColor: "var(--nt-border)" }}>
          <ContentReadingProgress />
          <ContentReadingHeader title={title} targetId={ARTICLE_ID} />
          <div className="nt-shell" data-toc={headings.length > 0}>
            <main className="nt-article" id={ARTICLE_ID}>
              <NotesMarkdown content={content} />
            </main>
            <div className="nt-no-print px-4">
              <ContentTocSidebar headings={headings} />
            </div>
          </div>
        </div>
      </ContentLightboxProvider>
    </ContentThemeProvider>
  );
}
