"use client";

import { useEffect, useRef, useState } from "react";

// Appended to every bundle: reports its height so the frame fits the content
// (no inner scrollbar), and opens links outside the frame.
const RESIZER = `<base target="_blank"><script>(function(){function s(){parent.postMessage({pyqBundleHeight:Math.ceil(document.documentElement.scrollHeight)},"*")}addEventListener("load",s);if(window.ResizeObserver)new ResizeObserver(s).observe(document.documentElement);setTimeout(s,50);setTimeout(s,800)})()</script>`;

/**
 * Renders an admin-dropped HTML solution bundle exactly as built.
 * sandbox="allow-scripts" without allow-same-origin gives it an opaque
 * origin: its JS runs (charts, KaTeX, interactive diagrams) but it cannot
 * read the site's cookies, storage or DOM, or navigate the page.
 * Pass `html` directly (admin preview) or `questionId` to fetch on demand.
 */
export function SolutionBundle({ html, questionId, title }: { html?: string; questionId?: string; title: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [fetched, setFetched] = useState<string | null>(null);
  const doc = html ?? fetched;
  const [height, setHeight] = useState(320);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (html !== undefined || !questionId) return;
    let alive = true;
    fetch(`/api/pyq-answer?id=${encodeURIComponent(questionId)}`)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((text) => alive && setFetched(text))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [html, questionId]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frameRef.current?.contentWindow) return;
      const h = Number((e.data as { pyqBundleHeight?: number } | null)?.pyqBundleHeight);
      if (h > 0) setHeight(Math.min(h + 4, 40000));
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (failed) return <p className="text-sm text-muted">This solution couldn&apos;t load. Refresh to try again.</p>;
  if (doc === null) return <div className="h-64 animate-pulse rounded-xl bg-surface-muted" aria-label="Loading solution" />;

  const srcDoc = /<\/head>/i.test(doc) ? doc.replace(/<\/head>/i, `${RESIZER}</head>`) : RESIZER + doc;
  return (
    <iframe
      ref={frameRef}
      title={title}
      srcDoc={srcDoc}
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="no-referrer"
      loading="lazy"
      className="block w-full rounded-xl border-0 bg-white"
      style={{ height }}
    />
  );
}
