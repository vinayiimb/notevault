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
// Fix: derive Supabase's direct (non-pooled, port 5432) connection string
// from DATABASE_URL every build, and use that — DATABASE_URL_UNPOOLED is
// no longer trusted as a separate source of truth. If DATABASE_URL isn't a
// Supabase pooler URL (e.g. local dev against a plain Postgres), this is a
// no-op and DATABASE_URL_UNPOOLED (or DATABASE_URL) is used as-is.
import { execSync } from "node:child_process";

function deriveSupabaseDirectUrl(pooledUrl) {
  const u = new URL(pooledUrl);
  const isSupabasePooler = u.hostname.endsWith(".pooler.supabase.com");
  if (!isSupabasePooler) return null;

  // Supabase's transaction-pooler username is "postgres.<project-ref>";
  // the direct connection uses plain "postgres" on db.<project-ref>.supabase.co.
  const [user, projectRef] = u.username.split(".");
  if (user !== "postgres" || !projectRef) return null;

  const direct = new URL(pooledUrl);
  direct.hostname = `db.${projectRef}.supabase.co`;
  direct.port = "5432";
  direct.username = "postgres";
  direct.searchParams.delete("pgbouncer");
  return direct.toString();
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("[migrate-deploy-supabase] DATABASE_URL is not set — cannot run migrations.");
  process.exit(1);
}

let directUrl = process.env.DATABASE_URL_UNPOOLED;
try {
  const derived = deriveSupabaseDirectUrl(dbUrl);
  if (derived) {
    directUrl = derived;
    console.log(`[migrate-deploy-supabase] DATABASE_URL is a Supabase pooler URL — derived direct URL (host: ${new URL(derived).hostname}) for migrations, overriding DATABASE_URL_UNPOOLED.`);
  } else {
    console.log("[migrate-deploy-supabase] DATABASE_URL is not a Supabase pooler URL — using DATABASE_URL_UNPOOLED as configured.");
  }
} catch (err) {
  console.error("[migrate-deploy-supabase] Could not parse DATABASE_URL, falling back to configured DATABASE_URL_UNPOOLED:", err.message);
}

execSync("npx prisma migrate deploy", {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL_UNPOOLED: directUrl },
});
