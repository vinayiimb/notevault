import "server-only";
import fs from "node:fs";
import path from "node:path";
import { absoluteUrl } from "@/lib/seo";
import { getAllBlogPosts } from "@/lib/blog";
import {
  getIndexableProgrammeUrls,
  getIndexableSubjectUrls,
  getIndexablePaperCodeUrls,
  getIndexablePaperUrls,
  type SitemapUrl,
} from "@/lib/du-pyp-seo";

/**
 * Shared sitemap-shard model for `/sitemap.xml` (the index) and
 * `/sitemaps/[shard].xml` (the shards).
 *
 * Everything is built from the versioned static question-bank JSON — no
 * database call — so the sitemap is deterministic and can never silently
 * collapse to "static routes only" the way the old DB-backed sitemap did.
 *
 * We hand-roll the index + shards (rather than Next's `generateSitemaps`)
 * because this Next version does not serve an index document at
 * `/sitemap.xml` when `generateSitemaps` is used — only the shards — and
 * `robots.txt` needs a working `/sitemap.xml` to point crawlers at.
 */

const CHUNK = 20_000;

type EntryFreq =
  | "always"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "never";

export interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: EntryFreq;
  priority?: number;
}

/** Real mtime of the data file — used for JSON-derived URLs instead of now(). */
function dataFileLastModified(): string {
  try {
    return fs
      .statSync(path.join(process.cwd(), "public", "data", "du-question-bank-full-mapped.json"))
      .mtime.toISOString();
  } catch {
    return new Date("2026-01-01").toISOString();
  }
}

const STATIC_ROUTES: { path: string; priority: number; changefreq: EntryFreq }[] = [
  { path: "/", priority: 1, changefreq: "daily" },
  { path: "/previous-year-papers", priority: 0.9, changefreq: "daily" },
  { path: "/papers", priority: 0.9, changefreq: "daily" },
  { path: "/notes", priority: 0.8, changefreq: "weekly" },
  { path: "/syllabus", priority: 0.7, changefreq: "weekly" },
  { path: "/browse/college", priority: 0.7, changefreq: "weekly" },
  { path: "/semesters", priority: 0.6, changefreq: "weekly" },
  { path: "/pyq-notes", priority: 0.8, changefreq: "daily" },
  { path: "/pyp", priority: 0.8, changefreq: "daily" },
  { path: "/practice", priority: 0.6, changefreq: "weekly" },
  { path: "/exam-sessions", priority: 0.6, changefreq: "weekly" },
  { path: "/tools", priority: 0.5, changefreq: "monthly" },
  { path: "/tools/exam-kit", priority: 0.4, changefreq: "monthly" },
  { path: "/tools/du-paper-code-finder", priority: 0.5, changefreq: "monthly" },
  { path: "/blog", priority: 0.5, changefreq: "weekly" },
  { path: "/resources", priority: 0.5, changefreq: "monthly" },
];

function chunkCount(total: number): number {
  return Math.max(1, Math.ceil(total / CHUNK));
}

/** Ordered list of shard names, e.g. ["static","blog","programmes","subjects-0",…]. */
export async function listShardNames(): Promise<string[]> {
  const [subjectUrls, paperCodeUrls, paperUrls] = await Promise.all([
    getIndexableSubjectUrls(),
    getIndexablePaperCodeUrls(),
    getIndexablePaperUrls(),
  ]);
  const names = ["static", "blog", "programmes"];
  for (let i = 0; i < chunkCount(subjectUrls.length); i++) names.push(`subjects-${i}`);
  for (let i = 0; i < chunkCount(paperCodeUrls.length); i++) names.push(`paper-codes-${i}`);
  for (let i = 0; i < chunkCount(paperUrls.length); i++) names.push(`papers-${i}`);
  return names;
}

function sliceFor(urls: SitemapUrl[], shard: string, prefix: string): SitemapUrl[] {
  const idx = Number(shard.slice(prefix.length));
  return urls.slice(idx * CHUNK, idx * CHUNK + CHUNK);
}

/** Entries for one shard. Returns null for an unknown shard name. */
export async function getShardEntries(shard: string): Promise<SitemapEntry[] | null> {
  const dataMtime = dataFileLastModified();

  if (shard === "static") {
    return STATIC_ROUTES.map((r) => ({
      loc: absoluteUrl(r.path),
      changefreq: r.changefreq,
      priority: r.priority,
    }));
  }

  if (shard === "blog") {
    return getAllBlogPosts().map((post) => ({
      loc: absoluteUrl(`/blog/${post.slug}`),
      lastmod: new Date(post.updatedAt ?? post.publishedAt).toISOString(),
      changefreq: "monthly",
      priority: 0.5,
    }));
  }

  if (shard === "programmes") {
    const urls = await getIndexableProgrammeUrls();
    return urls.map((u) => ({
      loc: absoluteUrl(u.path),
      lastmod: (u.lastModified ?? new Date(dataMtime)).toISOString?.() ?? dataMtime,
      changefreq: "weekly",
      priority: 0.8,
    }));
  }

  if (shard.startsWith("subjects-")) {
    const all = await getIndexableSubjectUrls();
    return sliceFor(all, shard, "subjects-").map((u) => ({
      loc: absoluteUrl(u.path),
      lastmod: dataMtime,
      changefreq: "monthly",
      priority: 0.7,
    }));
  }

  if (shard.startsWith("paper-codes-")) {
    const all = await getIndexablePaperCodeUrls();
    return sliceFor(all, shard, "paper-codes-").map((u) => ({
      loc: absoluteUrl(u.path),
      lastmod: dataMtime,
      changefreq: "monthly",
      priority: 0.6,
    }));
  }

  if (shard.startsWith("papers-")) {
    const all = await getIndexablePaperUrls();
    return sliceFor(all, shard, "papers-").map((u) => ({
      loc: absoluteUrl(u.path),
      lastmod: dataMtime,
      changefreq: "yearly",
      priority: 0.5,
    }));
  }

  return null;
}

const xmlEscape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderUrlset(entries: SitemapEntry[]): string {
  const body = entries
    .map((e) => {
      const parts = [`<loc>${xmlEscape(e.loc)}</loc>`];
      if (e.lastmod) parts.push(`<lastmod>${e.lastmod}</lastmod>`);
      if (e.changefreq) parts.push(`<changefreq>${e.changefreq}</changefreq>`);
      if (typeof e.priority === "number") parts.push(`<priority>${e.priority}</priority>`);
      return `<url>${parts.join("")}</url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function renderSitemapIndex(shardNames: string[], lastmod: string): string {
  const body = shardNames
    .map(
      (name) =>
        `<sitemap><loc>${xmlEscape(absoluteUrl(`/sitemaps/${name}.xml`))}</loc><lastmod>${lastmod}</lastmod></sitemap>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;
}

export { dataFileLastModified };
