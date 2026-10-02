import { NextResponse, type NextRequest } from "next/server";
import { getCanonicalNote } from "@/lib/canonical-subject-notes-data";
import { getSession } from "@/lib/auth";
import { canReadFullNote } from "@/lib/paid-notes";

// Full text of a paid note, only for a signed-in student who bought it (or
// an admin). The notes page itself stays ISR-cached with just the free
// preview; GatedNotes calls this on mount to swap in the rest.
export async function GET(request: NextRequest) {
  const programmeSlug = request.nextUrl.searchParams.get("p") ?? "";
  const subjectSlug = request.nextUrl.searchParams.get("s") ?? "";
  const headers = { "Cache-Control": "private, no-store" };

  if (!(await canReadFullNote(programmeSlug, subjectSlug))) {
    // 200, not 402: "locked" is an expected answer, not an error (a 4xx
    // shows up as a red console error for every visitor).
    return NextResponse.json({ locked: true }, { headers });
  }
  const note = await getCanonicalNote(programmeSlug, subjectSlug);
  if (!note?.content.trim()) return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  // `admin` lets the page say why it's unlocked — admins bypass the paywall,
  // which otherwise looks like "the lock is broken" when testing.
  return NextResponse.json({ content: note.content, admin: !!(await getSession()) }, { headers });
}
