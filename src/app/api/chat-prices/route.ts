import { NextResponse } from "next/server";
import { NOTES_DELIVERY_HOURS, ORDER_PRICE, SEMESTER_SUBJECTS } from "@/lib/notes-orders";

// Public and tiny: the live-chat bot reads this so the prices it shows always match what /chat-pay charges.
// (The charge itself is always decided server-side from ORDER_PRICE, never from what the chat shows.)
export function GET() {
  return NextResponse.json(
    { subject: ORDER_PRICE.subject, three: ORDER_PRICE.three, semester: ORDER_PRICE.semester, semesterSubjects: SEMESTER_SUBJECTS, deliveryHours: NOTES_DELIVERY_HOURS },
    { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" } },
  );
}
