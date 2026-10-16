"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, ChartLine, Check, Code, Copy, Eye, FileArrowUp, Sparkle, Trash } from "@phosphor-icons/react";
import { readPdfWithOcr } from "@/lib/pdf-ocr-client";
import { ensureCatalogSubjectAction, extractQuestionsChunkAction, savePaperQuestionsAction } from "@/lib/pyq-analyser-actions";
import {
  DIAGRAM_MARKER,
  diagramContext,
  fillDiagramsFromLibrary,
  parseDiagramLibrary,
  bundleDocument,
  inlineBundleAssets,
  isBundle,
  parseQuestionHeading,
  parseYears,
  parseSolvedText,
  solvedBundlePrompt,
  solvedPaperPrompt,
  stripLabel,
  tidyHtmlAnswer,
  type LibraryDiagram,
} from "@/lib/pyq-analyser";
import { drawEconDiagram } from "@/lib/ai";
import { SolutionMarkdown } from "./solution-markdown";
import { SolutionBundle } from "./solution-bundle";
import { SavedQuestions } from "./saved-questions";
import { applyOverrides, fetchJson, loadOverrides, type Overrides } from "@/lib/catalog-overrides";
import { applyPaperEdits } from "@/lib/paper-edits";
import { canonicalSubjectKey, preferredSubjectLabel } from "@/lib/subject-normalization";
import type { CatalogPaper } from "@/lib/pyq-catalog-types";

// Same static catalog files /papers reads (public/data/papers/*).
type CatalogCourse = { course: string; slug: string };
type CatalogSubject = { key: string; name: string; semester: number; upc: string | null; paperType: string | null };
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
  years: string; // the question's own year tag(s), "2022, 2024"; empty = the paper-year box
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

