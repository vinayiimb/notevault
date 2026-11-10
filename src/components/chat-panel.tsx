"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpenText, CaretRight, CurrencyInr, Headset, Minus, PaperPlaneRight, Stack, WhatsappLogo, X } from "@phosphor-icons/react";
import { getChatLink, getVisitorId, saveChatLink } from "@/lib/lead-intent";
import { OPEN_NOTES_EVENT } from "@/lib/notes-promo";

type Msg = { id: number; mine: boolean; auto: boolean; body: string; at: number };
type Pending = { key: number; body: string; failed?: boolean };

const POLL_MS = 4000;
// The note that opens the chat when someone taps Yes ends with this. It is for the team, so the visitor's panel hides it.
// The auto-replies come from PingChat's bot and carry emoji; this panel keeps to plain text and icons.
const plain = (m: Msg) => (m.auto ? m.body.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, "").replace(/\s{2,}/g, " ").trim() : m.body);
const isSeed = (m: Msg) => m.mine && /\(clicked Yes on the website\)\s*$/i.test(m.body);

/**
 * The on-site chat. Same conversation as the PingChat visitor chat (the team answers from their one inbox), but it
 * lives in the page: nobody is sent to another tab. Opens by itself when someone said Yes to notes and closed the
 * form without leaving a number, and from the floating "Chat now" button.
 */
export function ChatPanel({
  what,
  ctx,
  fallbackHref,
  onMinimise,
}: {
  /** What they were looking at ("Microeconomics"), for the greeting and the quick options. */
  what: string;
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
  const [typing, setTyping] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const link = getChatLink();
    if (!link) return;
    try {
      const r = await fetch(`/api/lead-chat?thread=1&t=${link.slice(-48)}`, { cache: "no-store" });
      const d = (await r.json()) as { messages?: Msg[] };
      if (Array.isArray(d.messages)) setThread(d.messages);
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
    // Before they have written anything the greeting and options stay at the top; after that, follow the newest message.
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
      setTyping(true);
      setTimeout(() => setTyping(false), 2500);
    } catch {
      setPending((p) => p.map((x) => (x.key === key ? { ...x, failed: true } : x)));
    } finally {
      setBusy(false);
    }
  }

  // The page's number form (if it has one) opens over the chat; otherwise the ask goes to the team as a message.
  function wantWhatsApp() {
    const d = { handled: false };
    window.dispatchEvent(new CustomEvent(OPEN_NOTES_EVENT, { detail: d }));
    if (d.handled) onMinimise();
    else void send("Please send the notes on WhatsApp");
  }

  const options: { Icon: typeof BookOpenText; title: string; sub: string; say: string; wa?: boolean }[] = [
    { Icon: WhatsappLogo, title: "Send notes to my WhatsApp", sub: "Leave your number, we send them", say: "", wa: true },
    { Icon: BookOpenText, title: `Notes for ${what}`, sub: "Solved answers and repeated questions", say: `I need notes for ${what}` },
    { Icon: Stack, title: "Whole semester pack", sub: "All subjects of your semester", say: "I want the whole semester notes pack" },
    { Icon: CurrencyInr, title: "Price", sub: "How much do the notes cost?", say: "How much do the notes cost?" },
    { Icon: Headset, title: "Talk to a person", sub: "We reply within minutes", say: "I'd like to talk to someone" },
  ];
  const shown = thread.filter((m) => !isSeed(m));
  const started = shown.some((m) => m.mine) || pending.length > 0;

  return (
    <section
      role="dialog"
      aria-label="Chat with NoteVault"
      onKeyDown={(e) => e.key === "Escape" && onMinimise()}
      className="apple-scope fixed inset-x-0 bottom-0 z-50 flex h-[min(34rem,calc(100dvh-1rem))] flex-col overflow-hidden rounded-t-[26px] bg-surface text-foreground shadow-[0_24px_64px_-12px_rgba(0,0,0,0.4)] ring-1 ring-border motion-safe:animate-[chat-rise_0.45s_cubic-bezier(0.2,0.9,0.25,1.05)_both] sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[24rem] sm:rounded-[26px]"
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
          {started ? "Thanks for messaging us. A team member will reply here, usually within minutes." : `Still need notes for ${what}? Pick an option or type your question.`}
        </Bubble>
        {shown.map((m) => (
          <Bubble key={m.id} who={m.mine ? "me" : "them"}>
            {plain(m)}
          </Bubble>
        ))}
        {pending.map((p) => (
          <div key={p.key} className="flex flex-col items-end gap-1">
            <Bubble who="me" dim={!p.failed}>
              {p.body}
            </Bubble>
            {p.failed && (
              <p className="text-[12px] text-red-600">
                Could not send.{" "}
                <a href={fallbackHref} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                  Open the full chat
                </a>
              </p>
            )}
          </div>
        ))}
        {typing && (
          <div aria-label="Typing" className="flex w-fit gap-1 rounded-[18px] rounded-bl-md bg-surface px-3.5 py-3 ring-1 ring-border">
            {[0, 1, 2].map((i) => (
              <span key={i} className="size-1.5 rounded-full bg-muted motion-safe:animate-[chat-dot_1.1s_infinite]" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        )}
        {!started && (
          <div className="mt-1 flex flex-col gap-2">
            {options.map(({ Icon, title, sub, say, wa }) => (
              <button
                key={title}
                type="button"
                onClick={() => (wa ? wantWhatsApp() : void send(say))}
                className="flex items-center gap-3 rounded-2xl bg-surface p-2.5 pr-3 text-left ring-1 ring-border transition hover:ring-brand active:scale-[0.985]"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                  <Icon size={21} weight="duotone" />
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-[14.5px] font-semibold">{title}</span>
                  <span className="block truncate text-[12.5px] text-muted">{sub}</span>
                </span>
                <CaretRight size={14} weight="bold" className="shrink-0 text-muted" />
              </button>
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
          className="h-11 min-w-0 flex-1 rounded-full bg-surface-muted px-4 text-[15px] text-foreground outline-none placeholder:text-muted focus:ring-2 focus:ring-brand"
        />
        <button
          type="submit"
          disabled={!text.trim() || busy}
          aria-label="Send"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground transition active:scale-95 disabled:opacity-40"
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
      className={`max-w-[84%] whitespace-pre-wrap break-words px-3.5 py-2.5 text-[14.5px] leading-snug motion-safe:animate-[chat-pop_0.3s_cubic-bezier(0.2,0.9,0.25,1.1)_both] ${
        who === "me"
          ? `self-end rounded-[18px] rounded-br-md bg-brand text-brand-foreground ${dim ? "opacity-70" : ""}`
          : "self-start rounded-[18px] rounded-bl-md bg-surface ring-1 ring-border"
      }`}
    >
      {children}
    </p>
  );
}
