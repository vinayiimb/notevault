import { NextRequest, NextResponse } from "next/server";
import { searchSubjects } from "@/lib/data";
import { levelLabel } from "@/lib/utils";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/rate-limit";

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 100;
const MAX_RESULTS = 8;

// Powers the live typeahead dropdown under the site search bar — a lighter,
// capped version of the full /search results page's query. Server-side
// floor on query length backs up the client-side debounce/gate in
// search-bar.tsx — a request that slips through (e.g. a direct API call)
// still can't force a 1-character scan. See
// docs/PHASE_2_QUERY_REMEDIATION.md item 6.
export async function GET(request: NextRequest) {
  // Phase 2I: this route had no rate limit despite being public and
  // callable directly (bypassing the client's debounce entirely) — 60/min
  // is generous enough for real typeahead use (well above what a 400ms
  // debounce could ever produce) while still bounding direct-call abuse.
  const rateLimit = checkRateLimit(`search-suggestions:${clientIpFromHeaders(request.headers)}`, 60, 60);
  if (!rateLimit.ok) {
    return NextResponse.json(
      { results: [], error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  const raw = request.nextUrl.searchParams.get("q") ?? "";
  const q = raw.trim().slice(0, MAX_QUERY_LENGTH);
  if (q.length < MIN_QUERY_LENGTH) return NextResponse.json({ results: [] });

  const subjects = await searchSubjects(q);
  const results = subjects.slice(0, MAX_RESULTS).map((s) => ({
    id: s.id,
    name: s.name,
    context: `${levelLabel(s.term.program.level)} · ${s.term.program.name} · ${s.term.name}`,
  }));

  return NextResponse.json({ results });
}
