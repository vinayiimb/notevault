import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  NOTE_THEMES,
  findCanonicalSubject,
  getCanonicalNote,
  saveCanonicalNote,
} from "@/lib/canonical-subject-notes-data";

// Paper OCR Studio → Admin → Subject Notes, without opening the admin page. Same write the editor's
// Save button does (saveCanonicalNote). Off unless NOTES_IMPORT_TOKEN is set; callers send it as a Bearer token.
//   GET  ?programmeSlug=&subjectSlug=   what is there now (so the caller can warn before overwriting)
//   POST {programmeSlug, subjectSlug, content, theme?, semester?, isFree?, replace?}
//        409 if a note already exists and replace is not true.
export const dynamic = "force-dynamic";

const MAX_CHARS = 4_000_000;

function denied(req: Request) {
  const want = process.env.NOTES_IMPORT_TOKEN;
  if (!want) return NextResponse.json({ error: "Importing is off: NOTES_IMPORT_TOKEN is not set on the server." }, { status: 503 });
  const got = Buffer.from(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "");
  const exp = Buffer.from(want);
  return got.length === exp.length && timingSafeEqual(got, exp) ? null : NextResponse.json({ error: "Wrong token." }, { status: 401 });
}

async function target(programmeSlug: unknown, subjectSlug: unknown) {
  const found = typeof programmeSlug === "string" && typeof subjectSlug === "string" ? await findCanonicalSubject(programmeSlug, subjectSlug) : null;
  return found ? { found, slugs: { programmeSlug: programmeSlug as string, subjectSlug: subjectSlug as string } } : null;
}

export async function GET(req: Request) {
  const no = denied(req);
  if (no) return no;
  const q = new URL(req.url).searchParams;
  const t = await target(q.get("programmeSlug"), q.get("subjectSlug"));
  if (!t) return NextResponse.json({ error: "No such programme / subject." }, { status: 404 });
  const note = await getCanonicalNote(t.slugs.programmeSlug, t.slugs.subjectSlug);
  return NextResponse.json({
    programme: t.found.programme.name,
    subject: t.found.subject,
    exists: Boolean(note?.content),
    chars: note?.content.length ?? 0,
    updatedAt: note?.updatedAt ?? null,
    theme: note?.theme ?? "sky",
    semester: note?.semester ?? null,
    isFree: note?.isFree ?? false,
  });
}

export async function POST(req: Request) {
  const no = denied(req);
  if (no) return no;
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const content = typeof b?.content === "string" ? b.content.trim() : "";
  if (!content) return NextResponse.json({ error: "content is empty." }, { status: 400 });
  if (content.length > MAX_CHARS) return NextResponse.json({ error: "content is too large." }, { status: 413 });
  const t = await target(b?.programmeSlug, b?.subjectSlug);
  if (!t) return NextResponse.json({ error: "No such programme / subject." }, { status: 404 });

  const existing = await getCanonicalNote(t.slugs.programmeSlug, t.slugs.subjectSlug);
  if (existing?.content && b?.replace !== true) {
    return NextResponse.json({ error: "A note is already there.", exists: true, chars: existing.content.length, updatedAt: existing.updatedAt }, { status: 409 });
  }
  const theme = NOTE_THEMES.find((x) => x === b?.theme) ?? existing?.theme ?? "sky";
  const sem = Number(b?.semester);
  const semester = Number.isInteger(sem) && sem >= 1 && sem <= 8 ? sem : (existing?.semester ?? null);
  const isFree = typeof b?.isFree === "boolean" ? b.isFree : (existing?.isFree ?? false);

  await saveCanonicalNote({ ...t.slugs, programme: t.found.programme.name, subject: t.found.subject, content, theme, semester, isFree });
  return NextResponse.json({ ok: true, replaced: Boolean(existing?.content), chars: content.length, programme: t.found.programme.name, subject: t.found.subject, url: `/notes/${t.slugs.programmeSlug}/${t.slugs.subjectSlug}` });
}
