import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Per-paper admin edits (full edits, added papers, replacement links,
// hidden) for the /papers browsers to layer on top of the static catalog
// files — see applyPaperEdits() in src/lib/paper-edits.ts.
export async function GET() {
  try {
    const overrides = await prisma.catalogPaperOverride.findMany({
      select: {
        paperId: true,
        pdfUrl: true,
        hidden: true,
        course: true,
        subject: true,
        semester: true,
        yearRange: true,
        upc: true,
        paperType: true,
        verified: true,
        added: true,
      },
    });
    return NextResponse.json(overrides);
  } catch (err) {
    console.error("Failed to fetch paper overrides:", err);
    return NextResponse.json([]);
  }
}
