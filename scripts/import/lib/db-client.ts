// Single place that constructs a PrismaClient bound to the resolved import
// target (see target-guard.ts) — never the ambient @/lib/prisma singleton,
// so this tool can never accidentally pick up whatever DATABASE_URL is
// lying around in the environment for something else.
import { PrismaClient } from "@/generated/prisma";
import { resolveImportTarget, type ImportTarget } from "./target-guard";

let cached: { client: PrismaClient; target: ImportTarget } | null = null;

export function getImportPrismaClient(): { client: PrismaClient; target: ImportTarget } {
  if (cached) return cached;
  const target = resolveImportTarget();
  const client = new PrismaClient({ datasources: { db: { url: target.databaseUrl } } });
  cached = { client, target };
  return cached;
}

export async function disconnectImportPrismaClient(): Promise<void> {
  if (cached) {
    await cached.client.$disconnect();
    cached = null;
  }
}
