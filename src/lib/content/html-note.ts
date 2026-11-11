// A finished, self-styled page (the whole .html file) stored as the note's content instead of markdown. No schema flag:
// the content itself says so, so it works for the admin drop box and /api/notes-import alike.
export function isHtmlNote(content: string): boolean {
  return /^\s*(?:<!--[\s\S]*?-->\s*)*<(?:!doctype\s+html|html[\s>])/i.test(content);
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Free preview of a paid HTML note. The markdown rule (cut at ~30% of the lines) would slice through <style> / tags, so an
// HTML note shows everything above `<!-- preview-end -->` (see previewOf), or, without one, only its title.
export function htmlNoteTitleOnly(html: string, fallback = "Notes"): string {
  const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1].replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
  return `<!doctype html><html><body style="font:600 1.4rem/1.3 system-ui,sans-serif;padding:24px 14px"><h1 style="font-size:inherit;margin:0">${escapeHtml(t || fallback)}</h1></body></html>`;
}
