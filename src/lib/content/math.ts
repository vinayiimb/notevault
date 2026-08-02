import katex from "katex";

export type MathRenderResult =
  | { ok: true; html: string }
  | { ok: false; error: string };

// katex.renderToString is pure string in/out (no DOM access), so it works
// fine inside Server Components — no "use client" needed for this helper.
export function renderMath(expression: string, displayMode: boolean): MathRenderResult {
  try {
    const html = katex.renderToString(expression, {
      displayMode,
      throwOnError: true,
      strict: "warn",
    });
    return { ok: true, html };
  } catch {
    return { ok: false, error: expression };
  }
}
