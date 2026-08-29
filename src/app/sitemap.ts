import type { MetadataRoute } from "next";
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
 * Sitemap for DU PYQ Online.
 *
 * Split with `generateSitemaps()` so `/sitemap.xml` is a sitemap *index*
 * pointing at `/sitemap/<id>.xml` shards, each well under Google's 50,000-URL
 * limit. Shards:
 *
 *   static      — homepage, main nav, indexable tools, blog index
 *   blog        — every published blog post
 *   programmes  — /papers/[programmeSlug]           (Level 1)
 *   subjects-*  — /papers/[programmeSlug]/[subjectSlug]  (Level 2), chunked
 *   paper-codes-* — /paper-code/[code]              (Level 3), chunked
 *   papers-*    — /paper/[slug]                     (Level 4), chunked
 *
 * All URLs are built from the versioned static question-bank JSON — no
 * database call — so the sitemap is deterministic and can never silently
 * collapse to "static routes only" the way the old DB-backed version did.
 *
 * Every URL here returns 200, is self-canonical, is indexable, and has real
 * content. noindex pages (thin subjects, non-programme buckets, invalid
 * codes) are excluded upstream by the `getIndexable*Urls()` helpers.
 */

const CHUNK = 20_000;

// Real modification time of the data file — used for JSON-derived URLs
// instead of `new Date()` so we don't tell Google everything changed today.
function dataFileLastModified(): Date {
  try {
    return fs.statSync(
      path.join(process.cwd(), "public", "data", "du-question-bank-full-mapped.json"),
    ).mtime;
  } catch {
    return new Date("2026-01-01");
  }
}

const STATIC_ROUTES: {
  path: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
}[] = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/previous-year-papers", priority: 0.9, changeFrequency: "daily" },
  { path: "/papers", priority: 0.9, changeFrequency: "daily" },
  { path: "/notes", priority: 0.8, changeFrequency: "weekly" },
  { path: "/syllabus", priority: 0.7, changeFrequency: "weekly" },
  { path: "/browse/college", priority: 0.7, changeFrequency: "weekly" },
  { path: "/semesters", priority: 0.6, changeFrequency: "weekly" },
  { path: "/pyq-notes", priority: 0.8, changeFrequency: "daily" },
  { path: "/pyp", priority: 0.8, changeFrequency: "daily" },
  { path: "/practice", priority: 0.6, changeFrequency: "weekly" },
  { path: "/exam-sessions", priority: 0.6, changeFrequency: "weekly" },
  { path: "/tools", priority: 0.5, changeFrequency: "monthly" },
  { path: "/tools/exam-kit", priority: 0.4, changeFrequency: "monthly" },
  { path: "/tools/du-paper-code-finder", priority: 0.5, changeFrequency: "monthly" },
  { path: "/blog", priority: 0.5, changeFrequency: "weekly" },
  { path: "/resources", priority: 0.5, changeFrequency: "monthly" },
];

type ShardId =
  | "static"
  | "blog"
  | "programmes"
  | `subjects-${number}`
  | `paper-codes-${number}`
  | `papers-${number}`;

function chunkCount(total: number): number {
  return Math.max(1, Math.ceil(total / CHUNK));
}

export async function generateSitemaps(): Promise<{ id: ShardId }[]> {
  const [subjectUrls, paperCodeUrls, paperUrls] = await Promise.all([
    getIndexableSubjectUrls(),
    getIndexablePaperCodeUrls(),
    getIndexablePaperUrls(),
  ]);

  const ids: { id: ShardId }[] = [{ id: "static" }, { id: "blog" }, { id: "programmes" }];
  for (let i = 0; i < chunkCount(subjectUrls.length); i++) ids.push({ id: `subjects-${i}` });
  for (let i = 0; i < chunkCount(paperCodeUrls.length); i++) ids.push({ id: `paper-codes-${i}` });
  for (let i = 0; i < chunkCount(paperUrls.length); i++) ids.push({ id: `papers-${i}` });
  return ids;
}

function slice(urls: SitemapUrl[], shard: string, prefix: string): SitemapUrl[] {
  const idx = Number(shard.slice(prefix.length));
  return urls.slice(idx * CHUNK, idx * CHUNK + CHUNK);
}

export default async function sitemap({
  id,
}: {
  id: Promise<ShardId>;
}): Promise<MetadataRoute.Sitemap> {
  const shard = await id;
  const dataMtime = dataFileLastModified();

  if (shard === "static") {
    return STATIC_ROUTES.map((r) => ({
      url: absoluteUrl(r.path),
      changeFrequency: r.changeFrequency,
      priority: r.priority,
    }));
  }

  if (shard === "blog") {
    return getAllBlogPosts().map((post) => ({
      url: absoluteUrl(`/blog/${post.slug}`),
      lastModified: new Date(post.updatedAt ?? post.publishedAt),
      changeFrequency: "monthly",
      priority: 0.5,
    }));
  }

  if (shard === "programmes") {
    const urls = await getIndexableProgrammeUrls();
    return urls.map((u) => ({
      url: absoluteUrl(u.path),
      lastModified: u.lastModified ?? dataMtime,
      changeFrequency: "weekly",
      priority: 0.8,
    }));
  }

  if (shard.startsWith("subjects-")) {
    const all = await getIndexableSubjectUrls();
    return slice(all, shard, "subjects-").map((u) => ({
      url: absoluteUrl(u.path),
      lastModified: u.lastModified ?? dataMtime,
      changeFrequency: "monthly",
      priority: 0.7,
    }));
  }

  if (shard.startsWith("paper-codes-")) {
    const all = await getIndexablePaperCodeUrls();
    return slice(all, shard, "paper-codes-").map((u) => ({
      url: absoluteUrl(u.path),
      lastModified: u.lastModified ?? dataMtime,
      changeFrequency: "monthly",
      priority: 0.6,
    }));
  }

  if (shard.startsWith("papers-")) {
    const all = await getIndexablePaperUrls();
    return slice(all, shard, "papers-").map((u) => ({
      url: absoluteUrl(u.path),
      lastModified: u.lastModified ?? dataMtime,
      changeFrequency: "yearly",
      priority: 0.5,
    }));
  }

  return [];
}
