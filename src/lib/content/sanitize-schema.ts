import { defaultSchema } from "rehype-sanitize";
import type { Schema } from "hast-util-sanitize";

// Extends rehype-sanitize's default (already strips <script>, on* event
// handlers, and javascript:/data: URLs) with the extra tags notes actually
// need for infographic-style content — divs/spans with a class name for
// grid layouts (info-grid, swot-grid, ...), plus a few inline/semantic tags
// that aren't in the default allowlist. Nothing here re-enables scripts,
// iframes, forms, or event handler attributes; `style` stays disallowed too
// (CSS can still be used to exfiltrate data via background-image URLs, and
// every layout this supports is achievable with class names instead).
export const contentSanitizeSchema: Schema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "div",
    "span",
    "details",
    "summary",
    "figure",
    "figcaption",
    "mark",
    "kbd",
    "sup",
    "sub",
  ],
  attributes: {
    ...defaultSchema.attributes,
    // className (not "class" — react-markdown/rehype produce hast nodes
    // with `className` as an array, which hast-util-sanitize expects) is
    // the only attribute these get: enough to hook up the CSS classes
    // documented for info cards / SWOT grids / etc., nothing executable.
    div: ["className"],
    span: ["className"],
    details: ["className", "open"],
    summary: ["className"],
    figure: ["className"],
    figcaption: ["className"],
    mark: ["className"],
    table: [...(defaultSchema.attributes?.table ?? []), "className"],
    img: [...(defaultSchema.attributes?.img ?? []), "className", "loading", "width", "height"],
    "*": [...(defaultSchema.attributes?.["*"] ?? []), "id", "className"],
  },
  protocols: {
    ...defaultSchema.protocols,
    src: ["http", "https"],
    href: ["http", "https", "mailto", "tel"],
  },
};
