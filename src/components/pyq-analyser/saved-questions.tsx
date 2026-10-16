"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Eye, PencilSimple, Trash } from "@phosphor-icons/react";
import {
  deleteSavedQuestionsAction,
  questionAnswerAction,
  removeDuplicatesAction,
  savedQuestionsAction,
  updateSavedQuestionAction,
} from "@/lib/pyq-analyser-actions";
import { groupUploads, isBundle } from "@/lib/pyq-analyser";
import { SolutionMarkdown } from "./solution-markdown";
import { SolutionBundle } from "./solution-bundle";

type CatalogInput = Parameters<typeof savedQuestionsAction>[0];
type Saved = Awaited<ReturnType<typeof savedQuestionsAction>>["questions"][number];
type Draft = {
  questionNumber: string;
  section: string;
  questionText: string;
  answerText: string;
  marks: number;
  topics: string;
  difficulty: Saved["difficulty"];
  years: string;
};

const input = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none";
const kb = (n: number) => (n < 1024 ? `${n} chars` : `${Math.round(n / 1024)} KB`);
const when = (d: Date | string) => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/**
 * Everything already saved for the picked subject: edit any field (answer
 * included, with preview), delete one, selected, a whole upload, or every
 * duplicate. `refresh` changes after each save so new questions appear.
 */
