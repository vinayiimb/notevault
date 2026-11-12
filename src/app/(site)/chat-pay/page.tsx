export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import Link from "next/link";
import { findCanonicalProgramme, findCanonicalSubject } from "@/lib/canonical-subject-notes-data";
import { notesOrdersReady } from "@/lib/notes-orders-server";
import { CHAT_ORDER, parseOrderPlan } from "@/lib/notes-orders";
import { parseLeadSemester } from "@/lib/note-leads";
import { ChatPay } from "@/components/notes-leads/chat-pay";

export const metadata: Metadata = { title: "Pay for your notes", robots: { index: false, follow: false } };

type SP = { plan?: string; p?: string; s?: string; sub?: string };

/**
 * Where the payment card in the live chat sends a student. The link only says WHAT they want (course,
 * semester, subject, plan), never who they are: they type their WhatsApp number here, and the usual
 * checkout (server-decided price, Razorpay, notes on WhatsApp) takes over.
 */
export default async function ChatPayPage({ searchParams }: { searchParams: Promise<SP> }) {
  const { plan: planIn, p, s, sub } = await searchParams;
  const plan = parseOrderPlan(planIn);
  const semester = parseLeadSemester(s);
  const programme = p ? await findCanonicalProgramme(p) : null;
  const found = plan === "subject" && programme && sub ? await findCanonicalSubject(programme.slug, sub) : null;
  const generic = !!plan && !p && !s && !sub; // pay-first link from the chat: no course named

  if (!plan || (!generic && (!semester || !programme || (plan === "subject" && !found)))) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-[24px] font-semibold tracking-[-0.025em]">This payment link isn&apos;t valid</h1>
        <p className="mt-2 text-[15px] text-muted">Go back to the chat and tap Pay again, or pick your notes from the site.</p>
        <Link href="/notes" className="mt-6 inline-flex h-11 items-center rounded-full bg-brand px-6 text-[15px] font-semibold text-brand-foreground">
          Browse notes
        </Link>
      </div>
    );
  }

  const canBuy = await notesOrdersReady().catch(() => false);
  return (
    <div className="flex-1 bg-surface-muted/60 px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-md rounded-[28px] bg-surface p-5 shadow-xl sm:p-7">
        <ChatPay
          programme={generic ? { slug: CHAT_ORDER.programmeSlug, name: CHAT_ORDER.programme } : { slug: programme!.slug, name: programme!.name }}
          semester={generic ? 0 : semester!}
          plan={plan}
          subject={generic ? (plan === "semester" ? null : { slug: CHAT_ORDER.subjectSlug, name: CHAT_ORDER.subject }) : found ? { slug: sub!, name: found.subject } : null}
          canBuy={canBuy}
        />
      </div>
    </div>
  );
}
