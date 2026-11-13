"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Thin top progress bar for slow page opens. Starts on any same-site link click,
 * creeps toward 90%, and finishes when the URL changes. No dependency.
 */
export function RouteProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [pct, setPct] = useState(0); // 0 = hidden
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return; // hash / same page
      stop();
      setPct(8);
      // ponytail: fake easing (never reaches 100 until the route really changes)
      timer.current = setInterval(() => setPct((p) => p + (90 - p) * 0.06), 300);
      // some links open a popup instead of navigating (Next Links also preventDefault, so that can't tell them apart)
      setTimeout(() => {
        if (document.querySelector('[role="dialog"]')) {
          stop();
          setPct(0);
        }
      }, 500);
    };
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      stop();
    };
  }, []);

  // URL changed → navigation finished
  useEffect(() => {
    stop();
    setPct((p) => (p ? 100 : 0));
    const t = setTimeout(() => setPct(0), 250);
    return () => clearTimeout(t);
  }, [pathname, search]);

  if (!pct) return null;
  return (
    <div
      role="progressbar"
      aria-label="Opening page"
      className="pointer-events-none fixed inset-x-0 top-0 z-[9999] h-[3px]"
    >
      <div
        className="h-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,.6)] transition-[width] duration-300 ease-out"
        style={{ width: `${pct}%`, opacity: pct >= 100 ? 0 : 1 }}
      />
    </div>
  );
}
