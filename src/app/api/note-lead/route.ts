import { NextResponse } from "next/server";
import { submitNoteLeadAction } from "@/lib/note-lead-actions";
import { notifyOwner } from "@/lib/owner-notify";
import { leadLostAlert } from "@/lib/owner-messages";
import { parseLeadPhone } from "@/lib/note-leads";

// The pop-up's "save my number" step. It used to be a Next.js server action, and a visitor whose page came from an
// older deployment got "Failed to find Server Action", which threw and replaced the whole page with the error
// screen. A plain POST works across deployments and always answers with JSON the form can show inline.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Something went wrong. Please try again." });
  try {
    return NextResponse.json(await submitNoteLeadAction({}, form));
  } catch (err) {
    console.error("note lead request failed:", err);
    // The number is in hand but could not be processed: do not lose it.
    const phone = parseLeadPhone(String(form.get("phone") ?? ""));
    if (phone) notifyOwner(leadLostAlert({ phone, programme: String(form.get("programmeName") ?? ""), subject: String(form.get("subjectName") ?? "") }));
    return NextResponse.json({ error: "Something went wrong. Please try again in a moment." });
  }
}
