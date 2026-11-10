import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { removeSubscription, saveSubscription, sendOwnerPush, vapidKeys } from "@/lib/owner-push";

export const dynamic = "force-dynamic";
const deny = () => NextResponse.json({ error: "unauthorized" }, { status: 401 });

export async function GET() {
  if (!(await getSession())) return deny();
  return NextResponse.json({ key: (await vapidKeys()).publicKey });
}

export async function POST(req: Request) {
  if (!(await getSession())) return deny();
  const { subscription: s, test } = await req.json().catch(() => ({}));
  if (!s?.endpoint || !s.keys?.p256dh || !s.keys?.auth || !/^https:\/\//.test(s.endpoint)) return NextResponse.json({ error: "bad subscription" }, { status: 400 });
  await saveSubscription({ endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } });
  if (test) await sendOwnerPush("Alerts are on. You'll be pinged for every new lead.");
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!(await getSession())) return deny();
  const { endpoint } = await req.json().catch(() => ({}));
  if (endpoint) await removeSubscription(endpoint);
  return NextResponse.json({ ok: true });
}
