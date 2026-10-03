"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { ArrowUp, Plus, Sparkles, Square, X } from "lucide-react";

// ChatGPT-style doubt solver for the notes reader. Talks to /api/ask-notes
// (Groq), sending the section the student is looking at plus anything they
// highlighted. Portaled to <body> because NotesSection's translate breaks
// position:fixed, so the notes theme vars are copied over on open.

type Msg = { role: "user" | "assistant"; content: string; quote?: string };

const THEME_VARS = ["--nt-background", "--nt-surface", "--nt-surface-muted", "--nt-text", "--nt-text-muted", "--nt-border", "--nt-primary"];
const SUGGESTIONS = [
  "Explain this section in simple words",
  "Give me a real-life example",
  "Write a 5-mark exam answer on this",
  "Summarise this in 5 revision points",
];
const THINKING = ["Reading your notes…", "Thinking…", "Writing it simply…"];

// Text from the last heading above the middle of the screen down to the next
// heading of the same or higher level — i.e. "the part I'm stuck on".
function sectionInView(article: HTMLElement): string {
  const heads = Array.from(article.querySelectorAll<HTMLElement>("h1,h2,h3"));
  const start = heads.filter((h) => h.getBoundingClientRect().top < window.innerHeight * 0.5).pop();
  const range = document.createRange();
  if (start) {
    range.setStartBefore(start);
    const level = Number(start.tagName[1]);
    const end = heads.slice(heads.indexOf(start) + 1).find((h) => Number(h.tagName[1]) <= level);
    if (end) range.setEndBefore(end);
    else range.setEndAfter(article.lastChild ?? article);
  } else {
    range.selectNodeContents(article);
  }
  return range.toString().replace(/\n{3,}/g, "\n\n").slice(0, 6000);
}

const noop = () => () => {};

