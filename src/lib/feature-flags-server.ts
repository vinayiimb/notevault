import "server-only";
import { prisma } from "@/lib/prisma";
import { defaultFlags, resolveFlags, type FeatureFlagMap } from "@/lib/feature-flags";

// Every public page load asks for flags once, so keep the answer in memory
// briefly instead of hitting Neon on each request. Held on globalThis because
// the server action and the API route are separate bundles with separate
// module state — a plain module variable couldn't be cleared by the action.
const TTL_MS = 30_000;
const store = globalThis as unknown as { featureFlagCache?: { flags: FeatureFlagMap; at: number } | null };

export async function getFeatureFlags(): Promise<FeatureFlagMap> {
  const cached = store.featureFlagCache;
  if (cached && Date.now() - cached.at < TTL_MS) return cached.flags;
  try {
    const rows = await prisma.featureFlag.findMany({ select: { key: true, status: true } });
    store.featureFlagCache = { flags: resolveFlags(rows), at: Date.now() };
    return store.featureFlagCache.flags;
  } catch (err) {
    // Table missing (migration not yet applied) or DB unreachable: the site
    // keeps working on the defaults rather than erroring.
    console.error("Failed to load feature flags:", err);
    return defaultFlags();
  }
}

export function clearFeatureFlagCache() {
  store.featureFlagCache = null;
}