export function PyqAnalyserAdminClient({ counts }: { counts: Record<string, number> }) {
  const [courses, setCourses] = useState<CatalogCourse[]>([]);
  const [courseSlug, setCourseSlug] = useState("");
  const [courseName, setCourseName] = useState("");
  const [catalogSubjects, setCatalogSubjects] = useState<CatalogSubject[]>([]);
  const overridesRef = useRef<Overrides | null>(null);
  const [semester, setSemester] = useState(0);
  const [subjectKey, setSubjectKey] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [group, setGroup] = useState("");
  const [previewKey, setPreviewKey] = useState<number | null>(null);
  const [savedVersion, setSavedVersion] = useState(0);
  const [copied, setCopied] = useState(false);
  const [promptKind, setPromptKind] = useState<"markdown" | "bundle">("markdown");
  const bundleRef = useRef<HTMLInputElement>(null);

  // An HTML solution bundle (plus any .css/.js it links by name) → one row
  // per <section data-question>, each a standalone document.
  async function loadBundle(list: FileList) {
    setMessage(null);
    const all = [...list];
    const main = all.find((f) => /\.html?$/i.test(f.name));
    if (!main) return setMessage({ ok: false, text: "Include the .html file of the bundle (CSS/JS files are optional)." });
    const assets: Record<string, string> = {};
    for (const f of all) if (f !== main) assets[f.name] = await f.text();
    readBundle(inlineBundleAssets(await main.text(), assets), `${main.name}${all.length > 1 ? ` + ${all.length - 1} file${all.length > 2 ? "s" : ""}` : ""}`);
  }

  // Two layouts: <section data-question="1(a)" data-unit> + <p data-question-text>,
  // or <section class="q"><h2>SUBJECT — QUESTION 1(a)</h2><p class="qtext"> + <span class="unit">.
  function readBundle(html: string, source: string) {
    const dom = new DOMParser().parseFromString(html, "text/html");
    const head = dom.head.innerHTML;
    const bodyScripts = [...dom.body.children].filter((el) => el.tagName === "SCRIPT").map((el) => el.outerHTML).join("");
    const heading = (sec: Element) => sec.querySelector("h1, h2, h3");
    let sections = [...dom.querySelectorAll<HTMLElement>("[data-question]")];
    if (!sections.length) sections = [...dom.querySelectorAll<HTMLElement>("section")].filter((sec) => parseQuestionHeading(heading(sec)?.textContent ?? ""));
    const found: Row[] = sections.map((sec, key) => {
      const clone = sec.cloneNode(true) as HTMLElement;
      const h = sec.hasAttribute("data-question") ? null : heading(clone);
      const parsed = h && parseQuestionHeading(h.textContent ?? "");
      const qEl = clone.querySelector("[data-question-text], .qtext");
      const unitEl = clone.querySelector(".unit");
      const yearEl = clone.querySelector(".year, [data-year-text]");
      const questionText = stripLabel(qEl?.textContent ?? sec.getAttribute("data-question-text") ?? "");
      const unit = sec.getAttribute("data-unit") ?? stripLabel(unitEl?.textContent ?? "");
      // Question, number and unit show in the analyser's own header, so they leave the answer.
      const years = parseYears(sec.getAttribute("data-year") ?? stripLabel(yearEl?.textContent ?? "")).join(", ");
      for (const el of [qEl, unitEl, yearEl, h]) el?.remove();
      // section.q answers are static HTML: saved as a normal answer so they render in the
      // site's solution style (diagrams keep their classes). data-question bundles may
      // carry scripts (charts, KaTeX), so they stay whole documents in a sandboxed frame.
      const answerText = h ? tidyHtmlAnswer(clone.innerHTML) : bundleDocument(head, clone.outerHTML, bodyScripts);
      return {
        key,
        group: parsed?.group ?? "",
        questionNumber: sec.getAttribute("data-question") ?? parsed?.questionNumber ?? "",
        section: "",
        questionText,
        answerText,
        marks: 0,
        topics: unit,
        difficulty: null,
        years,
      };
    });
    if (!found.length) {
      // No markers: keep the whole page as one solution; admin types the question.
      found.push({ key: 0, group: "", questionNumber: "", section: "", questionText: "", answerText: html, marks: 0, topics: "", difficulty: null, years: "" });
    }
    setRows(found);
    setGroup(found[0].group);
    setMessage({
      ok: true,
      text: sections.length
        ? `Bundle read: ${found.length} questions (${source}). Preview each, then save.`
        : "No question sections found (<section data-question> or <h2>… — QUESTION 1(a)</h2>), so the whole bundle is one solution — type its question text below, then save.",
    });
  }
  const [library, setLibrary] = useState<LibraryDiagram[]>([]);
  const libraryRef = useRef<HTMLInputElement>(null);

  // The diagram library is a per-admin convenience: remembered in this browser only.
  useEffect(() => {
    let saved: LibraryDiagram[] = [];
    try {
      saved = JSON.parse(localStorage.getItem("pyq-diagram-library") ?? "[]");
    } catch {}
    if (saved.length) Promise.resolve().then(() => setLibrary(saved));
  }, []);

  async function loadLibrary(file: File) {
    const lib = parseDiagramLibrary(await file.text());
    if (!lib.length) {
      setMessage({ ok: false, text: "No diagrams found in that file (expected <h3>Title</h3><svg>…</svg> cards)." });
      return;
    }
    setLibrary(lib);
    try {
      localStorage.setItem("pyq-diagram-library", JSON.stringify(lib));
    } catch {}
    setMessage({ ok: true, text: `Diagram library loaded: ${lib.length} diagrams.` });
  }

  function insertFromLibrary() {
    let filled = 0;
    for (const row of shown) {
      const res = fillDiagramsFromLibrary(row.questionText, row.answerText, library);
      if (res.filled) update(row.key, { answerText: res.answer });
      filled += res.filled;
    }
    const left = markerCount - filled;
    setMessage({
      ok: true,
      text: `Inserted ${filled} diagram${filled === 1 ? "" : "s"} from your library.${left ? ` ${left} had no matching diagram — draw them with AI or edit the answer.` : ""} Check each with Preview.`,
    });
  }
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const subject = catalogSubjects.find((s) => s.key === subjectKey);
  const semesters = [...new Set(catalogSubjects.map((s) => s.semester))].sort((a, b) => a - b);

  useEffect(() => {
    fetch("/data/papers/index.json")
      .then((r) => r.json())
      .then((list: CatalogCourse[]) => setCourses(list.sort((a, b) => a.course.localeCompare(b.course))))
      .catch(() => setMessage({ ok: false, text: "Could not load the course list." }));
  }, []);

  async function pickCourse(slug: string) {
    setCourseSlug(slug);
    setSemester(0);
    setSubjectKey("");
    setCatalogSubjects([]);
    if (!slug) return;
    try {
      // Same pipeline as /papers (paper-browser.tsx): admin paper edits, then
      // subject overrides (rename/move/hide), grouped by canonical name, and
      // earlier-syllabus-only subjects (verified: false) left out.
      const ov = overridesRef.current ?? (overridesRef.current = await loadOverrides());
      const course = courses.find((c) => c.slug === slug)?.course ?? "";
      const sources = new Set([course]);
      for (const o of ov.list) if (o.courseOverride === course) sources.add(o.course);
      const slugOf = new Map(courses.map((c) => [c.course, c.slug]));
      const lists = await Promise.all(
        [...sources].filter((c) => slugOf.has(c)).map((c) => fetchJson<CatalogPaper[]>(`/data/papers/courses/${slugOf.get(c)}.json`, [])),
      );
      const papers = applyOverrides(applyPaperEdits(lists.flat(), ov.papers, { dataset: true }), ov).filter((p) => p.course === course);
      const groups = new Map<string, { semester: number; labels: string[]; papers: CatalogPaper[] }>();
      for (const p of papers) {
        const sem = Number(p.semester);
        if (!(sem >= 1 && sem <= 8)) continue;
        const key = `${sem}|${canonicalSubjectKey(p.subject)}`;
        const g = groups.get(key) ?? { semester: sem, labels: [], papers: [] };
        g.labels.push(p.subject);
        g.papers.push(p);
        groups.set(key, g);
      }
      const list: CatalogSubject[] = [];
      for (const [key, g] of groups) {
        if (g.papers.every((p) => p.verified === false)) continue;
        const upcs = g.papers.map((p) => p.upc).filter((u): u is string => !!u);
        const upc = upcs.sort((a, b) => upcs.filter((u) => u === b).length - upcs.filter((u) => u === a).length)[0] ?? null;
        list.push({ key, name: preferredSubjectLabel(g.labels), semester: g.semester, upc, paperType: g.papers.find((p) => p.paperType)?.paperType ?? null });
      }
      setCourseName(course);
      setCatalogSubjects(list.sort((a, b) => a.name.localeCompare(b.name)));
    } catch {
      setMessage({ ok: false, text: "Could not load that course's subjects." });
    }
  }

  // Resolved (and created if needed) only when a paper is actually read or saved.
  async function subjectId() {
    if (!subject) throw new Error("Pick a subject first.");
    return ensureCatalogSubjectAction({
      courseSlug,
      course: courseName,
      semester: subject.semester,
      subject: subject.name,
      upc: subject.upc,
      paperType: subject.paperType,
    });
  }
  const validYear = /^(19|20)\d{2}$/.test(year);
  const chunks = useMemo(() => chunkText(text), [text]);
  const solvedCount = useMemo(() => parseSolvedText(text).length, [text]);
  // A solved paste can hold several papers (e.g. Hons. + Programme): each
  // is saved to its own subject, one at a time.
  const groups = [...new Set(rows.map((r) => r.group))];
  const shown = groups.length > 1 ? rows.filter((r) => r.group === group) : rows;
  // Questions without their own year tag take the paper-year box.
  const untagged = shown.filter((r) => !parseYears(r.years).length).length;
  const shownYears = [...new Set(shown.flatMap((r) => (parseYears(r.years).length ? parseYears(r.years) : validYear ? [year] : [])))].sort();
  const markerCount = shown.reduce((n, r) => n + r.answerText.split(DIAGRAM_MARKER).length - 1, 0);

  // One free Groq call per diagram, in order; a failed one keeps its marker
  // (invisible to students) so it can be retried.
  async function drawDiagrams() {
    setMessage(null);
    let drawn = 0;
    let failed = 0;
    let lastError = "";
    for (const row of shown) {
      let answer = row.answerText;
      let from = 0;
      for (let at = answer.indexOf(DIAGRAM_MARKER, from); at !== -1; at = answer.indexOf(DIAGRAM_MARKER, from)) {
        setBusy(`Drawing diagram ${drawn + failed + 1} of ${markerCount}…`);
        const res = await drawEconDiagram(row.questionText, diagramContext(answer, at));
        if (res.ok) {
          const block = "```diagram\n" + JSON.stringify(res.data) + "\n```";
          answer = answer.slice(0, at) + block + answer.slice(at + DIAGRAM_MARKER.length);
          from = at + block.length;
          drawn++;
          update(row.key, { answerText: answer });
        } else {
          from = at + DIAGRAM_MARKER.length;
          failed++;
          lastError = res.error;
        }
      }
    }
    setBusy("");
    setMessage({ ok: !failed, text: `Drew ${drawn} diagram${drawn === 1 ? "" : "s"}.${failed ? ` ${failed} failed (${lastError}) — click again to retry.` : " Use Preview to check them."}` });
  }

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
    if (isBundle(text)) return readBundle(text, "pasted HTML");
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
        years: q.years.join(", "),
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
        const res = await extractQuestionsChunkAction(await subjectId(), chunks[i]);
        if (!res.ok) throw new Error(res.error);
        for (const q of res.data.questions) {
          found.push({ ...q, key: found.length, group: "", answerText: "", topics: q.topics.join(", "), years: "" });
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
        subjectId: await subjectId(),
        year: validYear ? year : "",
        questions: shown.map((r) => ({
          questionNumber: r.questionNumber.trim(),
          section: r.section.trim(),
          questionText: r.questionText.trim(),
          answerText: r.answerText.trim(),
          marks: Math.max(0, Math.round(Number(r.marks) || 0)),
          topics: r.topics.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 6),
          difficulty: r.difficulty,
          years: parseYears(r.years),
        })),
      });
      setSavedVersion((v) => v + 1);
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
          Course
          <select value={courseSlug} onChange={(e) => pickCourse(e.target.value)} className={input}>
            <option value="">{courses.length ? "Select…" : "Loading…"}</option>
            {courses.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.course}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Semester
          <select value={semester || ""} onChange={(e) => (setSemester(Number(e.target.value)), setSubjectKey(""))} className={input} disabled={!semesters.length}>
            <option value="">Select…</option>
            {semesters.map((n) => (
              <option key={n} value={n}>
                Semester {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Subject
          <select value={subjectKey} onChange={(e) => setSubjectKey(e.target.value)} className={input} disabled={!semester}>
            <option value="">Select…</option>
            {catalogSubjects
              .filter((x) => x.semester === semester)
              .map((x) => (
                <option key={x.key} value={x.key}>
                  {x.name}
                  {x.paperType ? ` · ${x.paperType}` : ""}
                  {x.upc && counts[x.upc] ? ` (${counts[x.upc]} Qs)` : ""}
                </option>
              ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Paper year {rows.length > 0 && untagged === 0 ? "(from tags)" : "(if not tagged)"}
          <input value={year} onChange={(e) => setYear(e.target.value.trim())} inputMode="numeric" maxLength={4} className={input} />
        </label>
      </div>

      {subject && (
        <details className="rounded-xl border border-border bg-surface p-4">
          <summary className="cursor-pointer text-sm font-semibold text-foreground">
            ChatGPT prompt for {subject.name} <span className="font-normal text-muted">— copy, paste into ChatGPT with the question paper, then paste its reply below</span>
          </summary>
          {(() => {
            const info = { course: courseName, semester: subject.semester, subject: subject.name, upc: subject.upc, paperType: subject.paperType, year };
            const prompt = promptKind === "bundle" ? solvedBundlePrompt(info) : solvedPaperPrompt(info);
            return (
              <>
                <div className="mt-3 flex gap-2 text-xs">
                  {(["markdown", "bundle"] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setPromptKind(k)}
                      className={`rounded-full border px-3 py-1 transition ${promptKind === k ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground/40"}`}
                    >
                      {k === "markdown" ? "Text answers (paste below)" : "HTML bundle (upload)"}
                    </button>
                  ))}
                </div>
                <textarea readOnly value={prompt} rows={14} className={`${input} mt-3 font-mono text-xs`} onFocus={(e) => e.currentTarget.select()} />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(prompt);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    } catch {
                      setMessage({ ok: false, text: "Couldn't copy automatically — click in the box, Ctrl/Cmd+A, then copy." });
                    }
                  }}
                  className="mt-2 flex items-center gap-2 rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background transition hover:opacity-90"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copied" : "Copy prompt"}
                </button>
              </>
            );
          })()}
        </details>
      )}

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
            <button
              type="button"
              onClick={() => bundleRef.current?.click()}
              disabled={!!busy}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm transition hover:border-accent disabled:opacity-50"
              title="Self-contained HTML solution (+ its .css/.js files)"
            >
              <Code size={16} /> Upload HTML bundle
            </button>
            <input
              ref={bundleRef}
              type="file"
              multiple
              accept=".html,.htm,.css,.js,text/html,text/css,text/javascript"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) loadBundle(e.target.files);
                e.target.value = "";
              }}
            />
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
              <Sparkle size={16} weight="fill" /> {isBundle(text) ? "Read HTML bundle" : solvedCount ? `Read ${solvedCount} solved questions` : "Extract questions with AI"}
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
              Review {shown.length} questions · {subject?.name ?? "pick a subject"} · {shownYears.join(", ") || "no year"}
            </p>
            <button
              type="button"
              onClick={() => libraryRef.current?.click()}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition hover:border-accent"
              title="Upload your coded SVG diagram library (.html)"
            >
              <BookOpen size={16} /> {library.length ? `Library: ${library.length} diagrams` : "Upload diagram library"}
            </button>
            <input
              ref={libraryRef}
              type="file"
              accept=".html,.htm,text/html"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) loadLibrary(f);
                e.target.value = "";
              }}
            />
            {markerCount > 0 && library.length > 0 && (
              <button
                type="button"
                onClick={insertFromLibrary}
                disabled={!!busy}
                className="flex items-center gap-2 rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
              >
                <BookOpen size={16} /> Insert {markerCount} from library
              </button>
            )}
            {markerCount > 0 && (
              <button
                type="button"
                onClick={drawDiagrams}
                disabled={!!busy}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition hover:border-accent disabled:opacity-50"
              >
                <ChartLine size={16} /> Draw {markerCount} diagram{markerCount === 1 ? "" : "s"} (free AI)
              </button>
            )}
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
              disabled={!!busy || (untagged > 0 && !validYear) || !subject}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:bg-accent-hover disabled:opacity-50"
            >
              {untagged > 0 && !validYear ? `Enter the paper year (${untagged} untagged)` : `Save ${shown.length} questions`}
            </button>
          </div>
          <ul className="divide-y divide-border">
            {shown.map((r) => (
              <li key={r.key} className="grid grid-cols-2 items-start gap-2 p-4 md:grid-cols-[70px_110px_1fr_70px_120px_32px]">
                <input value={r.questionNumber} onChange={(e) => update(r.key, { questionNumber: e.target.value })} placeholder="Q no." className={input} />
                <input value={r.section} onChange={(e) => update(r.key, { section: e.target.value })} placeholder="Section" className={input} />
                <div className="col-span-2 flex flex-col gap-2 md:col-span-1">
                  <textarea value={r.questionText} onChange={(e) => update(r.key, { questionText: e.target.value })} rows={3} className={input} />
                  <div className="grid grid-cols-[1fr_150px] gap-2">
                    <input value={r.topics} onChange={(e) => update(r.key, { topics: e.target.value })} placeholder="Topics, comma separated" className={input} />
                    <input
                      value={r.years}
                      onChange={(e) => update(r.key, { years: e.target.value })}
                      placeholder={validYear ? `Year: ${year}` : "Year"}
                      aria-label="Year(s) this question was asked"
                      className={input}
                    />
                  </div>
                  <details>
                    <summary className="cursor-pointer text-xs text-muted">Answer {r.answerText ? `(${r.answerText.length.toLocaleString()} chars)` : "(none)"}</summary>
                    <textarea value={r.answerText} onChange={(e) => update(r.key, { answerText: e.target.value })} rows={10} className={`${input} mt-2 font-mono text-xs`} />
                  </details>
                  {r.answerText && (
                    <button
                      type="button"
                      onClick={() => setPreviewKey(previewKey === r.key ? null : r.key)}
                      className="flex w-fit items-center gap-1.5 text-xs font-medium text-accent hover:underline"
                    >
                      <Eye size={14} /> {previewKey === r.key ? "Hide preview" : "Preview as students see it"}
                    </button>
                  )}
                  {previewKey === r.key && (
                    <div className="pyq-paper rounded-xl border border-border p-4">
                      {isBundle(r.answerText) ? (
                        <SolutionBundle html={r.answerText} title={`Preview of ${r.questionNumber || "solution"}`} />
                      ) : (
                        <SolutionMarkdown content={r.answerText} />
                      )}
                    </div>
                  )}
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

      <SavedQuestions
        key={subject?.key ?? ""}
        refresh={savedVersion}
        catalog={subject ? { courseSlug, course: courseName, semester: subject.semester, subject: subject.name, upc: subject.upc, paperType: subject.paperType } : null}
      />
    </div>
  );
}
