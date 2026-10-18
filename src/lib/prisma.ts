import "server-only";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// DATABASE_URL is Neon's pooled (pgbouncer) endpoint. Prisma's default 5s
// connect_timeout is shorter than a Neon cold start after idle, and without
// pgbouncer=true it uses prepared statements the pooler can drop. Params
// already present in the URL win.
function withPoolParams(url: string | undefined) {
  if (!url) return undefined;
  const extra = { pgbouncer: "true", connect_timeout: "20" };
  const add = Object.entries(extra)
    .filter(([key]) => !new RegExp(`[?&]${key}=`).test(url))
    .map(([key, value]) => `${key}=${value}`);
  if (!add.length) return url;
  return url + (url.includes("?") ? "&" : "?") + add.join("&");
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: withPoolParams(process.env.DATABASE_URL),
    log:
      process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

globalForPrisma.prisma = prisma;
