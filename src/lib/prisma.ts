import "server-only";
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
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
