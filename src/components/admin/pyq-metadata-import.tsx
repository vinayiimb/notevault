"use client";

import { useActionState } from "react";
import { importCorePyqMetadataAction } from "@/lib/actions";

const initialState = { ok: false, message: "" };

export function PyqMetadataImport() {
  const [state, formAction, pending] = useActionState(importCorePyqMetadataAction, initialState);

  return (
    <form action={formAction} encType="multipart/form-data" className="mt-6 max-w-xl space-y-4">
      <label className="block text-sm font-medium">
        Subject manifest JSON
        <input
          type="file"
          name="file"
          accept=".json,application/json"
          required
          className="mt-2 block w-full rounded-xl border border-border bg-surface px-3 py-3 text-sm"
        />
      </label>
      <p className="text-sm text-muted">
        Upload one generated subject manifest at a time. Existing PDF records are matched by course,
        semester, and year; the complete OCR text and page count are then attached to them.
      </p>
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Importing…" : "Import OCR metadata"}
      </button>
      {state.message && (
        <p
          role="status"
          className={`rounded-xl border px-3 py-3 text-sm ${
            state.ok
              ? "border-emerald-300/50 bg-emerald-50 text-emerald-800"
              : "border-amber-300/50 bg-amber-50 text-amber-900"
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
