import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Per-paper admin edits (replacement PDF link / hidden) for the /papers
// browser to layer on top of the static papers-catalog.json.
export async function GET() {
  try {
    const overrides = await prisma.catalogPaperOverride.findMany({
      select: { paperId: true, pdfUrl: true, hidden: true },
    });
    return NextResponse.json(overrides);
  } catch (err) {
    console.error("Failed to fetch paper overrides:", err);
    return NextResponse.json([]);
  }
}
