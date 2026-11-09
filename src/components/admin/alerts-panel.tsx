import { getAlertLog, ownerNotifyStatus } from "@/lib/owner-notify";
import { explainAlertFailure } from "@/lib/owner-notify-hints";
import { AlertTestButton } from "@/components/admin/alert-test-button";

const NAMES = { cloud: "WhatsApp Cloud API", callmebot: "CallMeBot" } as const;

// "Are my WhatsApp alerts working?" at the top of Admin → Leads: which sender is set up, a test button, and what
// happened to the alerts sent since the server last restarted.
export function AlertsPanel() {
  const st = ownerNotifyStatus();
  const log = getAlertLog();
  const failed = log.filter((a) => a.result === "failed");
  const lastFailure = failed[0];

  return (
    <section className="mt-5 max-w-3xl rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">WhatsApp alerts to you</h2>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.provider ? "bg-green-600/10 text-green-700 dark:text-green-400" : "bg-red-500/10 text-red-600"}`}
        >
          {st.provider ? `On · ${NAMES[st.provider]}` : "Off"}
        </span>
      </div>

      {!st.provider && (
        <p className="mt-2 text-sm leading-relaxed">
          No alerts will ever arrive, because no sender is fully set up on the server.{" "}
          {st.partial ? (
            <>
              Something is set but incomplete. Still missing:{" "}
              <code className="rounded bg-surface-muted px-1">
                {(st.cloudMissing.length < st.callmebotMissing.length ? st.cloudMissing : st.callmebotMissing).join(", ")}
              </code>
              .
            </>
          ) : (
            <>
              Add <code className="rounded bg-surface-muted px-1">CALLMEBOT_PHONE</code> and{" "}
              <code className="rounded bg-surface-muted px-1">CALLMEBOT_APIKEY</code>, or{" "}
              <code className="rounded bg-surface-muted px-1">WHATSAPP_TOKEN</code>,{" "}
              <code className="rounded bg-surface-muted px-1">WHATSAPP_PHONE_NUMBER_ID</code> and{" "}
              <code className="rounded bg-surface-muted px-1">OWNER_WHATSAPP</code> on Railway.
            </>
          )}
        </p>
      )}
      {st.provider === "cloud" && !st.template && (
        <p className="mt-2 text-sm leading-relaxed text-muted">
          No template is set, so alerts are plain messages. WhatsApp only delivers those within 24 hours of you last
          messaging the business number; outside that window they are dropped.
        </p>
      )}

      <div className="mt-4">
        <AlertTestButton />
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <p className="text-sm font-medium">
          Recent attempts <span className="font-normal text-muted">(since the server last restarted)</span>
          {log.length > 0 && (
            <span className="ml-2 text-xs font-normal text-muted">
              {log.length - failed.length} sent · {failed.length} failed
            </span>
          )}
        </p>

        {lastFailure && lastFailure.provider && (
          <p className="mt-2 rounded-lg bg-red-500/5 p-3 text-sm leading-relaxed">
            <strong>
              Latest failure ({new Date(lastFailure.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}):
            </strong>{" "}
            {explainAlertFailure({ provider: lastFailure.provider, status: lastFailure.status, detail: lastFailure.detail, template: st.template })}
          </p>
        )}

        {log.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            None yet. The next new lead will show up here, sent or failed. This list resets whenever the site is
            redeployed or restarted.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-border/60 text-sm">
            {log.map((a, i) => (
              <li key={`${a.at}-${i}`} className="py-2">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span>
                    <span className={a.result === "sent" ? "text-green-600" : "text-red-600"}>{a.result === "sent" ? "✓ Sent" : "✗ Failed"}</span>
                    <span className="ml-2">{a.label}</span>
                    {a.retried && <span className="ml-2 text-xs text-muted">(retried once)</span>}
                  </span>
                  <span className="text-xs text-muted">{new Date(a.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}</span>
                </div>
                {a.result === "failed" && a.detail && (
                  <p className="mt-1 break-words font-mono text-xs text-muted">
                    {a.status ? `HTTP ${a.status}: ` : ""}
                    {a.detail}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
