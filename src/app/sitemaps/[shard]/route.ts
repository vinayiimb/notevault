import { notFound } from "next/navigation";
import { getShardEntries, listShardNames, renderUrlset } from "@/lib/sitemap-shards";

export const dynamic = "force-static";
export const dynamicParams = true;
export const revalidate = 86400;

export async function generateStaticParams() {
  const names = await listShardNames();
  return names.map((name) => ({ shard: `${name}.xml` }));
}

/**
 * `/sitemaps/<shard>.xml` — one shard of the sitemap. Each holds at most
 * 20,000 URLs, all 200 / self-canonical / indexable / useful.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ shard: string }> }) {
  const { shard } = await params;
  const name = shard.replace(/\.xml$/, "");
  const entries = await getShardEntries(name);
  if (!entries) notFound();

  return new Response(renderUrlset(entries), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=86400, stale-while-revalidate=86400",
    },
  });
}
