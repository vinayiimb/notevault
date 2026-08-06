// Every existing seed/import script in prisma/*.ts either imports
// @/lib/prisma (follows whatever DATABASE_URL is in the shell, with a
// localhost fallback) or constructs its own PrismaClient after loading
// .env.local/.env directly — neither has ever refused to run against
// production. This module is the fix: every command in this importer
// (preview/validate/apply/verify) must resolve its target through here
// before touching Postgres. See docs/PHASE_2C_DATA_IMPORT_PLAN.md item 3.

export type ImportTarget = {
  databaseUrl: string;
  directUrl: string;
  hostname: string;
};

export class TargetGuardError extends Error {}

function parseHostname(url: string, label: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    throw new TargetGuardError(`${label} is not a valid URL (cannot parse hostname).`);
  }
}

/**
 * Resolves and validates the import target from environment variables that
 * must already be present in process.env (loaded by the operator via
 * `set -a; source .env.supabase-staging.local; set +a` — the same pattern
 * used in Phase 2B — never auto-loaded from .env/.env.local by this tool).
 *
 * Throws TargetGuardError (never prints the URLs) if:
 * - DATABASE_URL / DATABASE_URL_UNPOOLED are missing
 * - the hostname contains "neon.tech"
 * - the hostname does not end in "pooler.supabase.com" (unless
 *   ALLOW_NON_SUPABASE_HOST=1 is explicitly set, for local test DBs)
 * - NODE_ENV or VERCEL_ENV indicates production
 */
export function resolveImportTarget(): ImportTarget {
  const databaseUrl = process.env.DATABASE_URL;
  const directUrl = process.env.DATABASE_URL_UNPOOLED;

  if (!databaseUrl || !directUrl) {
    throw new TargetGuardError(
      "DATABASE_URL and DATABASE_URL_UNPOOLED must both be set. Load them with:\n" +
        "  set -a; source .env.supabase-staging.local; set +a\n" +
        "before running any import command. This tool never reads .env/.env.local itself.",
    );
  }

  const nodeEnv = process.env.NODE_ENV;
  const vercelEnv = process.env.VERCEL_ENV;
  if (nodeEnv === "production" || vercelEnv === "production") {
    throw new TargetGuardError(
      `Refusing to run: NODE_ENV/VERCEL_ENV indicates production (NODE_ENV=${nodeEnv ?? "unset"}, VERCEL_ENV=${vercelEnv ?? "unset"}).`,
    );
  }

  const hostname = parseHostname(databaseUrl, "DATABASE_URL");
  const directHostname = parseHostname(directUrl, "DATABASE_URL_UNPOOLED");

  if (hostname.includes("neon.tech") || directHostname.includes("neon.tech")) {
    throw new TargetGuardError(
      "Refusing to run: target hostname contains neon.tech. This tool must never touch the production Neon database.",
    );
  }

  const allowNonSupabase = process.env.ALLOW_NON_SUPABASE_HOST === "1";
  const isSupabase = hostname.endsWith("pooler.supabase.com");
  if (!isSupabase && !allowNonSupabase) {
    throw new TargetGuardError(
      `Refusing to run: hostname "${hostname}" does not end in pooler.supabase.com. ` +
        "Set ALLOW_NON_SUPABASE_HOST=1 only for a local test database.",
    );
  }

  return { databaseUrl, directUrl, hostname };
}

/** Never log the full URL — only ever the hostname, matching the pattern in src/lib/prisma.ts. */
export function describeTarget(target: ImportTarget): string {
  return `host=${target.hostname}`;
}
