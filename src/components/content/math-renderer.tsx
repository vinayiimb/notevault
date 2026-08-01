import { renderMath } from "@/lib/content/math";

// Renders a single LaTeX expression via KaTeX. Pure server component —
// katex.renderToString needs no DOM. Long equations get their own
// horizontal scroll container instead of overflowing the page on mobile.
export function Math({
  expression,
  displayMode = false,
}: {
  expression: string;
  displayMode?: boolean;
}) {
  const result = renderMath(expression, displayMode);

  if (!result.ok) {
    return (
      <span className="inline-flex flex-col gap-1 rounded-lg border border-dashed border-border bg-surface-muted px-3 py-2 text-sm text-muted">
        <span>Formula couldn&apos;t be displayed</span>
        <code className="overflow-x-auto font-mono text-xs">{result.error}</code>
      </span>
    );
  }

  return (
    <span
      className={displayMode ? "block overflow-x-auto py-1" : "inline-block max-w-full overflow-x-auto align-middle"}
      dangerouslySetInnerHTML={{ __html: result.html }}
    />
  );
}
