// Sends the owner a WhatsApp message when a student does something (new lead, paid order, a message, a UPI
// payment to check). Server-side only; nothing here ever throws or slows a student's request down.
//
// Pick ONE way to deliver, by setting env vars on the server:
//   • WhatsApp Cloud API (official, from your own WhatsApp Business number):
//       WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, OWNER_WHATSAPP (e.g. 919376180015)
//       optional WHATSAPP_TEMPLATE (+ WHATSAPP_TEMPLATE_LANG, default "en"): an approved template with ONE
//       variable {{1}}; without it a plain message is sent, which WhatsApp only delivers within 24 hours of
//       you last messaging that business number.
//   • CallMeBot (free, 2-minute setup, a third-party relay): CALLMEBOT_PHONE, CALLMEBOT_APIKEY
// With neither set the alerts are skipped and everything else works as before.

const CLOUD_URL = () => process.env.WHATSAPP_GRAPH_URL ?? "https://graph.facebook.com/v21.0";
const CALLMEBOT_URL = () => process.env.CALLMEBOT_URL ?? "https://api.callmebot.com/whatsapp.php";
const GAP_MS = () => Number(process.env.OWNER_NOTIFY_GAP_MS ?? 1500);
const MAX_QUEUED = 50;

export type NotifyResult = "sent" | "skipped" | "failed";

export function ownerNotifyProvider(): "cloud" | "callmebot" | null {
  const e = process.env;
  if (e.WHATSAPP_TOKEN && e.WHATSAPP_PHONE_NUMBER_ID && e.OWNER_WHATSAPP) return "cloud";
  if (e.CALLMEBOT_PHONE && e.CALLMEBOT_APIKEY) return "callmebot";
  return null;
}

const digits = (s: string) => s.replace(/\D/g, "");

export async function sendOwnerWhatsApp(text: string): Promise<NotifyResult> {
  const provider = ownerNotifyProvider();
  if (!provider) return "skipped";
  const e = process.env;
  try {
    let res: Response;
    if (provider === "cloud") {
      const template = e.WHATSAPP_TEMPLATE;
      const body = template
        ? {
            messaging_product: "whatsapp",
            to: digits(e.OWNER_WHATSAPP!),
            type: "template",
            // Template variables can't hold line breaks.
            template: {
              name: template,
              language: { code: e.WHATSAPP_TEMPLATE_LANG ?? "en" },
              components: [{ type: "body", parameters: [{ type: "text", text: text.replace(/\s*\n+\s*/g, " | ").slice(0, 1000) }] }],
            },
          }
        : { messaging_product: "whatsapp", to: digits(e.OWNER_WHATSAPP!), type: "text", text: { body: text, preview_url: true } };
      res = await fetch(`${CLOUD_URL()}/${e.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${e.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
    } else {
      const url = new URL(CALLMEBOT_URL());
      url.searchParams.set("phone", digits(e.CALLMEBOT_PHONE!));
      url.searchParams.set("text", text);
      url.searchParams.set("apikey", e.CALLMEBOT_APIKEY!);
      res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    }
    if (!res.ok) {
      console.error(`owner WhatsApp alert failed (${provider}): ${res.status} ${(await res.text().catch(() => "")).slice(0, 200)}`);
      return "failed";
    }
    return "sent";
  } catch (err) {
    console.error("owner WhatsApp alert failed:", err instanceof Error ? err.message : err);
    return "failed";
  }
}

let chain: Promise<unknown> = Promise.resolve();
let queued = 0;

/**
 * Fire and forget. Messages go out one at a time with a short gap (the free relay drops bursts), and the
 * caller never waits for or sees a failure.
 */
export function notifyOwner(text: string): void {
  if (!ownerNotifyProvider() || queued >= MAX_QUEUED) return;
  queued++;
  chain = chain
    .then(() => sendOwnerWhatsApp(text))
    .catch(() => undefined)
    .then(() => new Promise((r) => setTimeout(r, GAP_MS())))
    .finally(() => {
      queued--;
    });
}
