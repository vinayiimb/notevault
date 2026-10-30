"use client";

import { useEffect, useRef, useState } from "react";
import { MascotArt } from "@/components/landing/mascot";

const TAP_LINES = ["Hi! 👋", "Keep scrolling, there's more.", "You've got this exam.", "Wheee!"];
const CONTENT_W = 1152; // max-w-6xl — the parrot flies in the margins beside it when they're wide enough

// Homepage companion. Once the peeking parrot (#homeId) scrolls off the
// top it takes off and flies alongside the page: wings flap while you
// scroll, it leans with scroll speed, and at every [data-mascot-say] section
// it crosses to the other side and says that section's line. On narrow
// screens it tucks half off the edge when you stop scrolling so it never
// sits on top of text. Scroll back up and it flies home.
export function FlyingMascot({ homeId }: { homeId: string }) {
  const tiltRef = useRef<HTMLSpanElement>(null);
  const [vw, setVw] = useState(0);
  const [vh, setVh] = useState(0);
  const [active, setActive] = useState(false);
  const [section, setSection] = useState(-1);
  const [say, setSay] = useState<string | null>(null);
  const [scrolling, setScrolling] = useState(false);
  const [hop, setHop] = useState(0);

  useEffect(() => {
    const home = document.getElementById(homeId);
    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-mascot-say]"));
    let lastY = window.scrollY;
    let tilt = 0;
    let target = 0;
    let idle = 0;
    let sayTimer = 0;
    let frame = 0;
    let current = -1;

    const size = () => {
      setVw(window.innerWidth);
      setVh(window.innerHeight);
    };
    size();

    const io = home
      ? new IntersectionObserver(([e]) => setActive(!e.isIntersecting && e.boundingClientRect.top < 0))
      : null;
    if (home) io!.observe(home);

    function onScroll() {
      const y = window.scrollY;
      target = Math.max(-14, Math.min(14, (y - lastY) * 0.8));
      lastY = y;
      setScrolling(true);
      clearTimeout(idle);
      idle = window.setTimeout(() => {
        setScrolling(false);
        target = 0;
      }, 900);

      let i = -1;
      for (const s of sections) if (s.getBoundingClientRect().top < window.innerHeight * 0.55) i++;
      if (i !== current) {
        current = i;
        setSection(i);
        clearTimeout(sayTimer);
        setSay(i >= 0 ? sections[i].dataset.mascotSay ?? null : null);
        sayTimer = window.setTimeout(() => setSay(null), 3600);
      }
    }

    // Ease the lean toward the scroll speed, and back upright when idle.
    function loop() {
      tilt += (target - tilt) * 0.12;
      if (tiltRef.current) tiltRef.current.style.transform = `rotate(${tilt.toFixed(2)}deg)`;
      frame = requestAnimationFrame(loop);
    }
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) frame = requestAnimationFrame(loop);

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", size);
    return () => {
      io?.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", size);
      cancelAnimationFrame(frame);
      clearTimeout(idle);
      clearTimeout(sayTimer);
    };
  }, [homeId]);

  if (!vw) return null;

  const px = vw >= 1024 ? 96 : 64;
  const gutter = (vw - CONTENT_W) / 2;
  const roomy = gutter >= px + 16;
  const right = section % 2 === 0; // first section on the right, then alternate
  const tucked = !roomy && !scrolling && !say;
  const inset = roomy ? (gutter - px) / 2 : 8;
  const x = right ? (tucked ? vw - px * 0.45 : vw - px - inset) : tucked ? -px * 0.55 : inset;
  const y = active ? (roomy ? vh * 0.42 : vh - px - 100) : -px - 80;

  function poke() {
    setHop((h) => h + 1);
    setSay(TAP_LINES[Math.floor(Math.random() * TAP_LINES.length)]);
  }

  return (
    <div
      aria-hidden={!active}
      className="mascot-fly pointer-events-none fixed left-0 top-0 z-30 print:hidden"
      style={{ width: px, transform: `translate3d(${x}px, ${y}px, 0)`, opacity: active ? 1 : 0 }}
    >
      {say && !tucked && (
        <p
          key={say}
          aria-live="polite"
          className={`mascot-bubble absolute bottom-full mb-2 w-max max-w-[220px] rounded-2xl bg-surface px-3.5 py-2 text-[13px] font-medium leading-snug text-foreground shadow-[var(--shadow-tile-hover)] ${
            right ? "right-0" : "left-0"
          }`}
        >
          {say}
          <span
            aria-hidden="true"
            className={`absolute -bottom-1.5 size-3 rotate-45 rounded-[2px] bg-surface ${right ? "right-8" : "left-8"}`}
          />
        </p>
      )}
      <button
        type="button"
        tabIndex={active ? 0 : -1}
        onClick={poke}
        aria-label="Say hi to the DU PYQ parrot"
        className={`block w-full cursor-pointer ${active ? "pointer-events-auto" : ""}`}
      >
        {/* Facing: arm (on the art's left) points toward the page content. */}
        <span className="block transition-transform duration-300" style={{ transform: `scaleX(${right ? 1 : -1})` }}>
          <span key={section} className={`block ${section >= 0 ? "mascot-arc" : ""}`}>
            <span key={hop} className={`block ${hop ? "mascot-hop" : ""}`}>
              <span ref={tiltRef} className="block">
                <span className={`block ${scrolling ? "mascot-flap" : "mascot-bob"}`}>
                  {/* The art is a bust, so it rides a cloud that hides the flat bottom edge. */}
                  <span className="relative block drop-shadow-[0_10px_14px_rgba(0,40,90,0.18)]">
                    <MascotArt />
                    <svg
                      viewBox="0 0 120 50"
                      aria-hidden="true"
                      className="absolute -left-[12%] w-[124%] fill-white"
                      style={{ bottom: -px * 0.2 }}
                    >
                      <path d="M20 46C8 46 2 38 6 30c3-7 11-9 16-7 2-10 12-15 22-12 6-8 20-9 27-1 8-4 19-1 22 8 10-1 20 7 19 16-1 8-8 12-16 12Z" />
                    </svg>
                  </span>
                </span>
              </span>
            </span>
          </span>
        </span>
      </button>
    </div>
  );
}
