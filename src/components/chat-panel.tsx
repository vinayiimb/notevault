"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Minus, PaperPlaneRight, X } from "@phosphor-icons/react";
import { getChatLink, getVisitorId, isSeedMessage, saveChatLink } from "@/lib/lead-intent";
import { CHAT_ORIGIN } from "@/lib/chat-link";
import type { ThreadCard } from "@/lib/pingchat";

type Msg = { id: number; mine: boolean; auto: boolean; body: string; at: number; card?: ThreadCard | null; actions?: string[] };
type Pending = { key: number; body: string; failed?: boolean };

const POLL_MS = 2500; // also how quickly "typing…" from the team appears
// The first line the team sees (💎 / ⭐) is for them, so the visitor's panel hides it.
const isSeed = (m: Msg) => m.mine && isSeedMessage(m.body);
// The bot talks in this panel too (sample pages, payment options). Its replies carry emoji; this panel keeps to plain text and icons.
const plain = (m: Msg) => (m.auto ? m.body.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, "").replace(/\s{2,}/g, " ").trim() : m.body);

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
  const [zoom, setZoom] = useState<string | null>(null);
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

  const shown = thread.filter((m) => !isSeed(m));
  const started = shown.some((m) => m.mine) || pending.length > 0;

  return (
    <section
      role="dialog"
      aria-label="Chat with DU PYQ"
      onKeyDown={(e) => e.key === "Escape" && onMinimise()}
      className="apple-scope fixed inset-x-0 bottom-0 z-[60] flex h-[min(46rem,calc(100dvh-0.5rem))] flex-col overflow-hidden rounded-t-[28px] bg-surface text-foreground shadow-[0_30px_80px_-16px_rgba(0,40,120,0.55)] ring-1 ring-black/5 motion-safe:animate-[chat-rise_0.45s_cubic-bezier(0.2,0.9,0.25,1.05)_both] sm:inset-x-auto sm:bottom-5 sm:right-5 sm:h-[min(44rem,calc(100dvh-2.5rem))] sm:w-[30rem] sm:rounded-[28px]"
    >
      <header className="relative flex items-center gap-3 overflow-hidden bg-gradient-to-br from-[#0a84ff] via-[#0071e3] to-[#5e5ce6] px-4 py-4 text-white">
        <span aria-hidden className="pointer-events-none absolute -right-8 -top-10 size-36 rounded-full bg-white/10" />
        <span className="relative flex size-12 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_6px_16px_-4px_rgba(0,0,0,0.35)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mascot.webp" alt="" className="size-10 object-contain" />
          <span aria-hidden className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full bg-[#30d158] ring-2 ring-[#0a7ae8]" />
        </span>
        <div className="relative min-w-0 flex-1 leading-tight">
          <p className="truncate text-[18px] font-bold tracking-[-0.01em]">DU PYQ</p>
          <p className="text-[13px] font-medium text-white/85">Online now · replies in minutes</p>
        </div>
        <button type="button" onClick={onMinimise} aria-label="Minimise chat" className="relative flex size-9 items-center justify-center rounded-full bg-white/18 backdrop-blur transition hover:bg-white/30">
          <Minus size={16} weight="bold" />
        </button>
        <button type="button" onClick={onMinimise} aria-label="Close chat" className="relative flex size-9 items-center justify-center rounded-full bg-white/18 backdrop-blur transition hover:bg-white/30">
          <X size={16} weight="bold" />
        </button>
      </header>

      <div ref={bodyRef} className="flex flex-1 flex-col gap-2.5 overflow-y-auto bg-[linear-gradient(180deg,#f3f7ff_0%,#f7f7fb_100%)] px-4 py-4 dark:bg-surface-muted">
        {!shown.some((m) => m.auto) && (
          <Bubble who="them">
            {greeting === "back"
              ? "Welcome back! 👋\nIf WhatsApp did not open, tell us your subject and semester here and we will help you right away."
              : `${greeting === "star" ? "⭐ " : ""}Hi! 👋\nPlease let me know your subject and semester.`}
          </Bubble>
        )}
        {shown.map((m, i) => {
          const last = i === shown.length - 1;
          return (
            <div key={m.id} className="flex flex-col gap-1.5">
              {plain(m) && <Bubble who={m.mine ? "me" : "them"}>{plain(m)}</Bubble>}
              {m.card && <CardView card={m.card} live={last} onZoom={setZoom} onSend={(t) => void send(t)} />}
              {last && !m.mine && m.actions && m.actions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {m.actions.map((a) => (
                    <button key={a} type="button" onClick={() => void send(a.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, "").trim())} className="h-9 rounded-full bg-surface px-4 text-[13.5px] font-semibold ring-1 ring-foreground/70 transition active:scale-95">
                      {a.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, "").trim()}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
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
      {zoom && (
        <button type="button" aria-label="Close preview" onClick={() => setZoom(null)} className="absolute inset-0 z-10 flex items-center justify-center bg-black/80 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="Sample notes" className="max-h-full max-w-full rounded-xl bg-white" />
        </button>
      )}
    </section>
  );
}
/** What the bot sends besides text: the sample pages, the payment options (with the discount), or the number + Gmail form. */
function CardView({ card, live, onZoom, onSend }: { card: ThreadCard; live: boolean; onZoom: (url: string) => void; onSend: (text: string) => void }) {
  const [phone, setPhone] = useState(card.kind === "contact" ? card.phone : "");
  const [gmail, setGmail] = useState("");
  if (card.kind === "images") {
    return (
      <div className="grid w-full grid-cols-2 gap-2">
        {card.images.map((i) => (
          <button key={i.url} type="button" onClick={() => onZoom(`${CHAT_ORIGIN}${i.url}`)} className="overflow-hidden rounded-xl bg-white shadow-[0_6px_16px_-8px_rgba(0,0,0,0.35)] ring-1 ring-black/10 transition active:scale-[0.98]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${CHAT_ORIGIN}${i.url}`} alt="Sample notes page" loading="lazy" className="aspect-[16/10] w-full object-cover object-left-top" />
          </button>
        ))}
      </div>
    );
  }
  if (card.kind === "contact") {
    if (!live) return null;
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (phone.replace(/\D/g, "").length >= 10 && /\S+@\S+\.\S+/.test(gmail)) onSend(`${phone} ${gmail.trim()}`);
        }}
        className="flex w-full flex-col gap-2 rounded-2xl bg-surface p-3 ring-1 ring-border"
      >
        <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="WhatsApp number" aria-label="WhatsApp number" required className="h-10 rounded-xl bg-surface-muted px-3 text-[14.5px] outline-none focus:ring-2 focus:ring-brand" />
        <input value={gmail} onChange={(e) => setGmail(e.target.value)} type="email" placeholder="Gmail" aria-label="Gmail" required className="h-10 rounded-xl bg-surface-muted px-3 text-[14.5px] outline-none focus:ring-2 focus:ring-brand" />
        <button type="submit" className="h-10 rounded-full bg-brand text-[14.5px] font-semibold text-brand-foreground">Send</button>
      </form>
    );
  }
  return (
    <div className="w-full rounded-[20px] bg-white p-3 shadow-[0_10px_28px_-14px_rgba(0,40,120,0.45)] ring-1 ring-black/5">
      <p className="mb-2 px-1 text-[15px] font-bold">{card.title}</p>
      <div className="flex flex-col gap-1.5">
        {card.options.map((o) => (
          <a key={o.href} href={o.href} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 transition active:scale-[0.985] ${o.best ? "bg-[#eef5ff] ring-2 ring-[#0071e3]" : "bg-[#f4f5f9]"}`}>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block text-[14px] font-semibold">{o.label}</span>
              <span className="block text-[11.5px] text-muted">{o.note}</span>
            </span>
            <span className="flex flex-col items-end leading-tight">
              {o.was ? (
                <span className="flex items-center gap-1.5">
                  <s className="text-[13px] font-semibold decoration-red-500 decoration-2">₹{o.was}</s>
                  {o.off ? <span className="rounded-full bg-green-600 px-1.5 py-px text-[11px] font-bold text-white">{o.off}% OFF</span> : null}
                </span>
              ) : null}
              <span className="text-[18px] font-extrabold tabular-nums">₹{o.price}</span>
            </span>
            <span className="rounded-full bg-foreground px-3 py-1.5 text-[12.5px] font-semibold text-background">Pay</span>
          </a>
        ))}
      </div>
      {card.foot && <p className="mt-1.5 px-1 text-[11px] text-muted">{card.foot}</p>}
    </div>
  );
}



function Bubble({ who, dim, children }: { who: "me" | "them"; dim?: boolean; children: React.ReactNode }) {
  return (
    <p
      className={`max-w-[84%] whitespace-pre-wrap break-words px-3.5 py-2.5 text-[16px] leading-snug motion-safe:animate-[chat-pop_0.3s_cubic-bezier(0.2,0.9,0.25,1.1)_both] ${
        who === "me"
          ? `self-end rounded-[20px] rounded-br-md bg-gradient-to-br from-[#0a84ff] to-[#0071e3] text-white shadow-[0_6px_14px_-8px_rgba(0,113,227,0.8)] ${dim ? "opacity-70" : ""}`
          : "self-start rounded-[20px] rounded-bl-md bg-white shadow-[0_4px_12px_-8px_rgba(0,0,0,0.25)] ring-1 ring-black/5"
      }`}
    >
      {children}
    </p>
  );
}
