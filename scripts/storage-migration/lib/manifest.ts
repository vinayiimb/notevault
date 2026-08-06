import { mkdir, writeFile, readFile } from "node:fs/promises";
import type { MigrationManifest, UploadStateFile } from "./types";

const DIR = "reports/storage-migration";
const MANIFEST_PATH = `${DIR}/plan-manifest.json`;
const STATE_PATH = `${DIR}/upload-state.json`;

export async function writeManifest(manifest: MigrationManifest): Promise<string> {
  await mkdir(DIR, { recursive: true });
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
  return MANIFEST_PATH;
}

export async function readManifest(): Promise<MigrationManifest> {
  return JSON.parse(await readFile(MANIFEST_PATH, "utf-8"));
}

export async function readUploadState(): Promise<UploadStateFile> {
  try {
    return JSON.parse(await readFile(STATE_PATH, "utf-8"));
  } catch {
    return { updatedAt: new Date().toISOString(), completed: {} };
  }
}

export async function writeUploadState(state: UploadStateFile): Promise<void> {
  await mkdir(DIR, { recursive: true });
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2) + "\n", "utf-8");
}
