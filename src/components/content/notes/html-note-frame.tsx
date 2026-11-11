// Shows a finished .html note exactly as designed, including its own scripts (interactive pages hide their body until a
// script runs, so a script-less frame shows them blank). Safe because the sandbox has no allow-same-origin: the page
// gets an opaque origin, so its scripts can't read our cookies/session/storage or touch the surrounding site.
// The frame is about one screen tall and scrolls inside itself, so the page's own sticky bar, progress bar and
// #jump links behave as they were designed to.
export function HtmlNoteFrame({ html, title }: { html: string; title: string }) {
  return (
    <div className="mx-auto w-full max-w-[69rem] px-0 sm:px-6">
      <iframe
        title={title}
        srcDoc={html}
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
        className="block h-[calc(100dvh-5rem)] min-h-[480px] w-full border-0 bg-white sm:rounded-2xl sm:shadow-[0_1px_2px_rgba(0,0,0,.05),0_20px_50px_-14px_rgba(0,0,0,.18)]"
      />
    </div>
  );
}
