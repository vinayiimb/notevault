import { gzipSync } from "node:zlib";
import { getUnifiedPyqArchive } from "@/lib/pyq-catalog";
import type { CatalogPaper } from "@/lib/pyq-catalog-types";

// Data for the /pyq-notes "Full archive" browser. It used to be passed as
// page props, which inlined ~15MB of HTML into the page; as JSON it is
// fetched once. Unmatched papers were never shown.
export const dynamic = "force-dynamic";

// Next doesn't compress route-handler responses here (1.6MB went out raw),
// so gzip once per archive build and reuse the buffer.
let memo: { src: CatalogPaper[]; json: string; gz: Buffer } | null = null;

export async function GET(req: Request) {
  const archive = await getUnifiedPyqArchive();
  if (memo?.src !== archive) {
    const json = JSON.stringify(
      archive.filter((p) => p.canonicalProgramme && p.canonicalMappingStatus !== "UNMATCHED"),
    );
    memo = { src: archive, json, gz: gzipSync(json) };
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    Vary: "Accept-Encoding",
  };
  if (!/\bgzip\b/.test(req.headers.get("accept-encoding") ?? "")) {
    return new Response(memo.json, { headers });
  }
  return new Response(new Uint8Array(memo.gz), { headers: { ...headers, "Content-Encoding": "gzip" } });
}
