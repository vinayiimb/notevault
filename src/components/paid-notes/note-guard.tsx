"use client";

import { useEffect } from "react";

// Best-effort copy protection for paid notes (the free preview and the student reader; never admins).
// A browser can't truly block a screenshot, so this does what a web page can:
//  - printing: CSS hides the whole page for @media print (covers Ctrl/Cmd+P, the browser menu and "Save as PDF"), and the
//    shortcut itself is swallowed (also Ctrl/Cmd+S);
//  - screenshots: PrintScreen and the Mac Cmd+Shift+3/4/5 shortcuts hide the page and empty the clipboard; the page also
//    hides whenever the window loses focus or the tab is hidden (snipping tools and screen recorders take focus);
//  - text selection, long-press save, right-click and drag are switched off.
// A phone's hardware screenshot or a second camera can't be detected from a web page.
// The CSS lives in notes-content.css under `html[data-note-guard]`.
export function NoteGuard() {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.noteGuard = "on";

    let flashTimer: ReturnType<typeof setTimeout> | undefined;
    const hide = () => root.setAttribute("data-note-hidden", "");
    const show = () => root.removeAttribute("data-note-hidden");
    const flash = () => {
      hide();
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => (document.hasFocus() && !document.hidden ? show() : undefined), 1500);
    };
    const clearClipboard = () => navigator.clipboard?.writeText(" ").catch(() => {});

    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && (key === "p" || key === "s")) {
        e.preventDefault();
        e.stopPropagation();
        flash();
      } else if (e.key === "PrintScreen" || (e.metaKey && e.shiftKey && ["Digit3", "Digit4", "Digit5"].includes(e.code))) {
        flash();
        clearClipboard();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen") clearClipboard();
    };
    // Focus moving into an iframe (an HTML note) also blurs the window; that is not a reason to hide.
    const onBlur = () => setTimeout(() => (document.activeElement?.tagName === "IFRAME" ? show() : hide()), 0);
    const onVisibility = () => (document.hidden ? hide() : document.hasFocus() && show());
    const stop = (e: Event) => e.preventDefault();
    const stopCopy = (e: Event) => (e.target instanceof HTMLElement && e.target.closest("input, textarea") ? undefined : e.preventDefault());

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", show);
    window.addEventListener("beforeprint", hide);
    window.addEventListener("afterprint", show);
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("contextmenu", stop);
    document.addEventListener("dragstart", stop);
    document.addEventListener("copy", stopCopy);
    document.addEventListener("cut", stopCopy);

    return () => {
      clearTimeout(flashTimer);
      delete root.dataset.noteGuard;
      show();
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", show);
      window.removeEventListener("beforeprint", hide);
      window.removeEventListener("afterprint", show);
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("contextmenu", stop);
      document.removeEventListener("dragstart", stop);
      document.removeEventListener("copy", stopCopy);
      document.removeEventListener("cut", stopCopy);
    };
  }, []);

  return null;
}
