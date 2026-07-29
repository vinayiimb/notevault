"use client";

import { useState } from "react";
import { LinkSimple } from "@phosphor-icons/react/dist/ssr";
import { linkDriveSubjectToSubjectAction } from "@/lib/actions";

type CatalogSubject = { id: string; name: string };

// Lets an admin manually link a Drive-matched subject (filename-derived,
// e.g. "Company Law III") to its catalog Subject (e.g. "DSC-2.2 — Company
// Law") when the auto-linker's confidence was too low — see
// prisma/link-drive-subjects-to-catalog.ts.
export function LinkDriveSubject({
  driveSubjectId,
  linkedSubjectId,
  catalogSubjects,
}: {
  driveSubjectId: string;
  linkedSubjectId: string | null;
  catalogSubjects: CatalogSubject[];
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(linkedSubjectId ?? "");
  const [saving, setSaving] = useState(false);

  const linkedName = catalogSubjects.find((s) => s.id === linkedSubjectId)?.name;

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex items-center gap-1 text-xs text-muted hover:text-accent"
      >
        <LinkSimple size={12} />
        {linkedName ? `Linked: ${linkedName}` : "Link to catalog subject"}
      </button>
    );
  }

  async function save() {
    setSaving(true);
    try {
      const formData = new FormData();
      formData.set("driveSubjectId", driveSubjectId);
      formData.set("subjectId", value);
      await linkDriveSubjectToSubjectAction(formData);
      setEditing(false);
      window.location.reload();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="max-w-56 rounded border border-border bg-surface px-1.5 py-0.5 text-xs focus:border-accent focus:outline-none"
      >
        <option value="">— Unlinked —</option>
        {catalogSubjects.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={saving}
        onClick={save}
        className="text-xs font-medium text-accent hover:underline disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => {
          setValue(linkedSubjectId ?? "");
          setEditing(false);
        }}
        className="text-xs text-muted hover:underline"
      >
        Cancel
      </button>
    </div>
  );
}
