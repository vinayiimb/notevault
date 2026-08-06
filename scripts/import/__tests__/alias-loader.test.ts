import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadApprovedProgramAliases } from "../lib/alias-loader";

async function withTempMappingFile(content: unknown, run: (path: string) => Promise<void>) {
  const dir = await mkdtemp(path.join(tmpdir(), "alias-loader-test-"));
  const file = path.join(dir, "program-aliases.json");
  await writeFile(file, JSON.stringify(content), "utf-8");
  try {
    await run(file);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("loadApprovedProgramAliases only returns approvalStatus: approved entries", async () => {
  await withTempMappingFile(
    {
      entries: [
        { sourceProgramSlug: "bcom-h", targetProgramSlug: "bcom-hons", approvalStatus: "approved" },
        { sourceProgramSlug: "all-sec", targetProgramSlug: "university-wide-skill-enhancement-course-pool", approvalStatus: "pending" },
        { sourceProgramSlug: "ba-h-english", targetProgramSlug: "ba-hons-english", approvalStatus: "needs-review" },
        { sourceProgramSlug: "ba-programme", targetProgramSlug: null, approvalStatus: "unresolved" },
      ],
    },
    async (file) => {
      const map = await loadApprovedProgramAliases(file);
      assert.equal(map.size, 1);
      assert.equal(map.get("bcom-h"), "bcom-hons");
      assert.equal(map.has("all-sec"), false);
      assert.equal(map.has("ba-h-english"), false);
      assert.equal(map.has("ba-programme"), false);
    },
  );
});

test("loadApprovedProgramAliases returns an empty map when the mapping file doesn't exist yet", async () => {
  const map = await loadApprovedProgramAliases("data/import-mappings/does-not-exist.json");
  assert.equal(map.size, 0);
});

test("loadApprovedProgramAliases ignores an approved entry with a null target", async () => {
  await withTempMappingFile(
    { entries: [{ sourceProgramSlug: "ba-programme", targetProgramSlug: null, approvalStatus: "approved" }] },
    async (file) => {
      const map = await loadApprovedProgramAliases(file);
      assert.equal(map.size, 0);
    },
  );
});
