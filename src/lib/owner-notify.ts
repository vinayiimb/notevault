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
const RETRY_MS = () => Number(process.env.OWNER_NOTIFY_RETRY_MS ?? 2000);
const MAX_QUEUED = 50;
const LOG_MAX = 40;

export type NotifyResult = "sent" | "skipped" | "failed";
export type Provider = "cloud" | "callmebot";

/** One try (plus its retry) at delivering an alert, for the admin "recent attempts" list. */
export type AlertAttempt = {
  at: number;
  label: string;
  provider: Provider;
  result: "sent" | "failed";
  status: number | null;
  /** The provider's own reply (or the network error), secrets removed. This is what explains a failure. */
  detail: string;
  retried: boolean;
};
export type SendOutcome = { result: NotifyResult; provider: Provider | null; status: number | null; detail: string; retried: boolean };

// Kept on globalThis: Next can load a module once per route bundle, and the lead action that sends alerts
// must share this list with the admin page that shows it. In memory only: it starts empty after a restart.
const g = globalThis as unknown as { __ownerAlertLog?: AlertAttempt[] };
const attempts = () => (g.__ownerAlertLog ??= []);
export const getAlertLog = (): AlertAttempt[] => [...attempts()];
function record(a: AlertAttempt) {
  const list = attempts();
  list.unshift(a);
  if (list.length > LOG_MAX) list.length = LOG_MAX;
}

/** Never let a token or API key reach the log, the admin page or the server console. */
function scrub(s: string) {
  for (const secret of [process.env.WHATSAPP_TOKEN, process.env.CALLMEBOT_APIKEY]) {
    if (secret && secret.length > 3) s = s.split(secret).join("***");
  }
  return s;
}

export function ownerNotifyProvider(): Provider | null {
  const e = process.env;
  if (e.WHATSAPP_TOKEN && e.WHATSAPP_PHONE_NUMBER_ID && e.OWNER_WHATSAPP) return "cloud";
  if (e.CALLMEBOT_PHONE && e.CALLMEBOT_APIKEY) return "callmebot";
  return null;
}

/** Which settings exist on the server (never their values), so the admin page can say what's missing. */
export function ownerNotifyStatus() {
  const e = process.env;
  const cloudMissing = ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "OWNER_WHATSAPP"].filter((k) => !e[k]);
  const callmebotMissing = ["CALLMEBOT_PHONE", "CALLMEBOT_APIKEY"].filter((k) => !e[k]);
  return {
    provider: ownerNotifyProvider(),
    template: !!e.WHATSAPP_TEMPLATE,
    cloudMissing,
    callmebotMissing,
    // Something is set but not enough: the usual "I added it, why nothing?" situation.
    partial: !ownerNotifyProvider() && (cloudMissing.length < 3 || callmebotMissing.length < 2),
  };
}

const digits = (s: string) => s.replace(/\D/g, "");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const firstLine = (t: string) => t.split("\n")[0].slice(0, 60);

// The free relay answers 200 with an error sentence for some problems, so a clearly negative body counts as a failure.
const CALLMEBOT_ERROR = /\b(error|invalid|not valid|too many|limit|blocked|wrong|denied)\b/i;

type Try = { ok: boolean; status: number | null; detail: string; transient: boolean };

async function tryOnce(provider: Provider, text: string): Promise<Try> {
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
    const reply = (await res.text().catch(() => "")).replace(/\s+/g, " ").trim().slice(0, 300);
    const bad = !res.ok || (provider === "callmebot" && CALLMEBOT_ERROR.test(reply));
    // Retry only what can fix itself (server trouble, rate limit); a rejected key or window won't.
    return { ok: !bad, status: res.status, detail: scrub(reply), transient: !res.ok && (res.status >= 500 || res.status === 429) };
  } catch (err) {
    return { ok: false, status: null, detail: scrub(err instanceof Error ? err.message : String(err)), transient: true };
  }
}

/** Sends one alert and reports exactly what happened. Never throws. */
export async function sendOwnerWhatsAppDetailed(text: string, label?: string): Promise<SendOutcome> {
  const provider = ownerNotifyProvider();
  if (!provider) return { result: "skipped", provider: null, status: null, detail: "No WhatsApp sender is configured.", retried: false };

  let t = await tryOnce(provider, text);
  let retried = false;
  if (!t.ok && t.transient) {
    retried = true;
    await sleep(RETRY_MS());
    t = await tryOnce(provider, text);
  }
  if (!t.ok) console.error(`owner WhatsApp alert failed (${provider}): ${t.status ?? "no response"} ${t.detail.slice(0, 200)}`);
  record({ at: Date.now(), label: label ?? firstLine(text), provider, result: t.ok ? "sent" : "failed", status: t.status, detail: t.detail, retried });
  return { result: t.ok ? "sent" : "failed", provider, status: t.status, detail: t.detail, retried };
}

export async function sendOwnerWhatsApp(text: string): Promise<NotifyResult> {
  return (await sendOwnerWhatsAppDetailed(text)).result;
}

let chain: Promise<unknown> = Promise.resolve();
let queued = 0;

/**
 * Fire and forget. Messages go out one at a time with a short gap (the free relay drops bursts), and the
 * caller never waits for or sees a failure.
 */
export function notifyOwner(text: string, label?: string): void {
  // phone push; independent of the WhatsApp sender below. Loaded lazily so this module stays importable without the database.
  void import("@/lib/owner-push").then((m) => m.sendOwnerPush(text)).catch(() => undefined);
  if (!ownerNotifyProvider() || queued >= MAX_QUEUED) return;
  queued++;
  chain = chain
    .then(() => sendOwnerWhatsAppDetailed(text, label))
    .catch(() => undefined)
    .then(() => new Promise((r) => setTimeout(r, GAP_MS())))
    .finally(() => {
      queued--;
    });
}