export function AskAiPanel({ subject, targetId }: { subject: string; targetId: string }) {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [selection, setSelection] = useState("");
  const [chip, setChip] = useState<{ text: string; x: number; y: number } | null>(null);
  const [theme, setTheme] = useState<CSSProperties>({});
  const [tick, setTick] = useState(0);
  const [width, setWidth] = useState(() => {
    try { return Number(localStorage.getItem("ask-ai-width")) || 440; } catch { return 440; }
  });
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // "Ask AI" chip under highlighted text in the notes.
  useEffect(() => {
    const onSel = () => {
      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? "";
      const article = document.getElementById(targetId);
      if (!sel?.rangeCount || text.length < 3 || !article?.contains(sel.anchorNode)) return setChip(null);
      const r = sel.getRangeAt(0).getBoundingClientRect();
      setChip({ text: text.slice(0, 1500), x: Math.min(Math.max(r.left + r.width / 2, 80), window.innerWidth - 80), y: r.bottom + 10 });
    };
    const hide = () => setChip(null);
    document.addEventListener("selectionchange", onSel);
    window.addEventListener("scroll", hide, { passive: true });
    return () => {
      document.removeEventListener("selectionchange", onSel);
      window.removeEventListener("scroll", hide);
    };
  }, [targetId]);

  // Cycle the "thinking" label while waiting for the first token.
  const waiting = busy && messages[messages.length - 1]?.content === "";
  useEffect(() => {
    if (!waiting) return setTick(0);
    const id = setInterval(() => setTick((t) => t + 1), 1400);
    return () => clearInterval(id);
  }, [waiting]);

  useEffect(() => {
    const el = listRef.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 160) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function openPanel(withSelection?: string) {
    const article = document.getElementById(targetId);
    if (article) {
      const cs = getComputedStyle(article);
      setTheme(Object.fromEntries(THEME_VARS.map((v) => [v, cs.getPropertyValue(v)]).filter(([, val]) => val)));
    }
    if (withSelection) setSelection(withSelection);
    setChip(null);
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 250);
  }

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const article = document.getElementById(targetId);
    const history: Msg[] = [...messages, { role: "user", content: q, quote: selection || undefined }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setSelection("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setBusy(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const append = (t: string) =>
      setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: m[m.length - 1].content + t }]);
    try {
      const res = await fetch("/api/ask-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })), subject, selection, context: article ? sectionInView(article) : "" }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => null);
        append(`⚠️ ${err?.error ?? "Something went wrong. Try again."}`);
      } else {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          append(decoder.decode(value, { stream: true }));
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") append("⚠️ Network error — check your connection.");
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function newChat() {
    abortRef.current?.abort();
    setMessages([]);
    setSelection("");
    inputRef.current?.focus();
  }

  if (!mounted) return null;

  return createPortal(
    <div style={{ ...theme, "--ai-w": `${width}px` } as CSSProperties}>
      <style>{`
        @keyframes ai-shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
        @keyframes ai-spin { to { transform: rotate(360deg) } }
        @keyframes ai-blink { 50% { opacity: 0 } }
        .ai-shimmer { background: linear-gradient(90deg, var(--nt-text-muted,#888) 30%, var(--nt-text,#111) 50%, var(--nt-text-muted,#888) 70%); background-size: 200% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; animation: ai-shimmer 1.8s linear infinite; }
        .ai-ring { background: conic-gradient(from 0deg, transparent, var(--nt-primary,#3168FF)); animation: ai-spin 1s linear infinite; }
        .ai-caret::after { content: ""; display: inline-block; width: .55em; height: .55em; margin-left: 4px; border-radius: 9999px; background: var(--nt-text,#111); vertical-align: middle; animation: ai-blink 1s steps(1) infinite; }
        .ai-md p { margin: .5em 0 } .ai-md ul { list-style: disc; padding-left: 1.25em; margin: .5em 0 } .ai-md ol { list-style: decimal; padding-left: 1.25em; margin: .5em 0 }
        .ai-md li { margin: .2em 0 } .ai-md strong { font-weight: 650; color: var(--nt-text,#111) } .ai-md h1, .ai-md h2, .ai-md h3 { font-weight: 700; margin: .9em 0 .3em; font-size: 1.02em }
        .ai-md code { background: var(--nt-surface-muted,#f2f2f2); padding: .1em .35em; border-radius: 6px; font-size: .9em } .ai-md pre { overflow-x: auto; background: var(--nt-surface-muted,#f2f2f2); padding: .75em; border-radius: 12px }
        .ai-md table { display: block; overflow-x: auto; border-collapse: collapse; margin: .6em 0 } .ai-md th, .ai-md td { border: 1px solid var(--nt-border,#ddd); padding: .35em .6em }
        .ai-md blockquote { border-left: 3px solid var(--nt-primary,#3168FF); padding-left: .75em; color: var(--nt-text-muted,#666) } .ai-md > :first-child { margin-top: 0 }
      `}</style>

      {/* Highlight chip */}
      <AnimatePresence>
        {chip && !open && (
          <motion.button
            key="chip"
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => openPanel(chip.text)}
            className="fixed z-[60] flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-[#1A1D24] px-3.5 py-2 text-sm font-medium text-white shadow-xl"
            style={{ left: chip.x, top: chip.y }}
          >
            <Sparkles className="h-4 w-4 text-[#9BB5FF]" /> Ask AI about this
          </motion.button>
        )}
      </AnimatePresence>

      {/* Launcher */}
      <AnimatePresence>
        {!open && (
          <motion.button
            key="launcher"
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => openPanel()}
            aria-label="Ask AI about these notes"
            className="fixed bottom-5 right-5 z-[55] flex items-center gap-2 rounded-full bg-gradient-to-r from-[#3168FF] to-[#7B4DFF] py-3 pl-4 pr-5 text-sm font-semibold text-white shadow-[0_10px_30px_-8px_rgba(49,104,255,0.7)] print:hidden"
          >
            <span className="relative flex h-5 w-5 items-center justify-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-white/40" />
              <Sparkles className="relative h-5 w-5" />
            </span>
            Ask AI
          </motion.button>
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-[2px] sm:bg-black/5 sm:backdrop-blur-none"
            />
            <motion.aside
              key="panel"
              role="dialog"
              aria-label="AI tutor"
              initial={{ x: "100%", opacity: 0.6 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0.6 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-y-0 right-0 z-[61] flex w-full flex-col shadow-2xl sm:w-[var(--ai-w)] sm:border-l"
              style={{ background: "var(--nt-background, #fff)", color: "var(--nt-text, #111)", borderColor: "var(--nt-border, #e5e7eb)" }}
            >
              {/* Desktop drag-to-resize handle on the left edge */}
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Drag to resize"
                title="Drag to resize"
                onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
                onPointerMove={(e) => {
                  if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
                  setWidth(Math.round(Math.min(Math.max(window.innerWidth - e.clientX, 360), window.innerWidth * 0.85)));
                }}
                onPointerUp={() => { try { localStorage.setItem("ask-ai-width", String(width)); } catch {} }}
                onDoubleClick={() => setWidth(440)}
                className="group absolute inset-y-0 -left-1.5 z-10 hidden w-3 cursor-col-resize touch-none select-none sm:block"
              >
                <span className="absolute left-1/2 top-1/2 h-12 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#8C95A6]/40 transition-colors group-hover:bg-[#3168FF] group-active:bg-[#3168FF]" />
              </div>

              {/* Header */}
              <div className="flex items-center gap-3 border-b px-4 py-3" style={{ borderColor: "var(--nt-border, #e5e7eb)" }}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#3168FF] to-[#7B4DFF] text-white">
                  <Sparkles className="h-[18px] w-[18px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold leading-tight">AI Tutor</p>
                  <p className="truncate text-xs" style={{ color: "var(--nt-text-muted, #666)" }}>{subject}</p>
                </div>
                {messages.length > 0 && (
                  <button onClick={newChat} className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/10" style={{ border: "1px solid var(--nt-border, #e5e7eb)" }}>
                    <Plus className="h-3.5 w-3.5" /> New chat
                  </button>
                )}
                <button onClick={() => setOpen(false)} aria-label="Close" className="rounded-full p-2 hover:bg-black/5 dark:hover:bg-white/10">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Messages */}
              <div ref={listRef} className="flex-1 overflow-y-auto overscroll-contain px-4 py-5">
                {messages.length === 0 ? (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex h-full flex-col items-center justify-center text-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#3168FF] to-[#7B4DFF] text-white shadow-lg">
                      <Sparkles className="h-7 w-7" />
                    </div>
                    <h2 className="text-xl font-semibold">Stuck on something?</h2>
                    <p className="mt-1 max-w-[280px] text-sm" style={{ color: "var(--nt-text-muted, #666)" }}>
                      Ask any doubt about the part you&apos;re reading. Tip: highlight a line in the notes to ask about it.
                    </p>
                    <div className="mt-6 grid w-full gap-2">
                      {SUGGESTIONS.map((s, i) => (
                        <motion.button
                          key={s}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.05 * i + 0.1 }}
                          onClick={() => send(s)}
                          className="rounded-2xl border px-4 py-3 text-left text-sm transition-colors hover:bg-black/[0.03] dark:hover:bg-white/5"
                          style={{ borderColor: "var(--nt-border, #e5e7eb)" }}
                        >
                          {s}
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  <div className="space-y-6">
                    {messages.map((m, i) =>
                      m.role === "user" ? (
                        <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-end gap-1.5">
                          {m.quote && (
                            <p className="line-clamp-2 max-w-[85%] border-l-2 border-[#3168FF] pl-2.5 text-xs" style={{ color: "var(--nt-text-muted, #666)" }}>{m.quote}</p>
                          )}
                          <div className="max-w-[85%] whitespace-pre-wrap rounded-3xl px-4 py-2.5 text-[15px]" style={{ background: "var(--nt-surface-muted, #f2f2f2)" }}>
                            {m.content}
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                          <div className="relative mt-0.5 h-7 w-7 shrink-0">
                            {busy && i === messages.length - 1 && <span className="ai-ring absolute -inset-[3px] rounded-full" />}
                            <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#3168FF] to-[#7B4DFF] text-white">
                              <Sparkles className="h-3.5 w-3.5" />
                            </span>
                          </div>
                          <div className="min-w-0 flex-1 pt-0.5 text-[15px] leading-relaxed">
                            {m.content === "" ? (
                              <AnimatePresence mode="wait">
                                <motion.span key={tick % THINKING.length} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="ai-shimmer inline-block font-medium">
                                  {THINKING[tick % THINKING.length]}
                                </motion.span>
                              </AnimatePresence>
                            ) : (
                              <div className={`ai-md ${busy && i === messages.length - 1 ? "ai-caret" : ""}`}>
                                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                                  {m.content}
                                </ReactMarkdown>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      ),
                    )}
                  </div>
                )}
              </div>

              {/* Composer */}
              <div className="px-3 pb-3 pt-1 sm:px-4 sm:pb-4" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
                <AnimatePresence>
                  {selection && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-2 overflow-hidden">
                      <div className="flex items-start gap-2 rounded-2xl px-3 py-2 text-xs" style={{ background: "var(--nt-surface-muted, #f2f2f2)", color: "var(--nt-text-muted, #666)" }}>
                        <span className="mt-0.5 h-8 w-[3px] shrink-0 rounded-full bg-[#3168FF]" />
                        <span className="line-clamp-2 flex-1">{selection}</span>
                        <button onClick={() => setSelection("")} aria-label="Remove highlighted text"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <form
                  onSubmit={(e) => { e.preventDefault(); send(input); }}
                  className="flex items-end gap-2 rounded-[26px] border px-3 py-2 shadow-sm transition-shadow focus-within:border-[#3168FF]/60 focus-within:shadow-md"
                  style={{ borderColor: "var(--nt-border, #e5e7eb)", background: "var(--nt-surface, #fff)" }}
                >
                  <textarea
                    ref={inputRef}
                    value={input}
                    rows={1}
                    maxLength={1500}
                    onChange={(e) => {
                      setInput(e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(input); }
                    }}
                    placeholder={selection ? "What's confusing about this part?" : "Ask a doubt…"}
                    className="max-h-40 min-h-0 flex-1 resize-none bg-transparent px-1 py-1.5 text-base placeholder:opacity-60 sm:text-[15px]"
                    style={{ outline: "none" }}
                  />
                  {busy ? (
                    <button type="button" onClick={() => abortRef.current?.abort()} aria-label="Stop" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1A1D24] text-white dark:bg-white dark:text-[#1A1D24]">
                      <Square className="h-3.5 w-3.5 fill-current" />
                    </button>
                  ) : (
                    <button type="submit" disabled={!input.trim()} aria-label="Send" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#3168FF] to-[#7B4DFF] text-white transition-opacity disabled:opacity-30">
                      <ArrowUp className="h-[18px] w-[18px]" />
                    </button>
                  )}
                </form>
                <p className="mt-2 text-center text-[11px]" style={{ color: "var(--nt-text-muted, #888)" }}>
                  AI can make mistakes — check important points with your notes.
                </p>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
