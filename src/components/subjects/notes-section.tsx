import { extractNotesHeadings, preprocessNotesMarkdown } from "@/lib/notes-markdown";
import { NotesRenderer, resolveNotesTheme } from "./notes-renderer";
import { DownloadNotesButton } from "./download-notes-button";

// Notes get more room than the rest of the (fairly narrow) subject page —
// this breaks out to a wider, centered container regardless of the parent's
// max-width, the standard "full-bleed section inside a narrow page" trick.
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
      <div className="mx-auto max-w-6xl">
        <div className="flex justify-end">
          <DownloadNotesButton content={content} title={subjectName} />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
          {headings.length > 0 && (
            <nav className="hidden lg:block">
              <div className="sticky top-24 flex max-h-[calc(100vh-7rem)] flex-col gap-0.5 overflow-y-auto text-sm">
                <p className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">
                  On this page
                </p>
                {headings.map((h) => (
                  <a
                    key={h.slug}
                    href={`#${h.slug}`}
                    className={`truncate rounded-lg px-2 py-1 text-muted transition hover:bg-surface-muted hover:text-foreground ${
                      h.level === 3 ? "ml-3 text-xs" : ""
                    }`}
                  >
                    {h.text}
                  </a>
                ))}
              </div>
            </nav>
          )}
          <NotesRenderer content={content} theme={resolvedTheme} />
        </div>
      </div>
    </div>
  );
}
