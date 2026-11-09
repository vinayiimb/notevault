import { NextResponse, type NextRequest } from "next/server";
import { getStudentSession } from "@/lib/paid-notes";
import { recordActivity } from "@/lib/student-activity";
import { clampPercent, clampSeconds, isItemKey } from "@/lib/student-activity-format";

// Reading heartbeat from the student note reader: { key, seconds, opened }.
// Only a signed-in student's own cookie is accepted (admins reading notes are
// never tracked), and one beat can add at most MAX_BEAT_SECONDS.
export async function POST(request: NextRequest) {
  const session = await getStudentSession();
  if (!session) return new NextResponse(null, { status: 204 });
  const body = await request.json().catch(() => null);
  if (!isItemKey(body?.key)) return NextResponse.json({ error: "bad key" }, { status: 400 });
  try {
    await recordActivity(session.email, body.key, clampSeconds(body?.seconds), body?.opened === true, clampPercent(body?.scroll));
  } catch {
    // table missing (migration pending) or DB hiccup — tracking must never surface to the student
  }
  return new NextResponse(null, { status: 204 });
}
