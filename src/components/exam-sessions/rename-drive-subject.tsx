"use client";

import { useState } from "react";
import { PencilSimple } from "@phosphor-icons/react/dist/ssr";
import { renameDriveSubjectAction } from "@/lib/actions";

export function RenameDriveSubject({ id, name }: { id: string; name: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [saving, setSaving] = useState(false);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex items-center gap-1 text-xs text-muted hover:text-accent"
      >
        <PencilSimple size={12} />
        Rename
      </button>
    );
  }

  async function save() {
    setSaving(true);
    try {
      const formData = new FormData();
      formData.set("id", id);
      formData.set("name", value);
      await renameDriveSubjectAction(formData);
      setEditing(false);
      window.location.reload();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="rounded border border-border bg-surface px-1.5 py-0.5 text-xs focus:border-accent focus:outline-none"
      />
      <button
        type="button"
        disabled={saving}
        onClick={save}
        className="text-xs font-medium text-accent hover:underline disabled:opacity-60"
      >
        Save
      </button>
      <button type="button" onClick={() => setEditing(false)} className="text-xs text-muted hover:underline">
        Cancel
      </button>
    </div>
  );
}
