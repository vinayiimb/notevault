import test from "node:test";
import assert from "node:assert/strict";
import { htmlNoteTitleOnly, isHtmlNote } from "../content/html-note";
import { previewOf } from "../paid-notes-pricing";

const page = `<!DOCTYPE html>\n<html><head><title>PYQ Bank &amp; Co</title><style>p{color:red}</style></head><body><p>one</p>\n<!-- preview-end -->\n<p>two</p></body></html>`;

test("detects a whole html page, not markdown or inline html", () => {
  assert.equal(isHtmlNote(page), true);
  assert.equal(isHtmlNote("  \n<html lang=en><body>x</body></html>"), true);
  assert.equal(isHtmlNote("# Title\n\n<div class=\"x\">hi</div>"), false);
  assert.equal(isHtmlNote("<div>fragment</div>"), false);
});

test("paid html preview: marker cuts, no marker shows title only (never half a <style>)", () => {
  const withMarker = previewOf(page);
  assert.equal(withMarker.truncated, true);
  assert.ok(withMarker.preview.includes("one") && !withMarker.preview.includes("two"));
  const noMarker = previewOf(page.replace("<!-- preview-end -->", ""));
  assert.equal(noMarker.truncated, true);
  assert.equal(noMarker.preview, htmlNoteTitleOnly(page));
  assert.ok(!noMarker.preview.includes("<style"));
});
