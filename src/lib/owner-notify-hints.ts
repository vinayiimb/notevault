import type { Provider } from "@/lib/owner-notify";

// Plain-English "what to do" for the replies the two senders actually give when something is wrong. These are the
// usual causes, not a guarantee; the raw reply is always shown next to the hint.

export function explainAlertFailure(f: { provider: Provider; status: number | null; detail: string; template: boolean }): string {
  const d = f.detail;
  if (f.status === null) {
    return "The server couldn't reach the sender (network problem or it took too long). If this keeps happening, check that the sender's website is up.";
  }
  if (f.provider === "cloud") {
    if (f.status === 401 || /"code"\s*:\s*190\b|access token|session has expired/i.test(d)) {
      return "WhatsApp rejected the access token. Temporary tokens from Meta's API Setup page expire after 24 hours, which would explain alerts working for a day and then stopping. Create a permanent token (a System User in Meta Business Settings) and update WHATSAPP_TOKEN on Railway.";
    }
    if (/131047|re-?engagement|24 hours/i.test(d)) {
      return f.template
        ? "WhatsApp says too much time has passed since you last messaged this number, even with a template set. Check that the template is approved and its name and language match WHATSAPP_TEMPLATE and WHATSAPP_TEMPLATE_LANG."
        : "WhatsApp only delivers plain messages within 24 hours of you last messaging the business number, so alerts arrive in bursts around the times you chat. Fix: create an approved message template with one variable and set WHATSAPP_TEMPLATE (and WHATSAPP_TEMPLATE_LANG) on Railway.";
    }
    if (/131030|allowed list|not in allowed/i.test(d)) {
      return "Your number isn't on the allowed recipients list of the test phone number. Add it in Meta's API Setup (the \"To\" field), or use a live business number.";
    }
    if (/132000|132001|132005|132012|template/i.test(d)) {
      return "The template doesn't match: check WHATSAPP_TEMPLATE (exact name), WHATSAPP_TEMPLATE_LANG (exact language code) and that the template has exactly one variable.";
    }
    if (f.status === 400 || f.status === 404) {
      return "WhatsApp doesn't recognise the request. The usual cause is WHATSAPP_PHONE_NUMBER_ID: it must be the Phone number ID from Meta's API Setup, not your phone number or the business account ID.";
    }
  } else {
    if (/api\s*key|apikey/i.test(d)) {
      return "CallMeBot rejected the key. Redo CallMeBot's activation for your number, then copy the new key into CALLMEBOT_APIKEY.";
    }
    if (f.status === 429 || /too many|limit|wait/i.test(d)) {
      return "CallMeBot is rate-limiting you. The free relay drops or delays bursts of messages, which would explain only a few alerts arriving. The official WhatsApp Cloud API doesn't have this limit.";
    }
  }
  if (f.status >= 500) return "The sender had a server problem. It was retried once; temporary outages usually clear up on their own.";
  return "Unrecognised reply. Read the raw reply above; if it isn't clear, send it to me.";
}
