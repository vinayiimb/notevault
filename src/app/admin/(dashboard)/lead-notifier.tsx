"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellSlash } from "@phosphor-icons/react";

type Item = { id: string; text: string };
const KEY = "nv_admin_pulse_since";
const MUTE = "nv_admin_pulse_mute";
const EVERY_MS = 15_000;

function beep() {
  try {
    const ctx = new AudioContext();
    [880, 1175].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      o.connect(g).connect(ctx.destination);
      g.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.16);
      o.start(ctx.currentTime + i * 0.18);
      o.stop(ctx.currentTime + i * 0.18 + 0.17);
    });
  } catch {}
}

// Polls /api/admin/pulse while any admin page is open: toast + chime + tab title + (if allowed) OS notification.
export function LeadNotifier() {
  const router = useRouter();
  const [toasts, setToasts] = useState<Item[]>([]);
  const [muted, setMuted] = useState(false);
  const [allowed, setAllowed] = useState(true); // false => show "Enable phone alerts"
  const mutedRef = useRef(false);
  const baseTitle = useRef("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the saved mute choice after hydration
    try { const m = localStorage.getItem(MUTE) === "1"; setMuted(m); mutedRef.current = m; } catch {}
    baseTitle.current = document.title;
    setAllowed("Notification" in window && Notification.permission === "granted");
  }, []);

  const poll = useCallback(async () => {
    let since = new Date().toISOString();
    try { since = localStorage.getItem(KEY) || since; } catch {}
    try {
      const res = await fetch(`/api/admin/pulse?since=${encodeURIComponent(since)}`, { cache: "no-store" });
      if (!res.ok) return;
      const d = await res.json();
      const items: Item[] = [
        ...d.leads.map((l: { id: string; phone: string; subject: string }) => ({ id: l.id, text: `New lead: ${l.subject} · +${l.phone}` })),
        ...d.orders.map((o: { id: string; phone: string; subject: string; amount: number }) => ({ id: o.id, text: `Paid ₹${o.amount}: ${o.subject} · +${o.phone}` })),
      ];
      const newest = [...d.leads.map((l: { createdAt: string }) => l.createdAt), ...d.orders.map((o: { paidAt: string }) => o.paidAt)].sort().pop();
      try { localStorage.setItem(KEY, newest ?? since); } catch {}
      if (!items.length) return;
      setToasts((t) => [...t, ...items].slice(-5));
      if (!mutedRef.current) beep();
      document.title = `(${items.length}) ${items[0].text}`;
      if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
        new Notification("NoteVault", { body: items[0].text });
      }
      router.refresh(); // updates the sidebar badge + leads list
    } catch {}
  }, [router]);

  useEffect(() => {
    try { if (!localStorage.getItem(KEY)) localStorage.setItem(KEY, new Date().toISOString()); } catch {}
    const t = setInterval(poll, EVERY_MS);
    const onVis = () => { if (!document.hidden && baseTitle.current) document.title = baseTitle.current; };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [poll]);

  // Phone push: register the service worker and send the subscription to the server (needs a tap).
  async function enablePush() {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
      if ((await Notification.requestPermission()) !== "granted") return;
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const { key } = await (await fetch("/api/admin/push")).json();
      const pad = "=".repeat((4 - (key.length % 4)) % 4);
      const raw = atob((key + pad).replace(/-/g, "+").replace(/_/g, "/"));
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(raw, (c) => c.charCodeAt(0)) }));
      setAllowed(true);
      await fetch("/api/admin/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON(), test: true }) });
    } catch {}
  }

  function toggle() {
    if (!allowed) { beep(); void enablePush(); return; }
    const m = !muted;
    setMuted(m); mutedRef.current = m;
    try { localStorage.setItem(MUTE, m ? "1" : "0"); } catch {}
    if (!m) {
      beep(); // also unlocks audio after a user gesture
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-label={muted ? "Turn lead alerts on" : "Mute lead alerts"}
        title={muted ? "Lead alerts muted — tap to turn on" : "Lead alerts on — tap to mute"}
        className={`fixed bottom-4 left-4 z-40 flex h-10 items-center justify-center gap-2 rounded-full border border-border bg-surface text-sm font-medium text-foreground/80 shadow-md ${allowed ? "w-10" : "px-4"}`}
      >
        {muted ? <BellSlash size={18} /> : <Bell size={18} weight="fill" />}
        {!allowed && <span>Enable phone alerts</span>}
      </button>
      <div className="fixed inset-x-3 top-3 z-50 flex flex-col gap-2 sm:left-auto sm:right-4 sm:w-80">
        {toasts.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setToasts((x) => x.filter((i) => i.id !== t.id)); router.push("/admin/leads"); }}
            className="rounded-xl border border-border bg-surface px-4 py-3 text-left text-sm font-medium shadow-lg"
          >
            {t.text}
          </button>
        ))}
      </div>
    </>
  );
}
