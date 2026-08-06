// Loads human-approved (never auto-approved — see data/import-mappings/*.json's
// own "note" field) alias mappings for the planner to apply. Only
// approvalStatus === "approved" entries are ever returned — "pending",
// "needs-review", and "unresolved" entries are proposals only and must
// never silently affect what the importer resolves.
import { readFile } from "node:fs/promises";

type ProgramAliasFile = {
  entries: Array<{ sourceProgramSlug: string; targetProgramSlug: string | null; approvalStatus: string }>;
};

/** Map of sourceProgramSlug -> targetProgramSlug, approved entries only. */
export async function loadApprovedProgramAliases(
  path = "data/import-mappings/program-aliases.json",
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let file: ProgramAliasFile;
  try {
    file = JSON.parse(await readFile(path, "utf-8"));
  } catch {
    return map; // No mapping file yet — planner behaves exactly as before (all unresolved).
  }
  for (const entry of file.entries ?? []) {
    if (entry.approvalStatus === "approved" && entry.targetProgramSlug) {
      map.set(entry.sourceProgramSlug, entry.targetProgramSlug);
    }
  }
  return map;
}
