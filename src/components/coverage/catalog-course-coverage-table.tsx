"use client";

import {
  ArrowSquareOut,
  CheckSquare,
  Square,
  UploadSimple,
  X,
} from "@phosphor-icons/react/dist/ssr";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadCatalogPaperAction } from "@/lib/actions";
import type {
  CatalogCourseCoverage,
  CatalogPaper,
} from "@/lib/pyq-catalog-types";

type ActiveCell = {
  course: string;
  subject: string;
  yearRange: string;
  papers: CatalogPaper[];
  semesters: string[];
  semesterGroups: string[];
};

function paperTitle(paper: CatalogPaper) {
  if (paper.fileName) return paper.fileName;
  const tail = paper.pdfUrl.split("/").pop() ?? "Question paper.pdf";
  try {
    return decodeURIComponent(tail).replace(/_/g, " ");
  } catch {
    return tail.replace(/_/g, " ");
  }
}

export function CatalogCourseCoverageTable({
  data,
}: {
  data: CatalogCourseCoverage;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [active, setActive] = useState<ActiveCell | null>(null);
  const [semester, setSemester] = useState("");
  const [semesterGroup, setSemesterGroup] = useState("");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function openCell(cell: ActiveCell) {
    setActive(cell);
    setSemester(cell.semesters[0] ?? "");
    setSemesterGroup(cell.semesterGroups[0] ?? "");
    setMessage(null);
    formRef.current?.reset();
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    if (uploading) return;
    dialogRef.current?.close();
    setActive(null);
    setMessage(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!active) return;
    setUploading(true);
    setMessage(null);
    const formData = new FormData(event.currentTarget);
    formData.set("course", active.course);
    formData.set("subject", active.subject);
    formData.set("yearRange", active.yearRange);
    formData.set("semester", semester);
    formData.set("semesterGroup", semesterGroup);

    try {
      const result = await uploadCatalogPaperAction(formData);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setNotice(result.message);
      dialogRef.current?.close();
      setActive(null);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The upload could not be completed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      {notice ? (
        <div
          role="status"
          className="mb-5 flex items-center justify-between gap-3 rounded-xl bg-success-soft px-4 py-3 text-sm font-medium text-success"
        >
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss"
            className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-surface/60"
          >
            <X size={15} weight="bold" />
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[920px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted">
              <th
                scope="col"
                className="sticky left-0 z-10 min-w-80 bg-surface-muted px-5 py-3 text-left text-xs font-semibold text-muted"
              >
                Subject
              </th>
              {data.yearRanges.map((yearRange) => (
                <th
                  key={yearRange}
                  scope="col"
                  className="min-w-32 px-3 py-3 text-center text-xs font-semibold text-muted"
                >
                  {yearRange}
                </th>
              ))}
              <th
                scope="col"
                className="sticky right-0 z-10 min-w-32 bg-surface-muted px-3 py-3 text-center text-xs font-semibold text-muted"
              >
                All years
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.rows.map((row) => {
              const completedYears = row.cells.filter((cell) => cell.papers.length > 0).length;
              const hasEveryYear = completedYears === data.yearRanges.length;
              const missingYears = data.yearRanges.length - completedYears;

              return (
                <tr key={row.subject} className="hover:bg-surface-muted/40">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-surface px-5 py-3 text-left font-medium"
                  >
                    <span className="block max-w-96">{row.subject}</span>
                    <span className="mt-0.5 block text-xs font-normal text-muted">
                      {row.semesters.length
                        ? `Semester${row.semesters.length === 1 ? "" : "s"} ${row.semesters.join(", ")}`
                        : "Semester not specified by source"}
                    </span>
                  </th>
                  {row.cells.map((cell) => {
                    const hasPapers = cell.papers.length > 0;
                    return (
                      <td key={cell.yearRange} className="px-3 py-3 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            openCell({
                              course: data.course,
                              subject: row.subject,
                              yearRange: cell.yearRange,
                              papers: cell.papers,
                              semesters: row.semesters,
                              semesterGroups: data.semesterGroupsByYear[cell.yearRange] ?? [],
                            })
                          }
                          aria-label={
                            hasPapers
                              ? `${cell.papers.length} paper${cell.papers.length === 1 ? "" : "s"} for ${row.subject}, ${cell.yearRange}. View or add another.`
                              : `No paper for ${row.subject}, ${cell.yearRange}. Upload one.`
                          }
                          className={
                            hasPapers
                              ? "inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-success-soft px-3 py-2 font-semibold text-success hover:bg-success-soft/70"
                              : "inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 py-2 font-semibold text-muted hover:bg-accent-soft hover:text-accent"
                          }
                        >
                          {hasPapers ? (
                            <>
                              <CheckSquare size={18} weight="fill" />
                              {cell.papers.length > 1 ? cell.papers.length : "Done"}
                            </>
                          ) : (
                            <>
                              <Square size={18} />
                              Upload
                            </>
                          )}
                        </button>
                      </td>
                    );
                  })}
                  <td className="sticky right-0 bg-surface px-3 py-3 text-center">
                    <div
                      aria-label={
                        hasEveryYear
                          ? `${row.subject} has papers for all ${data.yearRanges.length} source years.`
                          : `${row.subject} is missing ${missingYears} source year${missingYears === 1 ? "" : "s"}.`
                      }
                      className={
                        hasEveryYear
                          ? "inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-success-soft px-3 py-2 font-semibold text-success"
                          : "inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 py-2 font-medium text-muted"
                      }
                    >
                      {hasEveryYear ? (
                        <>
                          <CheckSquare size={18} weight="fill" />
                          Complete
                        </>
                      ) : (
                        <>
                          <Square size={18} />
                          {missingYears} missing
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <dialog
        ref={dialogRef}
        onCancel={(event) => {
          if (uploading) event.preventDefault();
          else setActive(null);
        }}
        className="m-auto w-[min(92vw,620px)] rounded-2xl bg-surface p-0 text-foreground shadow-xl backdrop:bg-black/45"
      >
        {active ? (
          <div>
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
              <div>
                <h2 className="font-semibold">{active.subject}</h2>
                <p className="mt-1 text-sm text-muted">
                  {active.course} · {active.yearRange}
                </p>
              </div>
              <button
                type="button"
                onClick={closeDialog}
                disabled={uploading}
                aria-label="Close"
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-foreground disabled:opacity-50"
              >
                <X size={17} weight="bold" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-5 py-5 sm:px-6">
              {active.papers.length > 0 ? (
                <section>
                  <h3 className="text-sm font-semibold">
                    Catalogued files ({active.papers.length})
                  </h3>
                  <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
                    {active.papers.map((paper, index) => (
                      <li
                        key={paper.id}
                        className="flex items-center justify-between gap-3 px-3 py-3"
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">
                            {active.papers.length > 1 ? `Option ${index + 1}` : "Paper"}
                            {paper.note ? ` · ${paper.note}` : ""}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-muted">
                            {paperTitle(paper)} · Semesters {paper.semesterGroup}
                          </span>
                        </span>
                        <a
                          href={paper.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Open option ${index + 1}`}
                          className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-accent-soft hover:text-accent"
                        >
                          <ArrowSquareOut size={16} weight="bold" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : (
                <div className="rounded-xl bg-surface-muted px-4 py-3 text-sm text-muted">
                  No paper is catalogued for this subject and source year yet.
                </div>
              )}

              <form ref={formRef} onSubmit={handleSubmit} className="mt-6">
                <h3 className="text-sm font-semibold">
                  {active.papers.length ? "Add another PDF option" : "Upload the missing PDF"}
                </h3>
                <p className="mt-1 text-xs leading-5 text-muted">
                  The file is stored in DU PYQ Online&apos;s managed PDF storage and appears in the public
                  Full Archive immediately. Maximum size: 25 MB.
                </p>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="coverage-semester-group" className="text-sm font-medium">
                      Semester group
                    </label>
                    <select
                      id="coverage-semester-group"
                      value={semesterGroup}
                      onChange={(event) => setSemesterGroup(event.target.value)}
                      required
                      className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                    >
                      {active.semesterGroups.map((group) => (
                        <option key={group} value={group}>
                          {group}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="coverage-semester" className="text-sm font-medium">
                      Semester
                    </label>
                    <select
                      id="coverage-semester"
                      value={semester}
                      onChange={(event) => setSemester(event.target.value)}
                      className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Not specified</option>
                      {Array.from({ length: 7 }, (_, index) => String(index + 1)).map((value) => (
                        <option key={value} value={value}>
                          Semester {value}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-4">
                  <label htmlFor="coverage-file" className="text-sm font-medium">
                    PDF file
                  </label>
                  <input
                    id="coverage-file"
                    name="file"
                    type="file"
                    accept="application/pdf,.pdf"
                    required
                    className="mt-2 block w-full rounded-xl border border-border bg-background p-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-accent-soft file:px-3 file:py-2 file:font-semibold file:text-accent"
                  />
                </div>

                {message ? (
                  <p role="alert" className="mt-3 text-sm font-medium text-red-600">
                    {message}
                  </p>
                ) : null}

                <div className="mt-5 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeDialog}
                    disabled={uploading}
                    className="min-h-11 rounded-xl px-4 text-sm font-semibold text-muted hover:bg-surface-muted disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading || !semesterGroup}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <UploadSimple size={16} weight="bold" />
                    {uploading ? "Uploading…" : "Upload to archive"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
