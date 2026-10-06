import { NextResponse } from "next/server";
import { getUnifiedPyqArchive } from "@/lib/pyq-catalog";

// Data for the /pyq-notes "Full archive" browser. It used to be passed as
// page props, which inlined ~15MB of HTML into the page; as JSON it is
// fetched once, gzipped and CDN-cached. Unmatched papers were never shown.
export const dynamic = "force-dynamic";

export async function GET() {
  const papers = (await getUnifiedPyqArchive()).filter(
    (p) => p.canonicalProgramme && p.canonicalMappingStatus !== "UNMATCHED",
  );
  return NextResponse.json(papers, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
