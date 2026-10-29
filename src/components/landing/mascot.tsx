"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

// The DU PYQ parrot, cut out of /logo.png by scripts/brand/cut-mascot.py.
// The image is a bust (flat bottom edge), so place it peeking over the top
// of something that covers its lower edge. Eyelid boxes are measured on the
// 480×435 cut-out; re-measure them if the artwork changes.
const LIDS = [
  { left: "34.4%", top: "47%", width: "6.8%", height: "12.8%" },
  { left: "63.9%", top: "47.2%", width: "7.2%", height: "12.8%" },
];

/** The parrot itself: waves every few seconds and blinks. */
export function MascotArt({ priority = false }: { priority?: boolean }) {
  return (
    <span className="mascot-wave relative block">
      <Image src="/mascot.webp" alt="" width={480} height={435} priority={priority} className="block h-auto w-full" />
      {LIDS.map((lid, i) => (
        <span key={i} aria-hidden="true" className="mascot-lid absolute rounded-full bg-[#ebfdb7]" style={lid} />
      ))}
    </span>
  );
}

export function Mascot({
  tips,
  id,
  className = "",
  bubbleClassName = "",
}: {
  tips: string[];
  id?: string;
  className?: string;
  bubbleClassName?: string;
}) {
  const [tip, setTip] = useState(0);
  const [hop, setHop] = useState(0);

  useEffect(() => {
    if (tips.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setTip((t) => (t + 1) % tips.length), 4800);
    return () => clearInterval(id);
  }, [tips.length]);

  function poke() {
    setHop((h) => h + 1);
    setTip((t) => (t + 1) % tips.length);
  }

  return (
    <div id={id} className={`pointer-events-none select-none ${className}`}>
      <p
        key={tip}
        aria-live="polite"
        className={`mascot-bubble absolute rounded-2xl bg-surface px-3.5 py-2 text-[13px] font-medium leading-snug text-foreground shadow-[var(--shadow-tile)] ${bubbleClassName}`}
      >
        {tips[tip]}
        <span aria-hidden="true" className="absolute -right-1.5 top-4 size-3 rotate-45 rounded-[2px] bg-surface" />
      </p>
      <button
        type="button"
        onClick={poke}
        onMouseEnter={() => setHop((h) => h + 1)}
        aria-label="Say hi to the DU PYQ parrot"
        className="pointer-events-auto block w-full cursor-pointer"
      >
        <span className="mascot-bob block">
          <span key={hop} className={`block ${hop ? "mascot-hop" : ""}`}>
            <MascotArt />
          </span>
        </span>
      </button>
    </div>
  );
}
