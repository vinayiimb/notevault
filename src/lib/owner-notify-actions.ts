"use server";

import { getSession } from "@/lib/auth";
import { ownerNotifyStatus, sendOwnerWhatsAppDetailed } from "@/lib/owner-notify";
import { explainAlertFailure } from "@/lib/owner-notify-hints";

export type TestAlertResult = {
  ran?: boolean;
  ok?: boolean;
  provider?: "cloud" | "callmebot" | null;
  status?: number | null;
  detail?: string;
  hint?: string;
};

// Admin → Leads → "Send test alert": sends a real message now and shows the sender's own reply, so a broken
// setup is visible in seconds instead of as "alerts just don't arrive".
export async function sendTestAlertAction(): Promise<TestAlertResult> {
  if (!(await getSession())) throw new Error("Not authorised");
  const when = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true });
  const r = await sendOwnerWhatsAppDetailed(`✅ Test alert from DU PYQ Online (${when} IST). If you can read this, new-lead alerts will reach you.`, "✅ Test alert");
  if (r.result === "skipped") return { ran: true, ok: false, provider: null, status: null, detail: r.detail };
  const { template } = ownerNotifyStatus();
  return {
    ran: true,
    ok: r.result === "sent",
    provider: r.provider,
    status: r.status,
    detail: r.detail,
    hint: r.result === "failed" && r.provider ? explainAlertFailure({ provider: r.provider, status: r.status, detail: r.detail, template }) : undefined,
  };
}
