import { NextRequest, NextResponse } from "next/server";
import { searchSubjects } from "@/lib/data";
import { levelLabel } from "@/lib/utils";

// Powers the live typeahead dropdown under the site search bar — a lighter,
// capped version of the full /search results page's query.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  if (!q.trim()) return NextResponse.json({ results: [] });

  const subjects = await searchSubjects(q);
  const results = subjects.slice(0, 8).map((s) => ({
    id: s.id,
    name: s.name,
    context: `${levelLabel(s.term.program.level)} · ${s.term.program.name} · ${s.term.name}`,
  }));

  return NextResponse.json({ results });
}
