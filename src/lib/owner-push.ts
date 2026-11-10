import { createHash } from "node:crypto";
import webpush from "web-push";
import { prisma } from "@/lib/prisma";

// Web Push to the owner's phone/home-screen app. No migration and no env vars: subscriptions and the VAPID
// keys live as rows in FeatureFlag ("push:<hash>" / "push-vapid"). Env VAPID_PUBLIC/VAPID_PRIVATE override.
// Features page ignores unknown keys. ponytail: one table for key/value; move to its own table if it grows.
const VAPID_KEY = "push-vapid";

export async function vapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  if (process.env.VAPID_PUBLIC && process.env.VAPID_PRIVATE) return { publicKey: process.env.VAPID_PUBLIC, privateKey: process.env.VAPID_PRIVATE };
  const row = await prisma.featureFlag.findUnique({ where: { key: VAPID_KEY } });
  if (row) return JSON.parse(row.status);
  const keys = webpush.generateVAPIDKeys();
  // create can race with a parallel first call; whoever loses reads the winner's keys.
  await prisma.featureFlag.create({ data: { key: VAPID_KEY, status: JSON.stringify(keys) } }).catch(() => undefined);
  return JSON.parse((await prisma.featureFlag.findUniqueOrThrow({ where: { key: VAPID_KEY } })).status);
}

const subKey = (endpoint: string) => "push:" + createHash("sha256").update(endpoint).digest("hex").slice(0, 32);

export async function saveSubscription(sub: webpush.PushSubscription) {
  await prisma.featureFlag.upsert({ where: { key: subKey(sub.endpoint) }, create: { key: subKey(sub.endpoint), status: JSON.stringify(sub) }, update: { status: JSON.stringify(sub) } });
}
export const removeSubscription = (endpoint: string) => prisma.featureFlag.deleteMany({ where: { key: subKey(endpoint) } });

/** Fire and forget; never throws. Dead subscriptions (404/410) are deleted. */
export async function sendOwnerPush(body: string): Promise<void> {
  try {
    const rows = await prisma.featureFlag.findMany({ where: { key: { startsWith: "push:" } } });
    if (!rows.length) return;
    const k = await vapidKeys();
    webpush.setVapidDetails("mailto:aiwithvinaykumar@gmail.com", k.publicKey, k.privateKey);
    await Promise.all(
      rows.map(async (r) => {
        try {
          await webpush.sendNotification(JSON.parse(r.status), JSON.stringify({ title: "DU PYQ Online", body, url: "/admin/leads" }), { TTL: 3600, urgency: "high" });
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) await prisma.featureFlag.deleteMany({ where: { key: r.key } });
        }
      }),
    );
  } catch {}
}
