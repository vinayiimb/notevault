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
  programmeName,
}: {
  title: string;
  content: string;
  headings: ContentHeading[];
  subjectTheme?: { light: NotesLabColorTokens; dark: NotesLabColorTokens } | null;
  programmeName?: string;
}) {
  return (
    <ContentThemeProvider subjectTheme={subjectTheme}>
      <ContentLightboxProvider>
        <div className="nt-bg-gradient overflow-hidden rounded-2xl border" style={{ borderColor: "var(--nt-border)" }}>
          <ContentReadingProgress />
          <ContentReadingHeader title={title} targetId={ARTICLE_ID} />
          <div className="nt-shell" data-toc={headings.length > 0}>
            {/* Top Section: TOC (left) and Intro (right) */}
            <div className="nt-top-grid" style={{ gridTemplateColumns: headings.length > 0 ? undefined : "1fr" }}>
              {headings.length > 0 && (
                <div className="nt-toc-container">
                  <ContentTocSidebar headings={headings} />
                </div>
              )}
              <div className="nt-intro-container">
                <div className="flex h-full flex-col justify-center">
                  {programmeName && <p style={{ color: "var(--nt-text-muted)" }} className="text-sm font-medium uppercase tracking-wide">{programmeName}</p>}
                  <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: "var(--nt-primary)" }}>{title}</h1>
                  <p className="mt-4 text-base leading-relaxed" style={{ color: "var(--nt-text-muted)" }}>
                    Compiled from actual DU previous year question papers — key concepts, definitions, and exam patterns.
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom Section: Full Width Notes */}
            <div className="nt-article-col">
              <main className="nt-article" id={ARTICLE_ID}>
                <NotesMarkdown content={content} />
              </main>
            </div>
          </div>
        </div>
      </ContentLightboxProvider>
    </ContentThemeProvider>
  );
}
