import { faqJsonLd, type Faq } from "@/lib/seo";

/** Visible FAQ + matching FAQPage JSON-LD (the text must match what users see). */
export function FaqBlock({ faqs, title = "Frequently asked questions" }: { faqs: Faq[]; title?: string }) {
  if (faqs.length === 0) return null;
  return (
    <section className="mt-14 border-t border-border pt-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(faqs)) }} />
      <h2 className="mb-4 text-xl font-bold text-foreground">{title}</h2>
      <dl className="space-y-4">
        {faqs.map((f) => (
          <div key={f.q}>
            <dt className="font-semibold text-foreground">{f.q}</dt>
            <dd className="mt-1 text-sm text-muted">{f.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
