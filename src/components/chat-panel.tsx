"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpenText, Minus, PaperPlaneRight, X } from "@phosphor-icons/react";
import { getChatLink, getVisitorId, isSeedMessage, saveChatLink } from "@/lib/lead-intent";

type Msg = { id: number; mine: boolean; auto: boolean; body: string; at: number };
type Pending = { key: number; body: string; failed?: boolean };

const POLL_MS = 2500; // also how quickly "typing…" from the team appears
// The first line the team sees (💎 / ⭐) is for them, so the visitor's panel hides it. So are PingChat's bot replies:
// this chat is deliberately lean (one greeting, then a person answers).
const isSeed = (m: Msg) => m.mine && isSeedMessage(m.body);

/**
 * The on-site chat. Same conversation as the PingChat visitor chat (the team answers from their one inbox), but it
 * lives in the page: nobody is sent to another tab. One greeting asks for subject and semester; nothing else is
 * offered. Opens by itself when someone says No to the notes pop-up (`star`) or when the team replies.
 */
export function ChatPanel({
  greeting,
  ctx,
  fallbackHref,
  onMinimise,
}: {
  /** "star": said No to the notes pop-up. "back": came back from WhatsApp. Otherwise the plain greeting. */
  greeting?: "star" | "back";
  /** Page context sent with the first message, so the team knows which paper they were on. */
  ctx?: string;
  /** Plain PingChat link, offered if a message can't be sent from here. */
  fallbackHref: string;
  onMinimise: () => void;
}) {
  const [thread, setThread] = useState<Msg[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState(false); // the team is typing a reply (reported by the chat server)
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const link = getChatLink();
    if (!link) return;
    try {
      const r = await fetch(`/api/lead-chat?thread=1&t=${link.slice(-48)}`, { cache: "no-store" });
      const d = (await r.json()) as { messages?: Msg[]; typing?: boolean };
      if (Array.isArray(d.messages)) setThread(d.messages);
      setTyping(!!d.typing);
    } catch {}
  }, []);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const t = setInterval(() => document.visibilityState === "visible" && void load(), POLL_MS);
    inputRef.current?.focus({ preventScroll: true });
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load]);

  useEffect(() => {
    const el = bodyRef.current;
    // Before they have written anything the greeting stays at the top; after that, follow the newest message.
    const talking = pending.length > 0 || thread.some((m) => !isSeed(m) && (m.mine || !m.auto));
    if (el && talking) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [thread, pending.length, typing]);

  async function send(raw: string) {
    const body = raw.replace(/\s+/g, " ").trim().slice(0, 300);
    if (!body || busy) return;
    const key = ++seq.current;
    setPending((p) => [...p, { key, body }]);
    setText("");
    setBusy(true);
    try {
      const r = await fetch("/api/lead-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vid: getVisitorId(), text: ctx && !getChatLink() ? `${body} (${ctx})` : body }),
      });
      const d = (await r.json()) as { ok?: boolean; link?: string };
      if (!d.ok) throw new Error("not sent");
      saveChatLink(d.link);
      await load();
      setPending((p) => p.filter((x) => x.key !== key));
    } catch {
      setPending((p) => p.map((x) => (x.key === key ? { ...x, failed: true } : x)));
    } finally {
      setBusy(false);
    }
  }

  const shown = thread.filter((m) => !isSeed(m) && !m.auto);
  const started = shown.some((m) => m.mine) || pending.length > 0;

  return (
    <section
      role="dialog"
      aria-label="Chat with NoteVault"
      onKeyDown={(e) => e.key === "Escape" && onMinimise()}
      className="apple-scope fixed inset-x-0 bottom-0 z-[60] flex h-[min(44rem,calc(100dvh-1rem))] flex-col overflow-hidden rounded-t-[26px] bg-surface text-foreground shadow-[0_24px_64px_-12px_rgba(0,0,0,0.4)] ring-1 ring-border motion-safe:animate-[chat-rise_0.45s_cubic-bezier(0.2,0.9,0.25,1.05)_both] sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[27rem] sm:rounded-[26px]"
    >
      <header className="flex items-center gap-3 bg-brand px-4 py-3.5 text-brand-foreground">
        <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-white/20">
          <BookOpenText size={20} weight="fill" />
          <span aria-hidden className="absolute -bottom-px -right-px size-3 rounded-full bg-[#30d158] ring-2 ring-brand" />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[16px] font-semibold">NoteVault</p>
          <p className="text-[12.5px] opacity-85">We reply within minutes</p>
        </div>
        <button type="button" onClick={onMinimise} aria-label="Minimise chat" className="flex size-9 items-center justify-center rounded-full bg-white/15 transition hover:bg-white/25">
          <Minus size={16} weight="bold" />
        </button>
        <button type="button" onClick={onMinimise} aria-label="Close chat" className="flex size-9 items-center justify-center rounded-full bg-white/15 transition hover:bg-white/25">
          <X size={16} weight="bold" />
        </button>
      </header>

      <div ref={bodyRef} className="flex flex-1 flex-col gap-2 overflow-y-auto bg-surface-muted px-4 py-4">
        <Bubble who="them">
          {greeting === "back"
            ? "Welcome back! 👋\nIf WhatsApp did not open, tell us your subject and semester here and we will help you right away."
            : `${greeting === "star" ? "⭐ " : ""}Hi! 👋\nPlease let me know your subject and semester.`}
        </Bubble>
        {shown.map((m) => (
          <Bubble key={m.id} who={m.mine ? "me" : "them"}>
            {m.body}
          </Bubble>
        ))}
        {pending.map((p) => (
          <div key={p.key} className="flex flex-col items-end gap-1">
            <Bubble who="me" dim={!p.failed}>
              {p.body}
            </Bubble>
            {p.failed && (
              <p className="text-[13px] text-red-600">
                Not sent.{" "}
                <button
                  type="button"
                  className="font-semibold underline"
                  onClick={() => {
                    setPending((list) => list.filter((x) => x.key !== p.key));
                    void send(p.body);
                  }}
                >
                  Tap to retry
                </button>
                {" · "}
                <a href={fallbackHref} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                  Open the full chat
                </a>
              </p>
            )}
          </div>
        ))}
        {started && !shown.some((m) => !m.mine) && !typing && !pending.some((p) => p.failed) && (
          <Bubble who="them">Thank you. A member of our team will reply here shortly.</Bubble>
        )}
        {typing && (
          <div aria-label="Typing" className="flex w-fit gap-1 rounded-[18px] rounded-bl-md bg-surface px-3.5 py-3 ring-1 ring-border">
            {[0, 1, 2].map((i) => (
              <span key={i} className="size-1.5 rounded-full bg-muted motion-safe:animate-[chat-dot_1.1s_infinite]" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
        className="flex items-center gap-2 border-t border-border bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={300}
          placeholder="Type a message"
          aria-label="Message"
          autoComplete="off"
          className="h-12 min-w-0 flex-1 rounded-full bg-surface-muted px-4 text-[16px] text-foreground outline-none placeholder:text-muted focus:ring-2 focus:ring-brand"
        />
        <button
          type="submit"
          disabled={!text.trim() || busy}
          aria-label="Send"
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground transition active:scale-95 disabled:opacity-40"
        >
          <PaperPlaneRight size={19} weight="fill" />
        </button>
      </form>
    </section>
  );
}

function Bubble({ who, dim, children }: { who: "me" | "them"; dim?: boolean; children: React.ReactNode }) {
  return (
    <p
      className={`max-w-[84%] whitespace-pre-wrap break-words px-3.5 py-2.5 text-[16px] leading-snug motion-safe:animate-[chat-pop_0.3s_cubic-bezier(0.2,0.9,0.25,1.1)_both] ${
        who === "me"
          ? `self-end rounded-[18px] rounded-br-md bg-brand text-brand-foreground ${dim ? "opacity-70" : ""}`
          : "self-start rounded-[18px] rounded-bl-md bg-surface ring-1 ring-border"
      }`}
    >
      {children}
    </p>
  );
}
