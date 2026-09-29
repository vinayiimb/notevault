"use client";

import { useMemo, useState } from "react";
import { Copy, Check, MagnifyingGlass } from "@phosphor-icons/react";

type SubjectRow = {
  id: string;
  subjectName: string;
  programName: string;
  termName: string;
};

export function SubjectLookupTable({ rows }: { rows: SubjectRow[] }) {
  const [query, setQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.subjectName.toLowerCase().includes(q) ||
        r.programName.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q),
    );
  }, [rows, query]);

  async function copyId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1500);
    } catch {
      // Clipboard API can be unavailable (non-HTTPS, permissions) — the ID
      // is still visible in the table for manual copy, so this is a
      // graceful no-op rather than an error the admin needs to see.
    }
  }

  return (
    <div className="mt-5">
      <div className="relative max-w-md">
        <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search programme or subject…"
          className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm focus:border-accent focus:outline-none"
        />
      </div>

      <p className="mt-2 text-xs text-muted">
        {filtered.length} of {rows.length} subjects
      </p>

      <div className="mt-3 overflow-hidden rounded-xl border border-border bg-surface">
        <div className="max-h-[70vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface-muted text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Programme</th>
                <th className="px-4 py-2.5 text-left font-medium">Term</th>
                <th className="px-4 py-2.5 text-left font-medium">Subject</th>
                <th className="px-4 py-2.5 text-left font-medium">Subject ID</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-surface-muted/50">
                  <td className="max-w-[220px] truncate px-4 py-2.5 text-foreground">{r.programName}</td>
                  <td className="px-4 py-2.5 text-muted">{r.termName}</td>
                  <td className="max-w-[260px] truncate px-4 py-2.5 text-foreground">{r.subjectName}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted">{r.id}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => copyId(r.id)}
                      className="rounded-md border border-border p-1.5 text-muted transition hover:border-accent/40 hover:text-foreground"
                      title="Copy Subject ID"
                    >
                      {copiedId === r.id ? (
                        <Check size={14} weight="bold" className="text-green" />
                      ) : (
                        <Copy size={14} weight="bold" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted">
                    No subjects match &ldquo;{query}&rdquo;.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
