import { CheckCircle, WarningCircle } from "@phosphor-icons/react/dist/ssr";

// Result banner for the Papers archive editor — the server actions redirect
// back with ?ok= or ?err= so every button visibly confirms what it did.
export function ArchiveFlash({ ok, err }: { ok?: string; err?: string }) {
  if (!ok && !err) return null;
  const isError = Boolean(err);
  const Icon = isError ? WarningCircle : CheckCircle;
  return (
    <div
      role="status"
      className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${
        isError
          ? "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      }`}
    >
      <Icon size={18} weight="bold" className="mt-px shrink-0" />
      <span>{err || ok}</span>
    </div>
  );
}
