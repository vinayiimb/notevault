"use client";

import { Printer } from "@phosphor-icons/react";

// Browsers' print dialog offers "Save as PDF" as a destination, and the
// @media print rules in notes-content.css already strip chrome (nav,
// buttons, progress bar) and unwrap shadows/backgrounds for paper — so
// print and "export to PDF" are the same action here.
export function ContentPrintButton() {
  return (
    <button type="button" className="nt-btn nt-btn-ghost" onClick={() => window.print()} aria-label="Print or save as PDF">
      <Printer size={16} weight="bold" />
      <span className="hidden sm:inline">Print / Save PDF</span>
    </button>
  );
}
