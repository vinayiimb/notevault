import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPaymentSettings } from "@/lib/paid-notes";

export const dynamic = "force-dynamic"; // reads the DB — never at build time

// Which subjects have notes, for the quiet "notes for this subject" line on
// /papers. Cached in memory: it changes only when an admin publishes notes.
const TTL_MS = 5 * 60 * 1000;
let cached: { at: number; body: { paid: boolean; items: string[] } } | null = null;

export async function GET() {
  if (!cached || Date.now() - cached.at > TTL_MS) {
    try {
      const [notes, settings] = await Promise.all([
        prisma.canonicalSubjectNote.findMany({
          where: { NOT: { content: "" } },
          select: { programmeSlug: true, subjectSlug: true },
        }),
        getPaymentSettings(),
      ]);
      cached = {
        at: Date.now(),
        body: { paid: settings.active, items: notes.map((n) => `${n.programmeSlug}/${n.subjectSlug}`) },
      };
    } catch {
      return NextResponse.json({ paid: false, items: [] });
    }
  }
  return NextResponse.json(cached.body, { headers: { "Cache-Control": "public, max-age=300" } });
}
