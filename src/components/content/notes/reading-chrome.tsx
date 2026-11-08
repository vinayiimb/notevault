import type { ContentHeading } from "@/lib/content/toc";
import type { NotesLabColorTokens } from "@/lib/content/theme-presets";
import { ContentThemeProvider } from "./theme-provider";
import { ContentLightboxProvider } from "./note-image";
import { ContentReadingProgress } from "./reading-progress";
import { NotesMarkdown } from "./notes-markdown";
import { NotesIndex } from "./notes-index";
import { IndexJump } from "./index-jump";
import { ContentReadingHeader } from "./reading-header";
import { AskAiPanel } from "./ask-ai-panel";

const ARTICLE_ID = "notes-article";
const INDEX_ID = "nt-index";
const DEFAULT_TAGLINE = "Compiled from actual DU previous year question papers — key concepts, definitions, and exam patterns.";

// Notes written by the Paper OCR Studio open with "# Title" and a one-line summary ("UPC … · 74 solved questions …").
// The title block shows those two, so they are lifted out of the markdown rather than drawn twice.
const OWN_TITLE = /^\s*#\s+([^\n]+)\n+/;
const PLAIN_LINE = /^(?!\s*(?:#|\||>|```|[-*+]\s|\d+\.\s|!\[|<))([^\n]+)\n+/;

function splitTitle(content: string): { title?: string; subtitle?: string; body: string } {
  const t = OWN_TITLE.exec(content);
  if (!t) return { body: content };
  let body = content.slice(t[0].length);
  const s = PLAIN_LINE.exec(body);
  const subtitle = s && s[1].length <= 300 ? s[1].replace(/[*_`]/g, "").trim() : undefined;
  if (s && subtitle) body = body.slice(s[0].length);
  return { title: t[1].replace(/[*_`]/g, "").trim(), subtitle, body };
}

// The full reading experience on the Apple look: a floating glass toolbar (search / PDF / appearance), then one wide
// column — title, a Contents card (each unit opens to its questions) and the note straight on the canvas. There is no side
// list, so a phone and a laptop get the same full-width reading area. Used only for the main compiled-notes block on a
// subject page (src/components/subjects/notes-section.tsx); embedded contexts use the lighter NotesContent instead.
export function NotesReadingChrome({
  title,
  content,
  headings,
  subjectTheme,
  programmeName,
  downloadable = true,
}: {
  title: string;
  content: string;
  headings: ContentHeading[];
  subjectTheme?: { light: NotesLabColorTokens; dark: NotesLabColorTokens } | null;
  programmeName?: string;
  downloadable?: boolean; // false while only a paid note's free preview is shown
}) {
  const own = splitTitle(content);
  const subtitle = own.title ? own.subtitle : DEFAULT_TAGLINE;

  return (
    <ContentThemeProvider subjectTheme={subjectTheme} look="apple">
      <ContentLightboxProvider>
        <div className="nt-reader">
          <ContentReadingProgress />
          <div className="nt-shell">
            <ContentReadingHeader title={title} targetId={ARTICLE_ID} downloadable={downloadable} />
            <div className="nt-article-col">
              {programmeName && <p className="nt-eyebrow">{programmeName}</p>}
              <header className="nt-title-block">
                <h1 className="nt-title">{own.title ?? title}</h1>
                {subtitle && <p className="nt-subtitle">{subtitle}</p>}
              </header>
              <NotesIndex headings={headings} id={INDEX_ID} />
              <main className="nt-article" id={ARTICLE_ID}>
                <NotesMarkdown content={own.body} />
              </main>
            </div>
            <IndexJump targetId={INDEX_ID} />
          </div>
        </div>
        <AskAiPanel subject={title} targetId={ARTICLE_ID} />
      </ContentLightboxProvider>
    </ContentThemeProvider>
  );
}
