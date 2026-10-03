import { NextResponse } from "next/server";
import {
  getProgrammeSemesterNumbers,
  getSeoProgrammes,
  isProgrammeIndexable,
  isSubjectIndexable,
} from "@/lib/du-pyp-seo";
import { SITE_URL } from "@/lib/seo";
import { parsePyqQuery } from "@/lib/telegram-pyq";

export const dynamic = "force-dynamic";

const HELP =
  "Send a subject or course and I'll reply with the papers page.\nExamples:\n/pyq bcom sem1\n/pyq finance for everyone\n/pyq economics micro";

/** Links to site pages for a query like "bcom sem1" or "sec finance". Never sends PDFs. */
async function answer(raw: string): Promise<string> {
  const { sem, tokens } = parsePyqQuery(raw);
  if (tokens.length === 0) return HELP;

  const progs = (await getSeoProgrammes()).filter(isProgrammeIndexable);
  const lines: string[] = [];
  if (sem) {
    for (const p of progs.filter((p) => tokens.every((t) => p.slug.includes(t))).sort((a, b) => b.totalPapers - a.totalPapers).slice(0, 4)) {
      if ((await getProgrammeSemesterNumbers(p.slug)).includes(sem))
        lines.push(`${p.name} Sem ${sem}: ${SITE_URL}/papers/${p.slug}/semester-${sem}`);
    }
  }
  if (lines.length === 0) {
    const hits = progs.flatMap((p) =>
      p.subjects
        .filter((s) => isSubjectIndexable(s) && tokens.every((t) => `${s.name} ${p.name}`.toLowerCase().includes(t)))
        .map((s) => ({ p, s })),
    );
    for (const { p, s } of hits.sort((a, b) => b.s.papers.length - a.s.papers.length).slice(0, 5))
      lines.push(`${s.name} (${p.name}, ${s.papers.length} papers): ${SITE_URL}/papers/${p.slug}/${s.slug}`);
  }
  return lines.length ? lines.join("\n\n") : `Nothing found. Browse everything: ${SITE_URL}/previous-year-papers`;
}

export async function POST(req: Request) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  // Off unless both are configured; the secret proves the call came from Telegram.
  if (!token || !secret || req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return new NextResponse(null, { status: 404 });
  }
  const msg = (await req.json().catch(() => null))?.message;
  if (msg?.text && msg.chat?.id) {
    const text = /^\/start/.test(msg.text) ? `Welcome to DU PYQ Online!\n${HELP}` : await answer(msg.text);
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: msg.chat.id, text }),
    });
  }
  return NextResponse.json({ ok: true });
}
