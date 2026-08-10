// Wraps `prisma migrate deploy` so it always talks to the same Supabase
// database the running app actually queries (DATABASE_URL), instead of
// trusting DATABASE_URL_UNPOOLED to have been kept in sync by hand.
//
// Why this exists: schema.prisma's directUrl reads DATABASE_URL_UNPOOLED,
// and Prisma's migrate commands connect through *that*, not DATABASE_URL.
// If DATABASE_URL_UNPOOLED is stale (e.g. left over from a previous DB
// provider after switching to Supabase), `migrate deploy` silently applies
// migrations to the wrong database and reports success — while the app,
// querying DATABASE_URL, is left missing tables/columns. That's exactly
// what happened once already (2026-08-10): DATABASE_URL_UNPOOLED still
// pointed at an old Neon database that already had every migration, so
// `migrate deploy` reported "no pending migrations" while Supabase (the
// real, live database) was missing BulkUploadRow entirely.
//
// Fix: derive Supabase's Session pooler URL (same pooler host as
// DATABASE_URL, port 5432 instead of 6543) from DATABASE_URL every build,
// and use that for migrations — DATABASE_URL_UNPOOLED is no longer trusted
// as a separate source of truth. If DATABASE_URL isn't a Supabase pooler
// URL (e.g. local dev against a plain Postgres), this is a no-op and
// DATABASE_URL_UNPOOLED (or DATABASE_URL) is used as-is.
//
// Note: this deliberately does NOT use Supabase's literal direct connection
// (db.<project-ref>.supabase.co:5432) — tried that first and it's
// unreachable from Vercel's build network (P1001), because that hostname
// is IPv6-only unless the project has purchased Supabase's IPv4 add-on.
// The Session pooler is IPv4-reachable and, unlike the Transaction pooler
// DATABASE_URL uses, supports the prepared-statement/multi-statement
// behavior `prisma migrate deploy` needs.
import { execSync } from "node:child_process";

function deriveSupabaseSessionPoolerUrl(pooledUrl) {
  const u = new URL(pooledUrl);
  const isSupabasePooler = u.hostname.endsWith(".pooler.supabase.com");
  if (!isSupabasePooler) return null;

  const session = new URL(pooledUrl);
  session.port = "5432"; // Transaction pooler (6543) -> Session pooler (5432), same host/user.
  session.searchParams.delete("pgbouncer"); // Session mode doesn't need/want this.
  return session.toString();
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("[migrate-deploy-supabase] DATABASE_URL is not set — cannot run migrations.");
  process.exit(1);
}

let directUrl = process.env.DATABASE_URL_UNPOOLED;
try {
  const derived = deriveSupabaseSessionPoolerUrl(dbUrl);
  if (derived) {
    directUrl = derived;
    console.log(`[migrate-deploy-supabase] DATABASE_URL is a Supabase pooler URL — derived Session pooler URL (host: ${new URL(derived).hostname}, port: ${new URL(derived).port}) for migrations, overriding DATABASE_URL_UNPOOLED.`);
  } else {
    console.log("[migrate-deploy-supabase] DATABASE_URL is not a Supabase pooler URL — using DATABASE_URL_UNPOOLED as configured.");
  }
} catch (err) {
  console.error("[migrate-deploy-supabase] Could not parse DATABASE_URL, falling back to configured DATABASE_URL_UNPOOLED:", err.message);
}

const migrateEnv = { ...process.env, DATABASE_URL_UNPOOLED: directUrl };

execSync("npx prisma migrate deploy", { stdio: "inherit", env: migrateEnv });
