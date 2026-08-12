import { NextRequest, NextResponse } from "next/server";
import { getDuPypForProgramme } from "@/lib/du-pyp-data";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const programme = searchParams.get("programme");

  if (!programme) {
    return NextResponse.json({ error: "Missing programme parameter" }, { status: 400 });
  }

  const data = getDuPypForProgramme(programme);
  return NextResponse.json(data);
}
