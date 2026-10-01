// Client-side "Download PDF" for rendered notes: snapshots the themed notes
// exactly as they look on screen (colors, cards, tables, Mermaid, KaTeX) into
// an A4 PDF in the student's browser — no print dialog, nothing stored or
// generated on the server. Each top-level block is captured separately so
// page breaks fall between blocks instead of through a line of text.
// ponytail: pages are images (text isn't selectable/searchable); a vector PDF
// needs a headless browser on the server.

const STAGE_WIDTH = 800; // px — fixed so a phone and a laptop produce the same PDF
const MARGIN = 28; // pt
const FOOTER = 16; // pt

export async function downloadElementAsPdf({
  root,
  blocks,
  filename,
  footer,
  onProgress,
}: {
  root: HTMLElement; // theme-bearing element to clone (CSS vars live here)
  blocks: string; // selector, inside root, for the blocks to lay out in order
  filename: string;
  footer: string;
  onProgress?: (pct: number) => void;
}) {
  const [{ jsPDF }, { toCanvas, getFontEmbedCSS }] = await Promise.all([import("jspdf"), import("html-to-image")]);

  // Diagrams render async after mount — wait (up to 20s) so the PDF doesn't
  // capture "Rendering diagram…" placeholders.
  for (let t = 0; t < 40 && root.querySelector(".nt-mermaid-canvas:not(:has(svg))"); t++) {
    await new Promise((r) => setTimeout(r, 500));
  }

  // Offscreen fixed-width copy, inserted next to the original so ancestor
  // selectors and inherited CSS variables still apply.
  const stage = document.createElement("div");
  stage.style.cssText = `position:fixed;left:-100000px;top:0;width:${STAGE_WIDTH}px;pointer-events:none;`;
  const clone = root.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".nt-no-print, .nt-toc-container, .nt-mermaid-toolbar, [data-pdf-skip]").forEach((el) => el.remove());
  clone.querySelectorAll<HTMLElement>(".nt-top-grid").forEach((el) => (el.style.gridTemplateColumns = "1fr"));
  stage.appendChild(clone);
  root.parentElement!.appendChild(stage);

  try {
    const els = [...clone.querySelectorAll<HTMLElement>(blocks)].filter((el) => el.offsetHeight > 0);
    if (!els.length) throw new Error("Nothing to export");
    const pageBg = backgroundOf(els[els.length - 1].parentElement!);
    const textColor = toHex(getComputedStyle(clone).color);
    const fontEmbedCSS = await getFontEmbedCSS(clone);

    const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const scale = (pageW - MARGIN * 2) / STAGE_WIDTH; // pt per px
    const usable = (pageH - MARGIN * 2 - FOOTER) / scale; // px of content per page

    const paintPage = () => {
      doc.setFillColor(pageBg);
      doc.rect(0, 0, pageW, pageH, "F");
    };
    paintPage();

    const stageLeft = stage.getBoundingClientRect().left;
    let pageTop = els[0].getBoundingClientRect().top; // stage y where the current page starts
    let first = true;
    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      const rect = el.getBoundingClientRect();
      // Keep a heading on the same page as the block after it (unless that
      // block is page-sized anyway).
      const next = /^H[1-6]$/.test(el.tagName) ? els[i + 1]?.getBoundingClientRect() : undefined;
      const bottom = next && next.bottom - rect.top <= usable ? next.bottom : rect.bottom;
      if (!first && bottom - pageTop > usable) {
        doc.addPage();
        paintPage();
        pageTop = rect.top;
      }
      first = false;

      // margin:0 — the snapshot is sized to the border box, so a copied margin
      // would push content down and clip its last line.
      const canvas = await toCanvas(el, { pixelRatio: 2, backgroundColor: pageBg, fontEmbedCSS, imagePlaceholder: BLANK_PNG, style: { margin: "0" } });
      const pxPerCss = canvas.height / rect.height;
      // A block taller than the space left (a long table, a big diagram) is
      // sliced across pages; everything else goes on in one piece.
      let offset = 0;
      while (offset < rect.height) {
        const room = usable - (rect.top + offset - pageTop);
        const h = Math.min(rect.height - offset, room);
        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = Math.max(1, Math.round(h * pxPerCss));
        slice.getContext("2d")!.drawImage(canvas, 0, -Math.round(offset * pxPerCss));
        // Explicit JPEG quality: jsPDF's default for a canvas is lossless-ish
        // and makes a 60-page note ~50MB.
        doc.addImage(slice.toDataURL("image/jpeg", 0.82), "JPEG", MARGIN + (rect.left - stageLeft) * scale, MARGIN + (rect.top + offset - pageTop) * scale, rect.width * scale, h * scale, undefined, "FAST");
        offset += h;
        if (offset < rect.height) {
          doc.addPage();
          paintPage();
          pageTop = rect.top + offset;
        }
      }
      onProgress?.(Math.round(((i + 1) / els.length) * 100));
    }

    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(textColor);
      doc.text(footer, MARGIN, pageH - MARGIN / 2 - 2);
      doc.text(`${p} / ${pages}`, pageW - MARGIN, pageH - MARGIN / 2 - 2, { align: "right" });
    }
    doc.save(`${filename.replace(/[^\w.-]+/g, "_") || "notes"}.pdf`);
  } finally {
    stage.remove();
  }
}

// First non-transparent background walking up from el — the "paper" color
// the blocks sit on, so the PDF page matches it edge to edge.
function backgroundOf(el: HTMLElement | null): string {
  for (; el; el = el.parentElement) {
    const bg = getComputedStyle(el).backgroundColor;
    if (bg && bg !== "transparent" && !/rgba\(.*,\s*0\)$/.test(bg)) return toHex(bg);
  }
  return "#ffffff";
}

// jsPDF's color setters take hex, not rgb() — and modern Chrome may report
// color(srgb …) / oklch for color-mix() values, so let a canvas normalize it.
function toHex(color: string): string {
  const ctx = document.createElement("canvas").getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillStyle = color;
  const v = ctx.fillStyle;
  if (v.startsWith("#")) return v;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

const BLANK_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
