"use client";

import { useEffect, useState } from "react";
import { ListBullets } from "@phosphor-icons/react";

// With the contents at the top of the note, a student 40 screens down needs a way back. This pill appears once the
// contents have scrolled out above the screen and jumps back to them.
export function IndexJump({ targetId }: { targetId: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = document.getElementById(targetId);
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setShow(!entry.isIntersecting && entry.boundingClientRect.top < 0));
    observer.observe(el);
    return () => observer.disconnect();
  }, [targetId]);

  if (!show) return null;
  return (
    <a href={`#${targetId}`} className="nt-jump nt-no-print">
      <ListBullets size={16} weight="bold" aria-hidden />
      Index
    </a>
  );
}
