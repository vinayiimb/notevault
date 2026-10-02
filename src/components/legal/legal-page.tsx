import Link from "next/link";

// Shared shell for /terms-of-service, /privacy-policy and /refund-policy.
export const LEGAL_UPDATED = "2 October 2026";
export const HELPDESK_WHATSAPP = "https://wa.me/919376180015";
export const HELPDESK_DISPLAY = "+91 93761 80015";

const LEGAL_LINKS = [
  { href: "/terms-of-service", label: "Terms" },
  { href: "/privacy-policy", label: "Privacy" },
  { href: "/refund-policy", label: "Refund" },
];

export function LegalPage({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <nav className="flex gap-4 text-sm" aria-label="Policies">
        {LEGAL_LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="text-muted hover:text-brand">{l.label}</Link>
        ))}
      </nav>
      <h1 className="mt-6 font-display text-4xl font-bold tracking-[-0.03em] sm:text-5xl">{title}</h1>
      <p className="mt-4 text-pretty text-base leading-relaxed text-muted">{intro}</p>
      <p className="mt-2 text-xs text-muted">Last updated: {LEGAL_UPDATED}</p>
      <div className="mt-10 flex flex-col gap-8 text-[15px] leading-relaxed text-foreground/85 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-foreground [&_li]:mt-1.5 [&_p]:mt-2 [&_strong]:text-foreground [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
      <p className="mt-12 border-t border-border pt-6 text-sm text-muted">
        Questions? Message our helpdesk on WhatsApp at{" "}
        <a href={HELPDESK_WHATSAPP} target="_blank" rel="noopener noreferrer" className="font-medium text-brand hover:underline">
          {HELPDESK_DISPLAY}
        </a>{" "}
        or use the <Link href="/feedback" className="font-medium text-brand hover:underline">feedback form</Link>.
      </p>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
