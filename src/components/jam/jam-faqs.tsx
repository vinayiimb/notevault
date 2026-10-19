import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import { faqJsonLd, type Faq } from "@/lib/seo";

/** Two-column FAQ accordion with matching FAQPage JSON-LD. */
export function JamFaqs({ faqs }: { faqs: Faq[] }) {
  return (
    <section className="border-t border-border pt-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(faqs)) }} />
      <h2 className="mb-4 text-xl font-semibold text-foreground">FAQs</h2>
      <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2">
        {faqs.map((f) => (
          <details key={f.q} className="group rounded-xl border border-border bg-surface px-4 py-3">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-[15px] font-medium text-foreground">
              {f.q}
              <CaretDown size={16} className="mt-1 shrink-0 text-muted transition group-open:rotate-180" />
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-muted">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
