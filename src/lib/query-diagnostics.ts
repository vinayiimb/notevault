// Development-only instrumentation for the data-layer functions in
// src/lib/data.ts and src/lib/pyq-catalog.ts. Off by default everywhere —
// opt in locally with NOTEVAULT_QUERY_DIAGNOSTICS=1. Never logs the query
// result itself, only shape metadata (name/duration/row count/approx size),
// so nothing in here can leak resource content, user data, or credentials.
//
// This exists to make the "does my change actually reduce what we send to
// Postgres" question answerable from a local `next dev` run instead of
// guessing from code review, per Phase 2A of the infrastructure migration
// (docs/PHASE_2_QUERY_REMEDIATION.md).

// Read fresh on every call (not cached at module scope) so it stays
// testable/toggleable without a process restart.
function diagnosticsEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    (process.env.NOTEVAULT_QUERY_DIAGNOSTICS === "1" || process.env.NOTEVAULT_QUERY_DIAGNOSTICS === "true")
  );
}

function approximateSize(value: unknown): number {
  try {
    return JSON.stringify(value)?.length ?? 0;
  } catch {
    return -1;
  }
}

function rowCount(value: unknown): number | null {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object" && Array.isArray((value as { items?: unknown }).items)) {
    return (value as { items: unknown[] }).items.length;
  }
  return value == null ? 0 : 1;
}

export type QueryDiagnosticMeta = {
  route?: string;
  pageSize?: number;
};

/** Wrap a data-layer call so its shape (not its contents) is logged in dev. */
export async function recordQueryDiagnostic<T>(
  name: string,
  fn: () => Promise<T>,
  meta: QueryDiagnosticMeta = {},
): Promise<T> {
  if (!diagnosticsEnabled()) return fn();

  const start = performance.now();
  const result = await fn();
  const durationMs = Math.round((performance.now() - start) * 100) / 100;

  console.debug(
    `[query] ${name}` +
      (meta.route ? ` route=${meta.route}` : "") +
      ` durationMs=${durationMs}` +
      ` rows=${rowCount(result)}` +
      (meta.pageSize != null ? ` pageSize=${meta.pageSize}` : "") +
      ` approxBytes=${approximateSize(result)}`,
  );

  return result;
}
