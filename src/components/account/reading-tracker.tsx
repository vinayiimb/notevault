"use client";

import { useEffect } from "react";

// Counts the seconds a student really spends reading a note — tab visible AND
// some scroll/tap/key in the last minute — and sends them to /api/student-activity
// in one batch about every minute (and when the tab is hidden or closed).
const TICK_MS = 5_000;
const FLUSH_AT_S = 60;
const IDLE_MS = 60_000;

export function ReadingTracker({ itemKey }: { itemKey: string }) {
  useEffect(() => {
    let pending = 0;
    let opened = true;
    let lastInput = Date.now();
    let maxScroll = 0;
    let sentScroll = 0;

    const send = (useBeacon: boolean) => {
      if (pending <= 0 && !opened && maxScroll <= sentScroll) return;
      const body = JSON.stringify({ key: itemKey, seconds: pending, opened, scroll: maxScroll });
      pending = 0;
      opened = false;
      sentScroll = maxScroll;
      if (useBeacon && navigator.sendBeacon) navigator.sendBeacon("/api/student-activity", new Blob([body], { type: "application/json" }));
      else fetch("/api/student-activity", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    };

    const touch = () => {
      lastInput = Date.now();
      const el = document.documentElement;
      const total = el.scrollHeight - window.innerHeight;
      if (total > 0) maxScroll = Math.max(maxScroll, Math.min(100, Math.round(((window.scrollY || el.scrollTop) / total) * 100)));
    };
    const onHide = () => { if (document.visibilityState === "hidden") send(true); };
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && Date.now() - lastInput < IDLE_MS) pending += TICK_MS / 1000;
      if (pending >= FLUSH_AT_S) send(false);
    }, TICK_MS);

    const events = ["scroll", "pointerdown", "keydown", "touchmove", "wheel"] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide as () => void);
    send(false); // counts the open straight away

    return () => {
      clearInterval(timer);
      events.forEach((e) => window.removeEventListener(e, touch));
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide as () => void);
      send(true);
    };
  }, [itemKey]);

  return null;
}
