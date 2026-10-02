import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, Section } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms for using DU PYQ Online — free question papers and paid subject notes.",
  alternates: { canonical: "/terms-of-service" },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro="Please read these terms carefully. By using DU PYQ Online (dupyq.online) or buying notes from us, you agree to them."
    >
      <Section title="Overview">
        <p>
          DU PYQ Online is an independent study platform for Delhi University students. In these terms, &ldquo;we&rdquo;,
          &ldquo;us&rdquo; and &ldquo;our&rdquo; mean DU PYQ Online, and &ldquo;you&rdquo; means anyone who visits the site or buys from us.
        </p>
        <p>
          <strong>We are not affiliated with, endorsed by, or connected to the University of Delhi.</strong> Question papers are
          shared for students&apos; exam preparation; for official information always check du.ac.in.
        </p>
        <p>
          We may add features or update these terms at any time by posting the new version on this page. Continuing to use the
          site after a change means you accept it.
        </p>
      </Section>

      <Section title="What's free and what's paid">
        <ul>
          <li><strong>Free:</strong> all previous year question papers, and a free preview (about the first 30%) of every subject&apos;s notes.</li>
          <li>
            <strong>Paid:</strong> complete subject notes — the full notes, worked answers, diagrams and PDF download — sold per
            subject or in packs, as listed on our <Link href="/paid-notes" className="text-brand hover:underline">pricing page</Link>.
          </li>
          <li>Paid notes are digital content for online reading and personal PDF download. Nothing physical is shipped.</li>
        </ul>
      </Section>

      <Section title="Eligibility">
        <p>
          Anyone can use DU PYQ Online. If you are under 18, you need a parent&apos;s or guardian&apos;s permission to buy notes. You
          may not use the site for anything illegal, and you must not upload or send viruses or any code that could harm the site.
        </p>
      </Section>

      <Section title="Accounts">
        <ul>
          <li>Paid notes are unlocked on an account tied to your Gmail address. You sign in with Google, or with the login we send you on WhatsApp after your payment is verified.</li>
          <li><strong>One student per account.</strong> Don&apos;t share your login or let others use your account.</li>
          <li>Keep your login safe. You are responsible for activity on your account.</li>
          <li>Give us your real email and WhatsApp number at checkout — that&apos;s how we reach you about your purchase.</li>
        </ul>
      </Section>

      <Section title="Payments">
        <ul>
          <li>Payments are made by UPI to the UPI ID or QR code shown at checkout. After paying, you submit the UTR (UPI reference number) so we can match your payment.</li>
          <li>Access is activated after we verify your payment, usually within a few hours.</li>
          <li><strong>We will never ask for your card details, bank password, OTP or UPI PIN.</strong> Only pay through the checkout on dupyq.online — payments made through anyone else are not valid.</li>
          <li>Prices are in Indian Rupees and may change at any time. A price change never affects a purchase you have already paid for.</li>
          <li>We may refuse or cancel an order — for example if a payment can&apos;t be verified. If you paid for an order we cancel, you get a full refund.</li>
        </ul>
      </Section>

      <Section title="Your access">
        <p>
          Purchased subjects stay unlocked on your account for as long as DU PYQ Online offers them — there is no subscription and
          no expiry date. If we ever stop offering paid notes, we will give notice on the site first. We may update or improve
          notes over time; your access always covers the current version.
        </p>
      </Section>

      <Section title="Fair use of notes">
        <p>Our notes are our own work. You may read them and download PDFs for your personal study. You may not:</p>
        <ul>
          <li>share, sell, resell or publish our paid notes or PDFs — on WhatsApp groups, Telegram, Drive links or anywhere else;</li>
          <li>copy, scrape or download content from the site with bots or automated tools;</li>
          <li>try to get around the paywall, hack the site, or misuse any bug (please report bugs to us instead).</li>
        </ul>
        <p>
          We may suspend or close accounts that are shared, resold or misused, without a refund. Our decision on misuse is final.
        </p>
      </Section>

      <Section title="Question papers and copyright">
        <p>
          Question papers belong to their respective owners and are shared for educational reference. If you own content on this
          site and want it removed, message us and we will review it promptly.
        </p>
      </Section>

      <Section title="Accuracy">
        <p>
          We work hard to keep notes and papers accurate, but we can&apos;t guarantee they are complete, current or error-free, or
          that using them will lead to any particular exam result. Use them alongside your syllabus and textbooks. If you spot an
          error, tell us and we will fix it.
        </p>
      </Section>

      <Section title="Limitation of liability">
        <p>
          The site is provided &ldquo;as is&rdquo;. We don&apos;t guarantee it will always be available or error-free. To the extent the
          law allows, DU PYQ Online is not liable for any indirect or consequential loss from using the site, and our total
          liability for any claim is limited to the amount you paid us for the purchase in question.
        </p>
      </Section>

      <Section title="Other policies">
        <p>
          Our <Link href="/privacy-policy" className="text-brand hover:underline">Privacy Policy</Link> explains how we handle your
          data, and our <Link href="/refund-policy" className="text-brand hover:underline">Refund &amp; Cancellation Policy</Link> explains
          when refunds apply. Both are part of these terms.
        </p>
      </Section>

      <Section title="Governing law">
        <p>These terms are governed by the laws of India.</p>
      </Section>
    </LegalPage>
  );
}
