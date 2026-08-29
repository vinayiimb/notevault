import { listShardNames, renderSitemapIndex, dataFileLastModified } from "@/lib/sitemap-shards";

// Static index — the shard set only changes when the data file changes.
export const dynamic = "force-static";
export const revalidate = 86400;

/**
 * `/sitemap.xml` — the sitemap *index*. Points at `/sitemaps/<shard>.xml`.
 * This is the URL declared in `robots.ts`; Google follows it to every shard.
 */
export async function GET() {
  const [names] = await Promise.all([listShardNames()]);
  const xml = renderSitemapIndex(names, dataFileLastModified());
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=86400, stale-while-revalidate=86400",
    },
  });
}
