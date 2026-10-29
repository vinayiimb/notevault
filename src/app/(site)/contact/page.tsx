import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "@/components/legal/info-page";
import { HELPDESK_DISPLAY, HELPDESK_WHATSAPP, Section } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Contact Helpdesk: Report a Missing DU Paper",
  description:
    "Reach the DU PYQ Online helpdesk on WhatsApp, report a wrong or missing question paper, get help with a notes purchase, or request a paper we don't have yet.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <InfoPage
      title="Contact"
      intro="The quickest way to reach us is WhatsApp. For paper requests and corrections, the feedback form also works."
    >
      <Section title="WhatsApp helpdesk">
        <p>
          Message us at{" "}
          <a href={HELPDESK_WHATSAPP} target="_blank" rel="noopener noreferrer" className="font-medium text-brand hover:underline">
            {HELPDESK_DISPLAY}
          </a>
          . This is the number to use for questions about your account, a notes purchase or a payment.
        </p>
      </Section>

      <Section title="Report a wrong or missing paper">
        <p>Use the <Link href="/feedback" className="text-brand hover:underline">feedback &amp; requests form</Link>, or message us on WhatsApp, and include:</p>
        <ul>
          <li>the link to the page on dupyq.online;</li>
          <li>the Unique Paper Code (the 10-digit number printed on the paper) and the year or exam session;</li>
          <li>what is wrong (wrong subject, wrong year, broken PDF, garbled question text) or which paper you are looking for.</li>
        </ul>
      </Section>

      <Section title="Notes purchases and payments">
        <p>
          Send the email you signed in with and the UTR / UPI reference number of the payment. The{" "}
          <Link href="/refund-policy" className="text-brand hover:underline">refund policy</Link> explains when refunds apply.
        </p>
      </Section>

      <Section title="Copyright and takedown">
        <p>
          The papers are the University&apos;s published question papers. If you own material on this site and want it
          removed or credited differently, message us with the page link and we will respond.
        </p>
      </Section>

      <Section title="Linking to us">
        <p>
          Running a DU society, college page, Telegram or WhatsApp group, or a student blog? See{" "}
          <Link href="/link-to-us" className="text-brand hover:underline">Link to us</Link> for link text and short
          descriptions you can copy.
        </p>
      </Section>
    </InfoPage>
  );
}
