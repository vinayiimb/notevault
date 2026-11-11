"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Plus, X } from "@phosphor-icons/react/dist/ssr";
import { SUBJECT_TYPES, SUBJECT_TYPE_INFO, type SubjectType } from "@/lib/feathers";
import type { SubjectCatalog } from "@/lib/subject-catalog";

const field =
  "h-12 w-full rounded-[14px] bg-foreground/[0.06] px-3.5 text-[16px] outline-none transition placeholder:text-muted/70 focus:bg-foreground/[0.09] focus:ring-2 focus:ring-brand/40 disabled:opacity-50";
const COURSE_TYPES: readonly SubjectType[] = ["DSC", "DSE", "GE"];
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];
const normCode = (s: string) => s.toUpperCase().replace(/\s+/g, "");

type Hit = { type: SubjectType; name: string; course: string; sem: number | null };

// "Add subject". DSC / DSE / GE: pick Course -> Semester -> Subject from the DU
// syllabus (or switch to typing it yourself). SEC / AEC / VAC: search the
// university-wide list. Typing a known subject code fills in everything else.
// The pick-lists load from /api/subject-catalog when the form opens; the form
// posts type/name/code/course/semester to addSubjectAction.
export function AddSubjectForm({ action, error, startOpen }: { action: (f: FormData) => void; error?: string; startOpen: boolean }) {
  const [open, setOpen] = useState(startOpen || !!error);
  const [cat, setCat] = useState<SubjectCatalog | null>(null);
  const [failed, setFailed] = useState(false);
  const [type, setType] = useState<SubjectType>("DSC");
  const [course, setCourse] = useState("");
  const [sem, setSem] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [manual, setManual] = useState(false);
  const [found, setFound] = useState<string | null>(null);

  useEffect(() => {
    if (!open || cat) return;
    let live = true;
    fetch("/api/subject-catalog")
      .then((r) => (r.ok ? (r.json() as Promise<SubjectCatalog>) : Promise.reject(new Error("catalog"))))
      .then((d) => live && setCat(d))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [open, cat]);

  const isCourseType = COURSE_TYPES.includes(type);

  // Every known code -> what it is (first course wins for shared electives).
  const byCode = useMemo(() => {
    const m = new Map<string, Hit>();
    if (!cat) return m;
    for (const [ci, t, sems, n, c] of cat.rows) if (c && !m.has(c)) m.set(c, { type: t as SubjectType, name: n, course: cat.courses[ci], sem: sems[0] ?? null });
    for (const [t, n, c] of cat.pool) if (c && !m.has(c)) m.set(c, { type: t as SubjectType, name: n, course: "", sem: null });
    return m;
  }, [cat]);

  const courseNames = useMemo(() => {
    if (!cat) return [];
    return [...new Set(cat.rows.filter((r) => r[1] === type).map((r) => cat.courses[r[0]]))].sort();
  }, [cat, type]);
  const inCourse = useMemo(() => (cat ? cat.rows.filter((r) => r[1] === type && cat.courses[r[0]] === course) : []), [cat, type, course]);
  const semOptions = useMemo(() => [...new Set(inCourse.flatMap((r) => r[2]))].sort((a, b) => a - b), [inCourse]);
  const subjectOptions = useMemo(() => inCourse.filter((r) => !sem || r[2].length === 0 || r[2].includes(Number(sem))), [inCourse, sem]);
  const poolOptions = useMemo(() => (cat ? cat.pool.filter((p) => p[0] === type) : []), [cat, type]);

  function pickType(t: SubjectType) {
    setType(t);
    setCourse("");
    setSem("");
    setName("");
    setCode("");
    setFound(null);
    setManual(false);
  }

  function onCode(v: string) {
    setCode(v);
    const hit = byCode.get(normCode(v));
    if (!hit) return setFound(null);
    setType(hit.type);
    setName(hit.name);
    setCourse(hit.course);
    setSem(hit.sem ? String(hit.sem) : "");
    setManual(false);
    setFound(`${hit.name} (${hit.type}${hit.course ? `, ${hit.course}` : ""})`);
  }

  function onPoolName(v: string) {
    setName(v);
    setFound(null);
    const hit = poolOptions.find((p) => p[1].toLowerCase() === v.trim().toLowerCase());
    if (hit) setCode(hit[2]);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-brand px-5 text-[15px] font-semibold text-brand-foreground transition hover:bg-brand-hover active:scale-[0.985]"
      >
        <Plus size={16} weight="bold" /> Add subject
      </button>
    );
  }
  return (
    <form action={action} className="rounded-[22px] bg-foreground/[0.04] p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold">Add a subject</h3>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="flex size-9 items-center justify-center rounded-full text-muted transition hover:bg-foreground/[0.08] hover:text-foreground">
          <X size={16} weight="bold" />
        </button>
      </div>
      {error && <p role="alert" className="mt-2 rounded-[14px] bg-red-500/10 px-3.5 py-2.5 text-sm text-red-700 dark:text-red-300">{error}</p>}

      {/* 1. Type */}
      <div role="radiogroup" aria-label="Type of subject" className="mt-3 grid grid-cols-3 gap-1.5 rounded-[22px] bg-foreground/[0.06] p-1 sm:grid-cols-6 sm:rounded-full">
        {SUBJECT_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={type === t}
            onClick={() => pickType(t)}
            className={`flex min-h-12 flex-col items-center justify-center rounded-[18px] px-1 leading-tight transition sm:rounded-full ${
              type === t ? "bg-surface text-foreground shadow-[var(--shadow-tile)]" : "text-muted hover:text-foreground"
            }`}
          >
            <span className="text-sm font-semibold">{t}</span>
            <span className="text-[11px] font-medium opacity-80">{SUBJECT_TYPE_INFO[t].short}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 px-1 text-[13px] text-muted">{SUBJECT_TYPE_INFO[type].label}</p>

      {/* 2. Which subject */}
      {failed && !manual && isCourseType && <p className="mt-3 text-sm text-muted">Couldn&apos;t load the subject list. Type it in yourself below.</p>}
      {isCourseType && !manual && !failed ? (
        <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
          <select
            aria-label="Course"
            value={course}
            onChange={(e) => {
              setCourse(e.target.value);
              setSem("");
              setName("");
              setCode("");
              setFound(null);
            }}
            disabled={!cat}
            className={field}
          >
            <option value="">{cat ? "Select course" : "Loading courses…"}</option>
            {courseNames.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select aria-label="Semester" value={sem} onChange={(e) => { setSem(e.target.value); setName(""); setCode(""); setFound(null); }} disabled={!course} className={field}>
            <option value="">{semOptions.length ? "Select semester" : "Semester"}</option>
            {semOptions.map((s) => (
              <option key={s} value={s}>Semester {s}</option>
            ))}
          </select>
          <select
            aria-label="Subject"
            value={name}
            onChange={(e) => {
              const row = subjectOptions.find((r) => r[3] === e.target.value);
              setName(e.target.value);
              setCode(row?.[4] ?? "");
              setFound(null);
            }}
            disabled={!course}
            className={field}
          >
            <option value="">{course ? `Select subject (${subjectOptions.length})` : "Subject"}</option>
            {subjectOptions.map((r) => (
              <option key={r[3] + r[4]} value={r[3]}>{r[3]}</option>
            ))}
          </select>
        </div>
      ) : isCourseType ? (
        <div className="mt-3 grid gap-2.5 sm:grid-cols-[1.2fr_9rem_1.6fr]">
          <input value={course} onChange={(e) => setCourse(e.target.value)} placeholder="Course, e.g. B.Com (Hons)" maxLength={100} aria-label="Course" className={field} />
          <select aria-label="Semester" value={sem} onChange={(e) => setSem(e.target.value)} className={field}>
            <option value="">Semester</option>
            {SEMESTERS.map((s) => (
              <option key={s} value={s}>Semester {s}</option>
            ))}
          </select>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Subject name" maxLength={120} aria-label="Subject name" className={field} />
        </div>
      ) : (
        <div className="mt-3">
          <input
            value={name}
            onChange={(e) => onPoolName(e.target.value)}
            list="du-pool-suggestions"
            placeholder={`Search ${SUBJECT_TYPE_INFO[type].label.toLowerCase()}s or type your own`}
            autoComplete="off"
            maxLength={120}
            aria-label="Subject name"
            className={field}
          />
          <datalist id="du-pool-suggestions">
            {poolOptions.map((p) => (
              <option key={p[1] + p[2]} value={p[1]}>{p[2]}</option>
            ))}
          </datalist>
        </div>
      )}
      {isCourseType && !failed && (
        <button type="button" onClick={() => { setManual((m) => !m); setName(""); setCode(""); setCourse(""); setSem(""); setFound(null); }} className="mt-2 px-1 text-sm font-semibold text-brand hover:underline">
          {manual ? "Pick from the list instead" : "Can't find it? Add it yourself"}
        </button>
      )}

      {/* 3. Code (also works as a shortcut: type it and we fill the rest) */}
      <div className="mt-3 grid gap-2.5 sm:grid-cols-[1fr_1.4fr] sm:items-center">
        <input value={code} onChange={(e) => onCode(e.target.value)} placeholder="Subject code" autoComplete="off" maxLength={20} aria-label="Subject code" className={`${field} font-mono tracking-wide`} />
        <p className="px-1 text-[13px] leading-snug text-muted" aria-live="polite">
          {found ? (
            <span className="inline-flex items-start gap-1.5 font-medium text-emerald-700 dark:text-emerald-300">
              <Check size={15} weight="bold" className="mt-0.5 shrink-0" /> {found}
            </span>
          ) : (
            "Know the code? Type it and we fill in the rest."
          )}
        </p>
      </div>

      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="course" value={course} />
      <input type="hidden" name="semester" value={sem} />
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="code" value={code} />
      <button
        type="submit"
        disabled={name.trim().length < 2}
        className="mt-3 inline-flex h-12 w-full items-center justify-center rounded-full bg-brand text-[16px] font-semibold text-brand-foreground transition hover:bg-brand-hover active:scale-[0.985] disabled:opacity-40 sm:w-auto sm:px-8"
      >
        Save subject
      </button>
    </form>
  );
}
