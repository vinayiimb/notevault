"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { FEATURES, isFeatureStatus } from "@/lib/feature-flags";
import { clearFeatureFlagCache } from "@/lib/feature-flags-server";

export async function saveFeatureFlagsAction(formData: FormData) {
  if (!(await getSession())) throw new Error("Unauthorized");

  // A status equal to the default is stored as "no row", so changing a
  // default in feature-flags.ts later still reaches tools nobody touched.
  const submitted = FEATURES.flatMap((feature) => {
    const status = formData.get(`status:${feature.key}`);
    return isFeatureStatus(status) ? [{ key: feature.key, status, isDefault: status === feature.defaultStatus }] : [];
  });
  await prisma.$transaction([
    prisma.featureFlag.deleteMany({ where: { key: { in: submitted.filter((s) => s.isDefault).map((s) => s.key) } } }),
    ...submitted
      .filter((s) => !s.isDefault)
      .map(({ key, status }) =>
        prisma.featureFlag.upsert({ where: { key }, create: { key, status }, update: { status } }),
      ),
  ]);

  clearFeatureFlagCache();
  revalidatePath("/admin/features");
}