export function SavedQuestions({ catalog, refresh }: { catalog: CatalogInput | null; refresh: number }) {
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Saved[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const key = catalog ? JSON.stringify(catalog) : "";

  const [version, setVersion] = useState(0);

  // Reloads on subject change (the parent remounts this per subject), after
  // each save above (`refresh`) and after every edit/delete here (`version`).
  useEffect(() => {
    if (!key) return;
    let alive = true;
    savedQuestionsAction(JSON.parse(key))
      .then((res) => {
        if (!alive) return;
        setSubjectId(res.subjectId);
        setQuestions(res.questions);
        setSelected(new Set());
      })
      .catch((err) => alive && setMessage({ ok: false, text: `Could not load saved questions: ${err instanceof Error ? err.message : String(err)}` }));
    return () => {
      alive = false;
    };
  }, [key, refresh, version]);

  // Newest upload first, so what was just saved is on top.
  const uploads = useMemo(() => groupUploads(questions ?? []).reverse(), [questions]);
  const dupCount = questions?.filter((q) => q.duplicateOf).length ?? 0;
  const numberOf = useMemo(() => new Map((questions ?? []).map((q) => [q.id, q.questionNumber])), [questions]);

  async function run(label: string, fn: () => Promise<string>) {
    setBusy(label);
    setMessage(null);
    try {
      setMessage({ ok: true, text: await fn() });
      setVersion((v) => v + 1);
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy("");
    }
  }

  const remove = (ids: string[], what: string) => {
    if (!ids.length || !confirm(`Delete ${what}? This can't be undone.`)) return;
    run("Deleting…", async () => `Deleted ${await deleteSavedQuestionsAction(ids)} question(s).`);
  };

  async function startEdit(q: Saved) {
    setEditing(q.id);
    setPreview(false);
    setDraft(null);
    const answerText = await questionAnswerAction(q.id);
    setDraft({
      questionNumber: q.questionNumber ?? "",
      section: q.section ?? "",
      questionText: q.questionText,
      answerText,
      marks: q.marks ?? 0,
      topics: q.topics.join(", "),
      difficulty: q.difficulty,
      years: q.years ?? "",
    });
  }

  function saveEdit(id: string) {
    if (!draft) return;
    run("Saving…", async () => {
      await updateSavedQuestionAction({
        id,
        ...draft,
        marks: Math.max(0, Math.round(Number(draft.marks) || 0)),
        topics: draft.topics.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 6),
      });
      setEditing(null);
      return "Question updated.";
    });
  }

  if (!catalog) return null;
  if (questions === null) return <div className="h-24 animate-pulse rounded-xl bg-surface-muted" aria-label="Loading saved questions" />;

  const toggle = (ids: string[], on: boolean) =>
    setSelected((s) => {
      const next = new Set(s);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  return (
    <div className="rounded-xl border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <p className="text-sm font-semibold text-foreground">
          Saved questions · {catalog.subject} <span className="font-normal text-muted">({questions.length})</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {dupCount > 0 && subjectId && (
            <button
              type="button"
              disabled={!!busy}
              onClick={() =>
                confirm(`Delete ${dupCount} duplicate question(s)? For each, the copy with the fullest answer is kept and gets their years.`) &&
                run("Removing duplicates…", async () => `Removed ${await removeDuplicatesAction(subjectId)} duplicate(s).`)
              }
              className="flex items-center gap-2 rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-800 transition hover:bg-amber-100 disabled:opacity-50 dark:bg-amber-950/30 dark:text-amber-300"
            >
              <Copy size={16} /> Remove {dupCount} duplicate{dupCount === 1 ? "" : "s"}
            </button>
          )}
          {selected.size > 0 && (
            <button
              type="button"
              disabled={!!busy}
              onClick={() => remove([...selected], `${selected.size} selected question(s)`)}
              className="flex items-center gap-2 rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/30"
            >
              <Trash size={16} /> Delete {selected.size} selected
            </button>
          )}
        </div>
      </div>

      {busy && <p className="border-b border-border bg-accent-soft px-4 py-2 text-sm text-foreground">{busy}</p>}
      {message && (
        <p className={`border-b border-border px-4 py-2 text-sm ${message.ok ? "bg-accent-soft text-foreground" : "bg-red-50 text-red-600 dark:bg-red-950/30"}`}>{message.text}</p>
      )}
      {questions.length === 0 && <p className="p-4 text-sm text-muted">Nothing saved for this subject yet.</p>}

      {uploads.map((up) => {
        const ids = up.map((q) => q.id);
        const all = ids.every((id) => selected.has(id));
        return (
          <section key={ids[0]} className="border-b border-border last:border-b-0">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-surface-muted px-4 py-2">
              <label className="flex items-center gap-2 text-xs font-medium text-muted">
                <input type="checkbox" checked={all} onChange={(e) => toggle(ids, e.target.checked)} />
                Upload · {when(up[0].createdAt)} · {up.length} question{up.length === 1 ? "" : "s"}
              </label>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => remove(ids, `this whole upload (${up.length} question${up.length === 1 ? "" : "s"})`)}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/30"
              >
                <Trash size={14} /> Delete upload
              </button>
            </div>
            <ul className="divide-y divide-border">
              {up.map((q) => (
                <li key={q.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <input type="checkbox" className="mt-1" checked={selected.has(q.id)} onChange={(e) => toggle([q.id], e.target.checked)} aria-label={`Select question ${q.questionNumber ?? ""}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground">
                        {q.questionNumber && <span className="mr-1.5 font-semibold">Q{q.questionNumber}</span>}
                        {q.questionText}
                      </p>
                      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                        {q.topics[0] && <span>{q.topics.join(", ")}</span>}
                        {q.years && <span>Years: {q.years}</span>}
                        <span>{q.answerLength ? `${q.bundle ? "HTML" : "Text"} answer · ${kb(q.answerLength)}` : "No answer"}</span>
                        {q.duplicateOf && (
                          <span className="rounded-full bg-amber-100 px-2 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                            Duplicate{numberOf.get(q.duplicateOf) ? ` of Q${numberOf.get(q.duplicateOf)}` : ""}
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => (editing === q.id ? setEditing(null) : startEdit(q))}
                      className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs transition hover:border-accent"
                    >
                      <PencilSimple size={14} /> {editing === q.id ? "Close" : "Edit"}
                    </button>
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => remove([q.id], `question ${q.questionNumber ?? ""}`.trim())}
                      className="flex items-center justify-center rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-red-600 disabled:opacity-50"
                      aria-label="Delete question"
                    >
                      <Trash size={16} />
                    </button>
                  </div>

                  {editing === q.id && !draft && <div className="mt-3 h-40 animate-pulse rounded-lg bg-surface-muted" aria-label="Loading answer" />}
                  {editing === q.id && draft && (
                    <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-border p-3 md:grid-cols-4">
                      <input value={draft.questionNumber} onChange={(e) => setDraft({ ...draft, questionNumber: e.target.value })} placeholder="Q no." className={input} />
                      <input value={draft.section} onChange={(e) => setDraft({ ...draft, section: e.target.value })} placeholder="Section" className={input} />
                      <input value={draft.marks} onChange={(e) => setDraft({ ...draft, marks: Number(e.target.value) || 0 })} inputMode="numeric" placeholder="Marks" className={input} />
                      <select value={draft.difficulty ?? ""} onChange={(e) => setDraft({ ...draft, difficulty: (e.target.value || null) as Draft["difficulty"] })} className={input}>
                        <option value="">Difficulty</option>
                        <option value="EASY">Easy</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HARD">Hard</option>
                      </select>
                      <textarea value={draft.questionText} onChange={(e) => setDraft({ ...draft, questionText: e.target.value })} rows={3} placeholder="Question" className={`${input} col-span-2 md:col-span-4`} />
                      <input value={draft.topics} onChange={(e) => setDraft({ ...draft, topics: e.target.value })} placeholder="Unit / topics, comma separated" className={`${input} col-span-2 md:col-span-3`} />
                      <input value={draft.years} onChange={(e) => setDraft({ ...draft, years: e.target.value })} placeholder="Years, e.g. 2023, 2025" className={`${input} col-span-2 md:col-span-1`} />
                      <textarea
                        value={draft.answerText}
                        onChange={(e) => setDraft({ ...draft, answerText: e.target.value })}
                        rows={12}
                        placeholder="Answer (Markdown or a full HTML document)"
                        className={`${input} col-span-2 font-mono text-xs md:col-span-4`}
                      />
                      <div className="col-span-2 flex flex-wrap items-center gap-2 md:col-span-4">
                        <button
                          type="button"
                          disabled={!!busy || draft.questionText.trim().length < 5}
                          onClick={() => saveEdit(q.id)}
                          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:bg-accent-hover disabled:opacity-50"
                        >
                          Save changes
                        </button>
                        <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-border px-3 py-2 text-sm transition hover:border-accent">
                          Cancel
                        </button>
                        {draft.answerText && (
                          <button type="button" onClick={() => setPreview(!preview)} className="flex items-center gap-1.5 text-xs font-medium text-accent hover:underline">
                            <Eye size={14} /> {preview ? "Hide preview" : "Preview as students see it"}
                          </button>
                        )}
                      </div>
                      {preview && draft.answerText && (
                        <div className="pyq-paper col-span-2 rounded-xl border border-border p-4 md:col-span-4">
                          {isBundle(draft.answerText) ? (
                            <SolutionBundle html={draft.answerText} title={`Preview of ${draft.questionNumber || "solution"}`} />
                          ) : (
                            <SolutionMarkdown content={draft.answerText} />
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
