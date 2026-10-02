import type { Metadata } from "next";
import Link from "next/link";
import { HELPDESK_DISPLAY, HELPDESK_WHATSAPP, LegalPage, Section } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy",
  description: "When DU PYQ Online refunds paid notes, and how to request one.",
  alternates: { canonical: "/refund-policy" },
};

export default function RefundPolicyPage() {
  return (
    <LegalPage
      title="Refund & Cancellation Policy"
      intro="Try before you buy: every subject has a free preview (about the first 30% of the notes), and all question papers are free. Please read the preview before purchasing."
    >
      <Section title="Cancellation">
        <p>
          Paid notes are digital content. Once your payment is verified and the notes are unlocked on your account, the order
          is complete and can&apos;t be cancelled. If you change your mind <strong>before</strong> we verify your payment, message us
          with your UTR and we&apos;ll cancel the order and refund you in full.
        </p>
      </Section>

      <Section title="No refunds after access">
        <p>
          Because the full notes are available to you as soon as access is granted, we don&apos;t offer refunds after that point —
          including for change of mind or not needing the subject any more. The free preview is there so you can decide first.
        </p>
      </Section>

      <Section title="When we always refund">
        <ul>
          <li><strong>Double payment</strong> — you paid twice for the same order. We refund the extra payment.</li>
          <li><strong>Overpayment</strong> — you paid more than the order total. We refund the difference.</li>
          <li><strong>Access not given</strong> — your payment is verified as received but we haven&apos;t unlocked your notes within 3 days. You can choose a full refund or immediate access.</li>
          <li><strong>Order cancelled by us</strong> — for example if a subject can&apos;t be delivered. Full refund.</li>
        </ul>
        <p>
          If you paid <strong>less</strong> than the order total, we&apos;ll ask you to pay the difference or refund what you paid —
          your choice.
        </p>
      </Section>

      <Section title="How to request a refund">
        <p>
          Message our helpdesk on WhatsApp at{" "}
          <a href={HELPDESK_WHATSAPP} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">{HELPDESK_DISPLAY}</a>{" "}
          with:
        </p>
        <ul>
          <li>the email you used at checkout,</li>
          <li>the UTR / UPI reference number of the payment, and</li>
          <li>a short note on what went wrong (a payment screenshot helps).</li>
        </ul>
        <p>
          We check every request against our payment records and reply within 2 working days. Approved refunds are sent back by
          UPI to the account you paid from, usually within 5–7 working days. Your bank may take a little longer to show it.
        </p>
      </Section>

      <Section title="Misuse">
        <p>
          Accounts closed for sharing, reselling or other misuse under our{" "}
          <Link href="/terms-of-service" className="text-brand hover:underline">Terms of Service</Link> are not eligible for a refund.
        </p>
      </Section>
    </LegalPage>
  );
}
