import { PrismaClient } from "@/generated/prisma";

// Prevent PrismaClientInitializationError when DATABASE_URL is missing, unconfigured,
// or contains placeholders like "[SENSITIVE]" in local development environments.
if (typeof process !== "undefined" && process.env) {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || (!dbUrl.startsWith("postgresql://") && !dbUrl.startsWith("postgres://"))) {
    process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/notevault_dev?connect_timeout=1";
  }

  const unpooledUrl = process.env.DATABASE_URL_UNPOOLED;
  if (!unpooledUrl || (!unpooledUrl.startsWith("postgresql://") && !unpooledUrl.startsWith("postgres://"))) {
    process.env.DATABASE_URL_UNPOOLED = "postgresql://postgres:postgres@127.0.0.1:5432/notevault_dev?connect_timeout=1";
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaDbSafetyWarned: boolean | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Preview and Development deployments currently share the exact same
// DATABASE_URL as Production (see docs/PHASE_2_QUERY_REMEDIATION.md and
// docs/INFRASTRUCTURE_AUDIT.md — confirmed via `vercel env ls`, both scopes
// were "Production, Preview"). Every preview deployment's traffic — PR
// previews, branch pushes — was silently adding to production's Neon
// network-transfer bill. This can't safely auto-fix itself (no separate
// staging database exists yet — see Phase 2 decisions), so this only warns,
// once per warm instance, and never prints the connection string itself,
// only its hostname.
function warnIfNonProductionTargetsRemoteDatabase() {
  if (globalForPrisma.prismaDbSafetyWarned) return;

  const vercelEnv = process.env.VERCEL_ENV; // "production" | "preview" | "development" | undefined
  const isNonProduction = vercelEnv ? vercelEnv !== "production" : process.env.NODE_ENV !== "production";
  if (!isNonProduction) return;

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return;

  let hostname: string;
  try {
    hostname = new URL(dbUrl).hostname;
  } catch {
    return;
  }
  if (hostname === "localhost" || hostname === "127.0.0.1") return;

  globalForPrisma.prismaDbSafetyWarned = true;
  console.warn(
    `[db-safety] This is a ${vercelEnv ?? process.env.NODE_ENV ?? "non-production"} environment, ` +
      `but DATABASE_URL points at a remote database (host: ${hostname}), not localhost. ` +
      "If that host is the production Neon/Supabase database, this deployment's queries are " +
      "counted against production's network-transfer quota. See docs/PHASE_2_QUERY_REMEDIATION.md " +
      "for the recommended Vercel environment-variable scoping (Preview should use a separate " +
      "staging database once one exists).",
  );
}

warnIfNonProductionTargetsRemoteDatabase();
