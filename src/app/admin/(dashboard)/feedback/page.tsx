import Image from "next/image";
import { ChatCircleText } from "@phosphor-icons/react/dist/ssr";
import { prisma } from "@/lib/prisma";
import { deleteFeedbackAction, markFeedbackReadAction } from "@/lib/actions";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";

export default async function AdminFeedbackPage() {
  const feedback = await prisma.feedback.findMany({ orderBy: { createdAt: "desc" } });
  const unreadCount = feedback.filter((f) => !f.read).length;

  return (
    <div className="p-8">
      <div className="rounded-[28px] border border-border bg-surface p-8 shadow-[0_10px_40px_rgba(15,23,42,.06)] sm:p-10">
        <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Feedback</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Everything submitted through the public{" "}
          <span className="font-medium text-foreground">Feedback</span> page, newest first
          {unreadCount > 0 ? ` — ${unreadCount} unread` : ""}.
        </p>

        {feedback.length === 0 ? (
          <div className="mt-8 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-surface-muted p-12 text-center">
            <ChatCircleText size={28} className="text-muted" />
            <p className="text-sm text-muted">No feedback submitted yet.</p>
          </div>
        ) : (
          <div className="mt-8 flex flex-col gap-3">
            {feedback.map((entry) => (
              <article
                key={entry.id}
                className={`rounded-2xl border p-5 ${entry.read ? "border-border bg-background" : "border-accent/30 bg-accent-soft/40"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="text-xs text-muted">
                    {entry.createdAt.toLocaleString()}
                    {!entry.read && (
                      <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-foreground">NEW</span>
                    )}
                  </p>
                  <div className="flex items-center gap-2">
                    <form action={markFeedbackReadAction}>
                      <input type="hidden" name="id" value={entry.id} />
                      <input type="hidden" name="read" value={entry.read ? "false" : "true"} />
                      <button type="submit" className="text-xs font-semibold text-accent hover:underline">
                        Mark as {entry.read ? "unread" : "read"}
                      </button>
                    </form>
                    <form action={deleteFeedbackAction}>
                      <input type="hidden" name="id" value={entry.id} />
                      <ConfirmSubmitButton
                        confirmMessage="Delete this feedback? This can't be undone."
                        className="text-xs font-semibold text-red-600 hover:underline"
                      >
                        Delete
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                </div>

                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">{entry.message}</p>

                {entry.screenshotUrl && (
                  <a
                    href={entry.screenshotUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-block overflow-hidden rounded-lg border border-border transition hover:border-accent"
                  >
                    <Image
                      src={entry.screenshotUrl}
                      alt={entry.screenshotName ?? "Attached screenshot"}
                      width={220}
                      height={140}
                      unoptimized
                      className="h-[140px] w-[220px] object-cover"
                    />
                  </a>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
