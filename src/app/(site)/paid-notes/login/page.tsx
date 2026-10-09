import { redirect } from "next/navigation";

// Old sign-in URL (already sent in WhatsApp messages) — now /login.
export default async function OldPaidNotesLogin({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
}
