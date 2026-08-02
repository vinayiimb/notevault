import { FileZip } from "@phosphor-icons/react/dist/ssr";

// A plain GET link, not a client component — the ZIP is streamed by the
// server route, so there's nothing to orchestrate in the browser and no
// loading state to fake.
export function DownloadAllButton({ subjectId }: { subjectId: string }) {
  return (
    <a
      href={`/api/subjects/${subjectId}/download-all`}
      download
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium transition hover:bg-surface-muted"
    >
      <FileZip size={16} weight="bold" />
      Download all as ZIP
    </a>
  );
}
