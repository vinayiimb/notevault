"use client";

import React from "react";
import { UPSCQuestion } from "@/lib/upsc-data";

interface QuestionBodyRendererProps {
  question: UPSCQuestion & {
    formatted_question?: string;
    table_data?: {
      headers: string[];
      rows: { num: string; cells: string[] }[];
    };
  };
}

export const QuestionBodyRenderer: React.FC<QuestionBodyRendererProps> = ({ question }) => {
  const text = question.formatted_question || question.original_question;
  const tableData = question.table_data;

  // Split into clean lines
  const rawLines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  const leadLines: string[] = [];
  const statements: { num: string; text: string }[] = [];
  const closingLines: string[] = [];

  let inStatements = false;
  let inClosing = false;

  const closingPrompts = [
    "select the correct",
    "which of the statements",
    "which of the above",
    "how many of the above",
    "which one of the following",
    "in which of the above rows",
    "which of the pairs",
  ];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const lower = line.toLowerCase();

    // Check if line is closing prompt
    if (closingPrompts.some((p) => lower.includes(p)) && i > 0) {
      inClosing = true;
      closingLines.push(line);
      continue;
    }

    if (inClosing) {
      closingLines.push(line);
      continue;
    }

    // Match statement numbering: 1. / 2. / I. / II. / (1) / (a)
    const stmtMatch = line.match(/^(\d+|[I|V|X]+)\.\s*(.*)/) || line.match(/^(\([1-9]\))\s*(.*)/);
    if (stmtMatch) {
      inStatements = true;
      statements.push({
        num: stmtMatch[1],
        text: stmtMatch[2],
      });
      continue;
    }

    if (inStatements) {
      if (statements.length > 0) {
        statements[statements.length - 1].text += " " + line;
      } else {
        leadLines.push(line);
      }
    } else {
      leadLines.push(line);
    }
  }

  return (
    <div className="space-y-4 text-slate-900 dark:text-slate-100 font-sans">
      {/* 1. Main Lead Paragraph */}
      {leadLines.length > 0 && (
        <div className="text-[15px] sm:text-[16px] leading-[1.7] text-slate-900 dark:text-slate-100 font-normal">
          {leadLines.join(" ")}
        </div>
      )}

      {/* 2. Clean Minimalist Table (for Match the following / multi-column rows) */}
      {tableData && tableData.rows && tableData.rows.length > 0 ? (
        <div className="overflow-x-auto my-3 rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold">
                {tableData.headers.map((h, idx) => (
                  <th key={idx} className="py-2.5 px-4 text-xs font-semibold uppercase tracking-wider first:w-12">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200 text-sm">
              {tableData.rows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="py-2.5 px-4 font-mono font-bold text-slate-400 text-xs">
                    {row.num}.
                  </td>
                  {row.cells.map((cell, cIdx) => (
                    <td key={cIdx} className="py-2.5 px-4">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : statements.length > 0 ? (
        /* 3. Clean Natural Statement List (Clean Indented Numbers) */
        <div className="space-y-2.5 my-3 pl-1 sm:pl-2">
          {statements.map((stmt, idx) => (
            <div key={idx} className="flex items-baseline gap-3 text-[15px] sm:text-[16px] leading-[1.65]">
              <span className="font-semibold text-slate-900 dark:text-slate-100 font-mono text-sm w-5 shrink-0 text-right">
                {stmt.num}.
              </span>
              <span className="text-slate-800 dark:text-slate-200 font-normal">
                {stmt.text}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {/* 4. Concluding Selection Code Prompt */}
      {closingLines.length > 0 && (
        <div className="text-[15px] sm:text-[16px] font-medium text-slate-900 dark:text-slate-100 pt-1 leading-relaxed">
          {closingLines.join(" ")}
        </div>
      )}
    </div>
  );
};
