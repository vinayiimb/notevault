"use client";

import type { DatesheetEntry } from "./datesheet-types";

// Each programme's JSON is statically served from public/data/datesheet/
// (up to ~780KB for the largest file, DSE). Fetching on demand — instead
// of the server embedding all 19 files (6.7MB combined) into every page
// load — is what keeps the datesheet pages usable on mobile data.
const cache = new Map<string, Promise<DatesheetEntry[]>>();

export function fetchProgrammeEntries(slug: string): Promise<DatesheetEntry[]> {
  if (!slug) return Promise.resolve([]);
  const cached = cache.get(slug);
  if (cached) return cached;

  const promise = fetch(`/data/datesheet/${slug}.json`)
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Failed to load ${slug}`))))
    .catch((err) => {
      cache.delete(slug); // allow retry on next call
      throw err;
    });

  cache.set(slug, promise);
  return promise;
}
