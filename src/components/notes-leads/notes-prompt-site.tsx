"use client";

import { usePathname } from "next/navigation";
import { NotesPrompt } from "./notes-prompt";

// Pages where a sales pop-up would be in the way: signing in, paying, the student's own dashboard, legal text.
const QUIET = ["/account", "/dashboard", "/login", "/paid-notes", "/chat-pay", "/refund-policy", "/terms", "/terms-of-service", "/privacy-policy"];

/**
 * The "Do you need Most Repeated Questions + PYQ Solutions?" pop-up for every public page. Mounted once in the site layout.
 * A page that has its own, more specific prompt (a PYQ page that knows its subject) keeps it: this one stays quiet there.
 */
export function NotesPromptSite() {
  const pathname = usePathname();
  const quiet = QUIET.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  return <NotesPrompt source="site" auto={!quiet} />;
}
