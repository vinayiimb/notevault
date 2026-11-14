"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, CaretRight, WhatsappLogo, X } from "@phosphor-icons/react";
import { getChatLink, getVisitorId, isSeedMessage, saveChatLink } from "@/lib/lead-intent";
import { CHAT_ORIGIN } from "@/lib/chat-link";
import type { ThreadCard } from "@/lib/pingchat";

type Msg = { id: number; mine: boolean; auto: boolean; body: string; at: number; card?: ThreadCard | null; actions?: string[] };
type Pending = { key: number; body: string; failed?: boolean };

const POLL_MS = 2500; // also how quickly "typing…" from the team appears
// The first line the team sees (💎 / ⭐) is for them, so the visitor's panel hides it.
const isSeed = (m: Msg) => m.mine && isSeedMessage(m.body);
// The bot talks in this panel too (sample pages, payment options). Its replies carry emoji; this panel keeps to plain text and icons.
// What the chat says for a visitor coming back from WhatsApp, and the one question the bot asks (bot.js WELCOME).
const OPENER_TEXT = "Hi i need notes";
const OPENER = /^hi i need notes$/i;
const OPENER_REPLY = "Which subject do you need?";
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
  /** "back": came back from WhatsApp after tapping Yes, so "Hi i need notes" is sent for them. "star": said No. */
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
  const autoSent = useRef(false);

  const load = useCallback(async (): Promise<Msg[]> => {
    const link = getChatLink();
    if (!link) return [];
    try {
      const r = await fetch(`/api/lead-chat?thread=1&t=${link.slice(-48)}`, { cache: "no-store" });
      const d = (await r.json()) as { messages?: Msg[]; typing?: boolean };
      if (Array.isArray(d.messages)) setThread(d.messages);
      setTyping(!!d.typing);
      return d.messages ?? [];
    } catch {
      return [];
    }
  }, []);

  const send = useCallback(async (raw: string) => {
    const body = raw.replace(/\s+/g, " ").trim().slice(0, 300);
    if (!body) return;
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
  }, [ctx, load]);

  useEffect(() => {
    const first = setTimeout(async () => {
      const msgs = await load();
      // Back from WhatsApp after "Yes": the chat says it for them, once per return. Skipped if they already said it.
      if (greeting === "back" && !autoSent.current) {
        autoSent.current = true;
        if (!msgs.some((m) => m.mine && OPENER.test(m.body))) void send(OPENER_TEXT);
      }
    }, 0);
    const t = setInterval(() => document.visibilityState === "visible" && void load(), POLL_MS);
    inputRef.current?.focus({ preventScroll: true });
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load, send, greeting]);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [thread, pending.length, typing]);

  const shown = thread.filter((m) => !isSeed(m));
  // Nothing in the thread yet and nothing on its way: one local line asks the only question we need.
  const empty = shown.length === 0 && pending.length === 0 && greeting !== "back";

  return (
    <section
      role="dialog"
      aria-label="Chat with DU PYQ"
      onKeyDown={(e) => e.key === "Escape" && onMinimise()}
      className="apple-scope fixed inset-x-0 bottom-0 z-[60] flex h-[min(42rem,calc(100dvh-3rem))] flex-col overflow-hidden rounded-t-[24px] bg-white text-[#1d1d1f] shadow-[0_0_0_0.5px_rgb(0_0_0/0.08),0_24px_70px_rgb(0_0_0/0.22)] motion-safe:animate-[chat-rise_0.4s_cubic-bezier(0.2,0.9,0.25,1.05)_both] dark:bg-[#1c1c1e] dark:text-[#f5f5f7] dark:shadow-[0_0_0_0.5px_rgb(255_255_255/0.12),0_24px_70px_rgb(0_0_0/0.6)] sm:inset-x-auto sm:bottom-5 sm:right-5 sm:h-[min(38rem,calc(100dvh-2.5rem))] sm:w-[24rem] sm:rounded-[24px]"
    >
      <header className="relative z-10 flex items-center gap-3 border-b-[0.5px] border-black/10 bg-white/80 px-4 pb-3 pt-4 backdrop-blur-xl backdrop-saturate-150 dark:border-white/10 dark:bg-[#1c1c1e]/80 sm:pt-3">
        <span aria-hidden className="absolute left-1/2 top-1.5 h-[5px] w-9 -translate-x-1/2 rounded-full bg-black/15 dark:bg-white/20 sm:hidden" />
        <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-[#f2f2f7] dark:bg-[#2c2c2e]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mascot.webp" alt="" className="size-8 object-contain" />
          <span aria-hidden className="absolute bottom-0 right-0 size-3 rounded-full bg-[#34c759] ring-2 ring-white dark:ring-[#1c1c1e]" />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[17px] font-semibold tracking-[-0.02em]">DU PYQ</p>
          <p className="text-[13px] text-[#6e6e73] dark:text-[#a1a1a6]">Usually replies in minutes</p>
        </div>
        <button
          type="button"
          onClick={onMinimise}
          aria-label="Close chat"
          className="flex size-11 items-center justify-center rounded-full text-[#6e6e73] transition active:scale-95 focus-visible:outline-2 focus-visible:outline-[#0071e3] dark:text-[#a1a1a6]"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-[#f2f2f7] dark:bg-[#2c2c2e]">
            <X size={14} weight="bold" />
          </span>
        </button>
      </header>

      <div ref={bodyRef} className="flex flex-1 flex-col overflow-y-auto px-3 pb-3 pt-4">
        <p className="mb-3 text-center text-[12px] font-medium text-[#8e8e93]">Today</p>
        {empty && <Bubble who="them">{OPENER_REPLY}</Bubble>}
        {shown.map((m, i) => {
          const last = i === shown.length - 1;
          const next = shown[i + 1];
          const tail = !next || next.mine !== m.mine; // last bubble of a run gets the tail and the bigger gap
          return (
            <div key={m.id} className={`flex flex-col gap-1.5 ${tail ? "mb-2.5" : "mb-0.5"}`}>
              {plain(m) && <Bubble who={m.mine ? "me" : "them"} tail={tail}>{plain(m)}</Bubble>}
              {m.card && <CardView card={m.card} live={last} onZoom={setZoom} onSend={(t) => void send(t)} />}
              {last && !m.mine && m.actions && m.actions.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {m.actions.map((a) => {
                    const label = a.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, "").trim();
                    return (
                      <button key={a} type="button" onClick={() => void send(label)} className="h-9 rounded-full px-4 text-[15px] font-medium text-[#0066cc] ring-1 ring-inset ring-[#0071e3]/40 transition active:scale-95 active:bg-[#0071e3]/10 dark:text-[#4da3ff] dark:ring-[#0a84ff]/50">
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {pending.map((p) => (
          <div key={p.key} className="mb-2.5 flex flex-col items-end gap-1">
            <Bubble who="me" dim={!p.failed}>
              {p.body}
            </Bubble>
            {p.failed && (
              <p className="pr-1 text-[13px] text-[#ff3b30]">
                Not delivered.{" "}
                <button
                  type="button"
                  className="font-semibold underline"
                  onClick={() => {
                    setPending((list) => list.filter((x) => x.key !== p.key));
                    void send(p.body);
                  }}
                >
                  Retry
                </button>
                {" · "}
                <a href={fallbackHref} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                  Open full chat
                </a>
              </p>
            )}
          </div>
        ))}
        {typing && (
          <div aria-label="Typing" className="flex w-fit gap-1 rounded-[18px] rounded-bl-[6px] bg-[#e9e9eb] px-3.5 py-3 dark:bg-[#3a3a3c]">
            {[0, 1, 2].map((i) => (
              <span key={i} className="size-2 rounded-full bg-[#8e8e93] motion-safe:animate-[chat-dot_1.1s_infinite]" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) void send(text);
        }}
        className="border-t-[0.5px] border-black/10 bg-white/80 px-3 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl dark:border-white/10 dark:bg-[#1c1c1e]/80"
      >
        <div className="flex min-h-11 items-center rounded-full bg-white pl-4 pr-1.5 ring-1 ring-inset ring-black/15 focus-within:ring-[#0071e3] dark:bg-[#2c2c2e] dark:ring-white/15">
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={300}
            placeholder="Message"
            aria-label="Message"
            autoComplete="off"
            enterKeyHint="send"
            className="h-11 min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-[#8e8e93]"
          />
          <button
            type="submit"
            disabled={!text.trim() || busy}
            aria-label="Send"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#0071e3] text-white transition active:scale-90 disabled:bg-[#d1d1d6] dark:disabled:bg-[#48484a]"
          >
            <ArrowUp size={17} weight="bold" />
          </button>
        </div>
      </form>
      {zoom && (
        <button type="button" aria-label="Close preview" onClick={() => setZoom(null)} className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 p-3">
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
  if (card.kind === "link") {
    const num = /wa\.me\/(\d{2})(\d{5})(\d+)/.exec(card.href);
    return (
      <a href={card.href} target="_blank" rel="noopener noreferrer" className="flex w-full max-w-[84%] items-center gap-3 rounded-[18px] bg-[#f2f2f7] px-3.5 py-3 transition active:scale-[0.98] active:bg-[#e5e5ea] dark:bg-[#2c2c2e] dark:active:bg-[#3a3a3c]">
        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#25d366] text-white">
          <WhatsappLogo size={20} weight="fill" />
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-[15px] font-semibold">{card.title || "WhatsApp"}</span>
          <span className="block text-[13px] tabular-nums text-[#6e6e73] dark:text-[#a1a1a6]">{num ? `+${num[1]} ${num[2]} ${num[3]}` : card.label}</span>
        </span>
        <CaretRight size={14} weight="bold" className="shrink-0 text-[#c7c7cc]" />
      </a>
    );
  }
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
  if (card.kind === "contact" || card.kind === "phone") {
    if (!live) return null;
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (card.kind === "phone") { if (phone.replace(/\D/g, "").length >= 10) onSend(phone); }
          else if (phone.replace(/\D/g, "").length >= 10 && /\S+@\S+\.\S+/.test(gmail)) onSend(`${phone} ${gmail.trim()}`);
        }}
        className="w-full max-w-[84%] overflow-hidden rounded-[18px] bg-[#f2f2f7] dark:bg-[#2c2c2e]"
      >
        <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="WhatsApp number" aria-label="WhatsApp number" required className="h-11 w-full bg-transparent px-4 text-[17px] outline-none placeholder:text-[#8e8e93]" />
        {card.kind === "contact" && <input value={gmail} onChange={(e) => setGmail(e.target.value)} type="email" placeholder="Gmail" aria-label="Gmail" required className="h-11 w-full border-t-[0.5px] border-black/10 bg-transparent px-4 text-[17px] outline-none placeholder:text-[#8e8e93] dark:border-white/10" />}
        <button type="submit" className="h-11 w-full border-t-[0.5px] border-black/10 text-[17px] font-semibold text-[#0066cc] active:bg-black/5 dark:border-white/10 dark:text-[#4da3ff]">Send</button>
      </form>
    );
  }
  return (
    <div className="w-full max-w-[90%] overflow-hidden rounded-[18px] bg-[#f2f2f7] dark:bg-[#2c2c2e]">
      <p className="px-4 pb-1 pt-3 text-[13px] font-medium uppercase tracking-[0.02em] text-[#6e6e73] dark:text-[#a1a1a6]">{card.title}</p>
      <div className="flex flex-col">
        {card.options.map((o, i) => (
          <a key={o.href} href={o.href} target="_blank" rel="noopener noreferrer" className={`flex min-h-14 items-center gap-3 px-4 py-2.5 transition active:bg-black/5 dark:active:bg-white/10 ${i ? "border-t-[0.5px] border-black/10 dark:border-white/10" : ""}`}>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block text-[16px] font-medium">
                {o.label}
                {o.best && <span className="ml-1.5 align-middle text-[12px] font-semibold text-[#248a3d] dark:text-[#30d158]">Best value</span>}
              </span>
              <span className="block text-[13px] text-[#6e6e73] dark:text-[#a1a1a6]">{o.note}</span>
            </span>
            <span className="text-right leading-tight">
              {o.was ? <s className="block text-[13px] text-[#8e8e93]">₹{o.was}</s> : null}
              <span className="text-[17px] font-semibold tabular-nums">₹{o.price}</span>
            </span>
            <CaretRight size={14} weight="bold" className="shrink-0 text-[#c7c7cc]" />
          </a>
        ))}
      </div>
      {card.foot && <p className="border-t-[0.5px] border-black/10 px-4 py-2 text-[12px] text-[#6e6e73] dark:border-white/10 dark:text-[#a1a1a6]">{card.foot}</p>}
    </div>
  );
}




function Bubble({ who, dim, tail = true, children }: { who: "me" | "them"; dim?: boolean; tail?: boolean; children: React.ReactNode }) {
  return (
    <p
      className={`max-w-[78%] whitespace-pre-wrap break-words rounded-[20px] px-3.5 py-2 text-[17px] leading-[1.3] tracking-[-0.01em] motion-safe:animate-[chat-pop_0.25s_cubic-bezier(0.2,0.9,0.25,1.1)_both] ${
        who === "me"
          ? `self-end bg-[#0071e3] text-white ${tail ? "rounded-br-[6px]" : ""} ${dim ? "opacity-60" : ""}`
          : `self-start bg-[#e9e9eb] text-[#1d1d1f] dark:bg-[#3a3a3c] dark:text-[#f5f5f7] ${tail ? "rounded-bl-[6px]" : ""}`
      }`}
    >
      {children}
    </p>
  );
}
