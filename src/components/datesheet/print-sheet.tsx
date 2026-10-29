"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { DatesheetEntry } from "@/lib/datesheet-types";

type Props = {
  title: string;
  examSession: string;
  details: { label: string; value: string }[];
  entries: DatesheetEntry[]; // already in date/time order
  sourceUrl?: string;
};

const subscribe = () => () => {};

function shortDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// The printed datesheet. It is portalled straight under <body> so the print stylesheet
// can hide everything else on the page (site header, footer, pickers, floating buttons)
// with one rule instead of chasing each element, and it is laid out for A4 paper rather
// than reusing the on-screen card.
export function DatesheetPrintSheet({ title, examSession, details, entries, sourceUrl }: Props) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  if (!mounted) return null;

  const printedOn = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  return createPortal(
    <div className="ds-print">
      <style>{`
        .ds-print { display: none; }
        @media print {
          @page { size: A4 portrait; margin: 12mm 12mm 14mm; }
          body > *:not(.ds-print) { display: none !important; }
          html, body { background: #fff !important; }
          .ds-print {
            display: block; color: #111; font-size: 10.5pt; line-height: 1.35;
            -webkit-print-color-adjust: exact; print-color-adjust: exact;
          }
          .ds-print header { display: flex; justify-content: space-between; align-items: flex-end;
            border-bottom: 2px solid #111; padding-bottom: 6pt; margin-bottom: 8pt; }
          .ds-print h1 { font-size: 17pt; font-weight: 700; margin: 0; }
          .ds-print .ds-sub { font-size: 9.5pt; color: #444; margin-top: 2pt; }
          .ds-print .ds-brand { text-align: right; font-size: 8.5pt; color: #444; }
          .ds-print .ds-brand strong { display: block; font-size: 10pt; color: #111; }
          .ds-print .ds-details { display: flex; flex-wrap: wrap; gap: 4pt 16pt; margin: 0 0 8pt; font-size: 9.5pt; }
          .ds-print .ds-details span { color: #555; }
          .ds-print table { width: 100%; border-collapse: collapse; }
          .ds-print thead { display: table-header-group; }
          .ds-print th { text-align: left; font-size: 8pt; text-transform: uppercase; letter-spacing: .04em;
            color: #333; background: #eef0f3; border-bottom: 1px solid #999; padding: 4pt 5pt; }
          .ds-print td { padding: 4pt 5pt; border-bottom: 1px solid #ddd; vertical-align: top; }
          .ds-print tr { break-inside: avoid; }
          .ds-print tr.ds-newday td { border-top: 1.2pt solid #555; }
          .ds-print td.ds-date { white-space: nowrap; width: 17%; }
          .ds-print td.ds-date strong { display: block; }
          .ds-print td.ds-date small { color: #555; font-size: 8.5pt; }
          .ds-print td.ds-date.ds-repeat { color: #888; }
          .ds-print td.ds-date.ds-repeat strong { font-weight: 400; }
          .ds-print td.ds-nowrap { white-space: nowrap; }
          .ds-print td.ds-code { font-family: ui-monospace, Menlo, monospace; font-size: 9pt; white-space: nowrap; }
          .ds-print .ds-subject { color: #555; }
          .ds-print .ds-tick { width: 14pt; }
          .ds-print .ds-box { display: inline-block; width: 9pt; height: 9pt; border: 1pt solid #777; border-radius: 2pt; }
          .ds-print footer { margin-top: 10pt; padding-top: 6pt; border-top: 1px solid #bbb; font-size: 8pt; color: #555; }
        }
      `}</style>

      <header>
        <div>
          <h1>{title}</h1>
          <div className="ds-sub">University of Delhi &middot; {examSession} semester examinations</div>
        </div>
        <div className="ds-brand">
          <strong>DU PYQ Online</strong>
          dupyq.online
        </div>
      </header>

      <div className="ds-details">
        {details.map((d) => (
          <div key={d.label}>
            <span>{d.label}:</span> <strong>{d.value}</strong>
          </div>
        ))}
        <div>
          <span>Papers:</span> <strong>{entries.length}</strong>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Time</th>
            <th>Paper</th>
            <th>Paper code</th>
            <th>Sem</th>
            <th>Type</th>
            <th className="ds-tick" aria-label="Done" />
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => {
            const newDay = i > 0 && entries[i - 1].date !== e.date;
            const firstOfDay = i === 0 || newDay;
            return (
              <tr key={`${e.paperCode}-${e.date}-${i}`} className={newDay ? "ds-newday" : undefined}>
                {/* every row carries its date, so a day that runs onto a new page stays readable */}
                <td className={firstOfDay ? "ds-date" : "ds-date ds-repeat"}>
                  <strong>{shortDate(e.date)}</strong>
                  <small>{e.day}</small>
                </td>
                <td className="ds-nowrap">{e.startTime}</td>
                <td>
                  {e.subject ? <span className="ds-subject">{e.subject} &middot; </span> : null}
                  {e.description}
                </td>
                <td className="ds-code">{e.paperCode}</td>
                <td className="ds-nowrap">{e.semester ?? "—"}</td>
                <td className="ds-nowrap">{e.category !== "OTHER" ? e.category : ""}</td>
                <td className="ds-tick">
                  <span className="ds-box" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <footer>
        Tentative, as published by the University of Delhi
        {sourceUrl ? ` (official PDF: ${sourceUrl})` : ""}. Confirm your dates on exam.du.ac.in before each
        exam. Printed on {printedOn} from dupyq.online/exam-help/datesheet.
      </footer>
    </div>,
    document.body
  );
}
