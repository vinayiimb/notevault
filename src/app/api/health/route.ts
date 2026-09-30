import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Deploy health check: proves the Node server is up and answering, without
// touching the database or loading any data files, so a slow DB can't fail
// a deploy and a healthy deploy can't be marked broken.
export function GET() {
  return NextResponse.json({ ok: true });
}
