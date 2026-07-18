import { extractNotesHeadings, preprocessNotesMarkdown } from "@/lib/notes-markdown";
import { NotesRenderer, resolveNotesTheme } from "./notes-renderer";
import { DownloadNotesButton } from "./download-notes-button";

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
}: {
  content: string;
  theme: string;
  subjectName: string;
}) {
  const resolvedTheme = resolveNotesTheme(theme);
  const headings = extractNotesHeadings(preprocessNotesMarkdown(content));

  return (
    <div className="relative mt-4 ml-[50%] w-screen -translate-x-1/2 px-4 sm:px-6">
      <div className="mx-auto w-[95%] max-w-[1900px]">
        <div className="flex justify-end">
          <DownloadNotesButton content={content} title={subjectName} />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
          {headings.length > 0 && (
            <nav className="hidden lg:block">
              <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl border border-border bg-surface p-4 shadow-[0_10px_30px_rgba(15,23,42,.05)]">
                <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
                  On this page
                </p>
                <div className="flex flex-col gap-0.5 text-sm">
                  {headings.map((h) => (
                    <a
                      key={h.slug}
                      href={`#${h.slug}`}
                      className={`truncate rounded-lg px-2 py-1.5 text-muted transition-all duration-150 hover:translate-x-1 hover:bg-surface-muted hover:text-foreground ${
                        h.level === 3 ? "ml-3 text-xs" : ""
                      }`}
                    >
                      {h.text}
                    </a>
                  ))}
                </div>
              </div>
            </nav>
          )}
          <NotesRenderer content={content} theme={resolvedTheme} />
        </div>
      </div>
    </div>
  );
}
