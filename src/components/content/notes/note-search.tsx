"use client";

import { useEffect, useRef, useState } from "react";
import { CaretDown, CaretUp, MagnifyingGlass, X } from "@phosphor-icons/react";

const HIGHLIGHT_CLASS = "nt-search-hit";
const ACTIVE_CLASS = "nt-search-hit-active";

// Walks the rendered note's text nodes and wraps every match in <mark>,
// rather than a virtual/React-level search — the content itself came from
// arbitrary sanitized Markdown+HTML, so there's no single structured place
// to search except the DOM it actually rendered into.
function highlightMatches(root: HTMLElement, query: string): HTMLElement[] {
  clearHighlights(root);
  if (!query.trim()) return [];

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.parentElement?.closest("script,style") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });

  const targets: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) targets.push(node as Text);

  const lowerQuery = query.toLowerCase();
  const hits: HTMLElement[] = [];

  for (const textNode of targets) {
    const text = textNode.textContent ?? "";
    const lower = text.toLowerCase();
    if (!lower.includes(lowerQuery)) continue;

    const frag = document.createDocumentFragment();
    let cursor = 0;
    let idx = lower.indexOf(lowerQuery);
    while (idx !== -1) {
      frag.appendChild(document.createTextNode(text.slice(cursor, idx)));
      const mark = document.createElement("mark");
      mark.className = HIGHLIGHT_CLASS;
      mark.textContent = text.slice(idx, idx + query.length);
      frag.appendChild(mark);
      hits.push(mark);
      cursor = idx + query.length;
      idx = lower.indexOf(lowerQuery, cursor);
    }
    frag.appendChild(document.createTextNode(text.slice(cursor)));
    textNode.parentNode?.replaceChild(frag, textNode);
  }

  return hits;
}

function clearHighlights(root: HTMLElement) {
  root.querySelectorAll(`mark.${HIGHLIGHT_CLASS}`).forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    parent.replaceChild(document.createTextNode(mark.textContent ?? ""), mark);
    parent.normalize();
  });
}

export function ContentSearch({ targetId }: { targetId: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const hitsRef = useRef<HTMLElement[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Resets the active match index whenever the query changes, without a
  // setState call inside the DOM-mutation effect below — adjusting state
  // during rendering (rather than in an effect) when a dependency changes
  // between renders is the pattern React itself recommends for this exact
  // "reset on prop/state change" case.
  const [queryForReset, setQueryForReset] = useState(query);
  if (query !== queryForReset) {
    setQueryForReset(query);
    setActiveIndex(0);
  }

  useEffect(() => {
    const root = document.getElementById(targetId);
    if (!root) return;
    hitsRef.current = highlightMatches(root, query);
    if (hitsRef.current[0]) focusHit(hitsRef.current, 0);
    return () => clearHighlights(root);
  }, [query, targetId]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function focusHit(hits: HTMLElement[], index: number) {
    hits.forEach((h) => h.classList.remove(ACTIVE_CLASS));
    const hit = hits[index];
    if (!hit) return;
    hit.classList.add(ACTIVE_CLASS);
    hit.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function go(delta: number) {
    const hits = hitsRef.current;
    if (hits.length === 0) return;
    const next = (activeIndex + delta + hits.length) % hits.length;
    setActiveIndex(next);
    focusHit(hits, next);
  }

  function close() {
    setOpen(false);
    setQuery("");
  }

  if (!open) {
    return (
      <button type="button" className="nt-btn nt-btn-ghost" onClick={() => setOpen(true)} aria-label="Search this note">
        <MagnifyingGlass size={16} weight="bold" />
        <span className="hidden sm:inline">Search</span>
      </button>
    );
  }

  return (
    <div className="nt-glass flex items-center gap-1.5 rounded-xl px-2 py-1" style={{ boxShadow: "var(--nt-shadow)" }}>
      <MagnifyingGlass size={15} style={{ color: "var(--nt-text-muted)" }} />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") go(e.shiftKey ? -1 : 1);
          if (e.key === "Escape") close();
        }}
        placeholder="Search this note…"
        className="w-36 bg-transparent text-sm outline-none sm:w-48"
        style={{ color: "var(--nt-text)" }}
      />
      {hitsRef.current.length > 0 && (
        <span className="text-xs whitespace-nowrap" style={{ color: "var(--nt-text-muted)" }}>
          {activeIndex + 1}/{hitsRef.current.length}
        </span>
      )}
      <button type="button" onClick={() => go(-1)} aria-label="Previous match" className="nt-btn nt-btn-ghost !p-1">
        <CaretUp size={13} weight="bold" />
      </button>
      <button type="button" onClick={() => go(1)} aria-label="Next match" className="nt-btn nt-btn-ghost !p-1">
        <CaretDown size={13} weight="bold" />
      </button>
      <button type="button" onClick={close} aria-label="Close search" className="nt-btn nt-btn-ghost !p-1">
        <X size={13} weight="bold" />
      </button>
    </div>
  );
}
