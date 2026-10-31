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
    // Exam diagrams (flowcharts, demand/supply curves) are written as inline <svg> by the Paper OCR Studio and the PYQ
    // Analyser. Only drawing shapes, text and arrow markers — no <style>, <script>, <use>, <image> or <foreignObject>.
    "svg",
    "g",
    "path",
    "rect",
    "circle",
    "ellipse",
    "line",
    "polyline",
    "polygon",
    "text",
    "tspan",
    "defs",
    "marker",
    "title",
    "desc",
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
    // hast property names (camelCase), as parse5 produces them for SVG. No style, href or event handlers.
    svg: ["className", "viewBox", "role", "ariaLabel", "width", "height"],
    g: ["className", "transform"],
    path: ["className", "d", "fill", "markerEnd", "markerStart", "transform"],
    rect: ["className", "x", "y", "width", "height", "rx", "ry", "fill", "transform"],
    circle: ["className", "cx", "cy", "r", "fill"],
    ellipse: ["className", "cx", "cy", "rx", "ry", "fill", "transform"],
    line: ["className", "x1", "y1", "x2", "y2", "markerEnd"],
    polyline: ["className", "points", "fill", "markerEnd"],
    polygon: ["className", "points", "fill"],
    text: ["className", "x", "y", "dx", "dy", "textAnchor", "transform"],
    tspan: ["className", "x", "y", "dx", "dy"],
    marker: ["id", "viewBox", "refX", "refY", "markerWidth", "markerHeight", "orient"],
    "*": [...(defaultSchema.attributes?.["*"] ?? []), "id", "className"],
  },
  // The default prefixes every id ("user-content-…") against DOM clobbering, which would break a flowchart's
  // marker-end="url(#fl1-k)". Notes are admin-written, so ids stay as written.
  clobber: ["ariaDescribedBy", "ariaLabelledBy", "name"],
  protocols: {
    ...defaultSchema.protocols,
    src: ["http", "https"],
    href: ["http", "https", "mailto", "tel"],
  },
};
