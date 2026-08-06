import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateMimeType,
  validateFileSize,
  sanitizeFileName,
  validateNoExecutableExtension,
  validateR2ObjectKey,
  validateUploadInput,
} from "../validation";

test("validateMimeType rejects a type not on the category's allowlist", () => {
  assert.equal(validateMimeType("papers", "application/pdf").length, 0);
  assert.equal(validateMimeType("papers", "image/png").length, 1);
  assert.equal(validateMimeType("thumbnails", "image/png").length, 0);
});

test("validateFileSize rejects empty files and files over the category limit", () => {
  assert.equal(validateFileSize("papers", 0).length, 1);
  assert.equal(validateFileSize("papers", 1024).length, 0);
  assert.equal(validateFileSize("papers", 51 * 1024 * 1024).length, 1);
  assert.equal(validateFileSize("thumbnails", 4 * 1024 * 1024).length, 0);
  assert.equal(validateFileSize("thumbnails", 6 * 1024 * 1024).length, 1);
});

test("sanitizeFileName strips path separators (path traversal) and null bytes", () => {
  const traversalResult = sanitizeFileName("../../etc/passwd");
  assert.ok(!traversalResult.includes("/"), "no slash must survive sanitization");
  assert.equal(traversalResult, "_.._etc_passwd"); // "/" -> "_", leading ".." stripped once, no traversal capability left

  assert.equal(sanitizeFileName("normal-paper_2024.pdf"), "normal-paper_2024.pdf");
  assert.equal(sanitizeFileName("weird\0name.pdf"), "weirdname.pdf");
  assert.equal(sanitizeFileName("  spaced name (final).pdf  "), "spaced_name_final_.pdf");
  assert.equal(sanitizeFileName(""), "file");
});

test("validateNoExecutableExtension blocks common executable/script extensions", () => {
  assert.equal(validateNoExecutableExtension("paper.pdf").length, 0);
  assert.equal(validateNoExecutableExtension("malware.exe").length, 1);
  assert.equal(validateNoExecutableExtension("script.sh").length, 1);
  assert.equal(validateNoExecutableExtension("shell.php").length, 1);
  assert.equal(validateNoExecutableExtension("archive.zip.exe").length, 1);
});

test("validateR2ObjectKey rejects path traversal and leading/trailing slashes", () => {
  assert.equal(validateR2ObjectKey("papers/bcom-hons/sem-5/2024/abc123.pdf").length, 0);
  assert.equal(validateR2ObjectKey("papers/../../etc/passwd").length > 0, true);
  assert.equal(validateR2ObjectKey("/papers/leading-slash.pdf").length > 0, true);
  assert.equal(validateR2ObjectKey("papers/trailing-slash.pdf/").length > 0, true);
  assert.equal(validateR2ObjectKey("").length > 0, true);
});

test("validateUploadInput combines all three checks", () => {
  const issues = validateUploadInput({
    category: "papers",
    fileName: "paper.exe",
    contentType: "image/png",
    sizeBytes: 0,
  });
  // wrong MIME + empty file + executable extension
  assert.equal(issues.length, 3);
});
