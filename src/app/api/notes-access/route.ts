import { NextResponse, type NextRequest } from "next/server";
import { getCanonicalNote } from "@/lib/canonical-subject-notes-data";
import { getNoteAccess } from "@/lib/paid-notes";

// Tells the public note page what this visitor may do with a paid note.
// The page itself stays ISR-cached with just the free preview, and GatedNotes
// calls this on mount. Enrolled students do NOT get the text here: they read
// the full note inside their dashboard (/account/notes/...), after logging in.
// The text only comes back for admins, and for notes that aren't paywalled.
export async function GET(request: NextRequest) {
  const programmeSlug = request.nextUrl.searchParams.get("p") ?? "";
  const subjectSlug = request.nextUrl.searchParams.get("s") ?? "";
  const headers = { "Cache-Control": "private, no-store" };

  const access = await getNoteAccess(programmeSlug, subjectSlug);
  // 200, not 402: "locked" is an expected answer, not an error (a 4xx
  // shows up as a red console error for every visitor).
  if (access === "locked") return NextResponse.json({ locked: true }, { headers });
  if (access === "owner") return NextResponse.json({ owned: true }, { headers });

  const note = await getCanonicalNote(programmeSlug, subjectSlug);
  if (!note?.content.trim()) return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  // `admin` lets the page say why it's unlocked — admins bypass the paywall,
  // which otherwise looks like "the lock is broken" when testing.
  return NextResponse.json({ content: note.content, admin: access === "admin" }, { headers });
}
