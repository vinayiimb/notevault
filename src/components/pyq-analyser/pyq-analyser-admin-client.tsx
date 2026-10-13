"use client";

import { useMemo, useRef, useState } from "react";
import { FileArrowUp, Sparkle, Trash } from "@phosphor-icons/react";
import { readPdfWithOcr } from "@/lib/pdf-ocr-client";
import { extractQuestionsChunkAction, savePaperQuestionsAction } from "@/lib/pyq-analyser-actions";
import { parseSolvedText } from "@/lib/pyq-analyser";

type Program = { id: string; name: string; terms: { id: string; name: string; subjects: { id: string; name: string }[] }[] };
type Row = {
  key: number;
  questionNumber: string;
  section: string;
  questionText: string;
  answerText: string;
  group: string;
  marks: number;
  topics: string;
  difficulty: "EASY" | "MEDIUM" | "HARD" | null;
};

const CHUNK = 5000;

// Greedy-pack paragraphs into chunks small enough for one free Groq request.
function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const para of text.split(/\n\s*\n/)) {
    for (let i = 0; i < para.length; i += CHUNK) {
      const piece = para.slice(i, i + CHUNK);
      if (current.length + piece.length > CHUNK && current) {
        chunks.push(current);
        current = "";
      }
      current += (current ? "\n\n" : "") + piece;
    }
  }
  if (current.trim()) chunks.push(current);
  return chunks;
}

const input = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none";

export function PyqAnalyserAdminClient({ programs, counts }: { programs: Program[]; counts: Record<string, number> }) {
  const [programId, setProgramId] = useState("");
  const [termId, setTermId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [group, setGroup] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const program = programs.find((p) => p.id === programId);
  const term = program?.terms.find((t) => t.id === termId);
  const subject = term?.subjects.find((s) => s.id === subjectId);
  const validYear = /^(19|20)\d{2}$/.test(year);
  const chunks = useMemo(() => chunkText(text), [text]);
  const solvedCount = useMemo(() => parseSolvedText(text).length, [text]);
  // A solved paste can hold several papers (e.g. Hons. + Programme): each
  // is saved to its own subject, one at a time.
  const groups = [...new Set(rows.map((r) => r.group))];
  const shown = groups.length > 1 ? rows.filter((r) => r.group === group) : rows;

  async function readFile(file: File) {
    setMessage(null);
    setBusy("Reading PDF…");
    try {
      setText(await readPdfWithOcr(file, (label, pct) => setBusy(`${label} (${pct}%)`)));
      const y = file.name.match(/\b(19|20)\d{2}\b/)?.[0];
      if (y) setYear(y);
    } catch (err) {
      setMessage({ ok: false, text: `Could not read that PDF: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setBusy("");
    }
  }

  async function extract() {
    setMessage(null);
    const solved = parseSolvedText(text);
    if (solved.length) {
      const found = solved.map((q, key) => ({
        key,
        group: q.group,
        questionNumber: q.questionNumber,
        section: "",
        questionText: q.questionText,
        answerText: q.answer,
        marks: 0,
        topics: q.unit,
        difficulty: null,
      }));
      setRows(found);
      setGroup(found[0].group);
      const n = new Set(found.map((r) => r.group)).size;
      setMessage({ ok: true, text: `Read ${found.length} solved questions with answers (no AI needed)${n > 1 ? ` from ${n} papers — save each paper to its own subject` : ""}.` });
      return;
    }
    const found: Row[] = [];
    try {
      for (let i = 0; i < chunks.length; i++) {
        setBusy(`AI is reading part ${i + 1} of ${chunks.length}…`);
        const res = await extractQuestionsChunkAction(subjectId, chunks[i]);
        if (!res.ok) throw new Error(res.error);
        for (const q of res.data.questions) {
          found.push({ ...q, key: found.length, group: "", answerText: "", topics: q.topics.join(", ") });
        }
      }
      setRows(found);
      setMessage({ ok: true, text: `Found ${found.length} questions. Check them, then save.` });
    } catch (err) {
      if (found.length) setRows(found);
      setMessage({ ok: false, text: `${err instanceof Error ? err.message : String(err)}${found.length ? ` (kept the ${found.length} found so far)` : ""}` });
    } finally {
      setBusy("");
    }
  }

  async function save() {
    setMessage(null);
    setBusy("Saving…");
    try {
      const res = await savePaperQuestionsAction({
        subjectId,
        year,
        questions: shown.map((r) => ({
          questionNumber: r.questionNumber.trim(),
          section: r.section.trim(),
          questionText: r.questionText.trim(),
          answerText: r.answerText.trim(),
          marks: Math.max(0, Math.round(Number(r.marks) || 0)),
          topics: r.topics.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 6),
          difficulty: r.difficulty,
        })),
      });
      const saved = new Set(shown.map((r) => r.key));
      const left = rows.filter((r) => !saved.has(r.key));
      setRows(left);
      if (left.length) setGroup(left[0].group);
      else setText("");
      setMessage({
        ok: true,
        text: `Saved to ${subject?.name}: ${res.created} new, ${res.merged} merged as repeats.${left.length ? ` Now pick the subject for “${left[0].group}” and save the rest.` : ""}`,
      });
    } catch (err) {
      setMessage({ ok: false, text: `Could not save: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setBusy("");
    }
  }

  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <div className="flex max-w-5xl flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-surface p-4 md:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Programme
          <select value={programId} onChange={(e) => (setProgramId(e.target.value), setTermId(""), setSubjectId(""))} className={input}>
            <option value="">Select…</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Semester
          <select value={termId} onChange={(e) => (setTermId(e.target.value), setSubjectId(""))} className={input} disabled={!program}>
            <option value="">Select…</option>
            {program?.terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Subject
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={input} disabled={!term}>
            <option value="">Select…</option>
            {term?.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {counts[s.id] ? ` (${counts[s.id]} Qs)` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Paper year
          <input value={year} onChange={(e) => setYear(e.target.value.trim())} inputMode="numeric" maxLength={4} className={input} />
        </label>
      </div>

      {subject && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">Paper text</p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={!!busy}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm transition hover:border-accent disabled:opacity-50"
            >
              <FileArrowUp size={16} /> Upload PDF
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) readFile(f);
                e.target.value = "";
              }}
            />
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            placeholder="Paste solved Q&A text (## … — QUESTION 1(a) / Question: / Unit tag: / answer), a plain question paper, or upload a PDF…"
            className={`${input} mt-3 font-mono text-xs`}
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={extract}
              disabled={!!busy || !text.trim()}
              className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:bg-accent-hover disabled:opacity-50"
            >
              <Sparkle size={16} weight="fill" /> {solvedCount ? `Read ${solvedCount} solved questions` : "Extract questions with AI"}
            </button>
            {text && (
              <span className="text-xs text-muted">
                {solvedCount ? "Solved format detected · answers kept · no AI" : `${chunks.length} part${chunks.length === 1 ? "" : "s"} · free Groq`}
              </span>
            )}
          </div>
        </div>
      )}

      {busy && <div className="rounded-lg border border-border bg-accent-soft px-4 py-3 text-sm text-foreground">{busy}</div>}
      {message && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${message.ok ? "border-border bg-accent-soft text-foreground" : "border-red-300 bg-red-50 text-red-600 dark:bg-red-950/30"}`}>
          {message.text}
        </div>
      )}

      {rows.length > 0 && (
        <div className="rounded-xl border border-border bg-surface">
          {groups.length > 1 && (
            <div className="flex flex-wrap gap-2 border-b border-border p-4">
              <span className="self-center text-xs font-medium text-muted">Paper:</span>
              {groups.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGroup(g)}
                  className={`rounded-full border px-3 py-1 text-xs transition ${g === group ? "border-accent bg-accent text-accent-foreground" : "border-border hover:border-accent"}`}
                >
                  {g} ({rows.filter((r) => r.group === g).length})
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
            <p className="text-sm font-semibold text-foreground">
              Review {shown.length} questions · {subject?.name ?? "pick a subject"} · {year}
            </p>
            <input
              inputMode="numeric"
              placeholder="Marks for all"
              onChange={(e) => {
                const marks = Number(e.target.value) || 0;
                const keys = new Set(shown.map((r) => r.key));
                setRows((rs) => rs.map((r) => (keys.has(r.key) ? { ...r, marks } : r)));
              }}
              className={`${input} w-32`}
            />
            <button
              type="button"
              onClick={save}
              disabled={!!busy || !validYear || !subject}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:bg-accent-hover disabled:opacity-50"
            >
              {validYear ? `Save ${shown.length} questions` : "Enter a valid year"}
            </button>
          </div>
          <ul className="divide-y divide-border">
            {shown.map((r) => (
              <li key={r.key} className="grid grid-cols-2 items-start gap-2 p-4 md:grid-cols-[70px_110px_1fr_70px_120px_32px]">
                <input value={r.questionNumber} onChange={(e) => update(r.key, { questionNumber: e.target.value })} placeholder="Q no." className={input} />
                <input value={r.section} onChange={(e) => update(r.key, { section: e.target.value })} placeholder="Section" className={input} />
                <div className="col-span-2 flex flex-col gap-2 md:col-span-1">
                  <textarea value={r.questionText} onChange={(e) => update(r.key, { questionText: e.target.value })} rows={3} className={input} />
                  <input value={r.topics} onChange={(e) => update(r.key, { topics: e.target.value })} placeholder="Topics, comma separated" className={input} />
                  <details>
                    <summary className="cursor-pointer text-xs text-muted">Answer {r.answerText ? `(${r.answerText.length.toLocaleString()} chars)` : "(none)"}</summary>
                    <textarea value={r.answerText} onChange={(e) => update(r.key, { answerText: e.target.value })} rows={10} className={`${input} mt-2 font-mono text-xs`} />
                  </details>
                </div>
                <input value={r.marks} onChange={(e) => update(r.key, { marks: Number(e.target.value) || 0 })} inputMode="numeric" placeholder="Marks" className={input} />
                <select value={r.difficulty ?? ""} onChange={(e) => update(r.key, { difficulty: (e.target.value || null) as Row["difficulty"] })} className={input}>
                  <option value="">Difficulty</option>
                  <option value="EASY">Easy</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HARD">Hard</option>
                </select>
                <button type="button" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} className="flex items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-red-600" aria-label="Remove question">
                  <Trash size={16} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
