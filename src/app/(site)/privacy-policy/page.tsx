import type { Metadata } from "next";
import { LegalPage, Section } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What data DU PYQ Online collects, why, and your rights over it.",
  alternates: { canonical: "/privacy-policy" },
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="We collect as little as we need to run the site and deliver the notes you buy. We never sell your data."
    >
      <Section title="Browsing — no account needed">
        <p>You can read question papers and note previews without signing in. While you browse, we use:</p>
        <ul>
          <li><strong>An anonymous device cookie</strong> — a random ID (not your name or email) for features like study streaks and the oranges leaderboard.</li>
          <li><strong>Your browser&apos;s local storage</strong> — reading preferences such as theme, dark mode and sidebar state. These stay on your device.</li>
          <li><strong>Google Analytics</strong> — anonymous usage statistics (pages visited, device and browser type, approximate location) so we can see what&apos;s useful. Google Analytics uses its own cookies.</li>
          <li><strong>Server logs</strong> — our hosting provider records standard request data such as IP address and browser type, used for security and fixing errors.</li>
        </ul>
      </Section>

      <Section title="When you buy notes">
        <p>At checkout we collect:</p>
        <ul>
          <li><strong>Your email (Gmail)</strong> — it becomes your login and identifies your purchases.</li>
          <li><strong>Your WhatsApp number</strong> — to send your login and help with your order.</li>
          <li><strong>Your UTR / UPI reference number</strong>, the amount and the subjects you chose — to verify the payment.</li>
        </ul>
        <p>
          You pay through your own UPI app, so <strong>we never see or store your card, bank account details or UPI PIN</strong>.
        </p>
      </Section>

      <Section title="Signing in">
        <p>
          If you sign in with Google, Google shares your name, email address and profile photo with us through Firebase
          Authentication (a Google service). We use your email to unlock your notes. If you sign in with a password we issued,
          we store only a secure hash of it, never the password itself. Either way, a signed-in session cookie keeps you logged in.
        </p>
      </Section>

      <Section title="How we use your data">
        <ul>
          <li>To run the site and give you access to the notes you bought.</li>
          <li>To verify payments, prevent fraud and detect account sharing.</li>
          <li>To contact you about your order or a support request.</li>
          <li>To understand which features are useful and improve them.</li>
        </ul>
        <p>We don&apos;t sell or rent your personal data, and we don&apos;t send marketing messages without asking.</p>
      </Section>

      <Section title="Who processes it">
        <p>We use trusted providers to run the site. They handle data only to provide their service to us:</p>
        <ul>
          <li>Railway — hosting the website;</li>
          <li>Neon — our database;</li>
          <li>Cloudflare R2 — storing files such as question papers and images;</li>
          <li>Google — Analytics and Firebase sign-in;</li>
          <li>WhatsApp — when we message you about your order.</li>
        </ul>
        <p>Some of these providers may store data outside India.</p>
      </Section>

      <Section title="How long we keep it">
        <p>
          We keep your account and purchase records for as long as you have access to paid notes, and payment records for as
          long as Indian tax and accounting law requires. Analytics data is kept for Google Analytics&apos; standard retention period.
        </p>
      </Section>

      <Section title="Your rights">
        <p>Under India&apos;s Digital Personal Data Protection Act, 2023, you can ask us to:</p>
        <ul>
          <li>tell you what personal data we hold about you;</li>
          <li>correct or update it;</li>
          <li>delete your account and personal data (we may keep payment records the law requires); and</li>
          <li>handle a complaint about how we use your data.</li>
        </ul>
        <p>Message our helpdesk (details below) and we&apos;ll respond within 30 days.</p>
        <p>
          You can also block or delete cookies in your browser settings. The site still works without them, though signing in and
          some preferences need cookies.
        </p>
      </Section>

      <Section title="Children">
        <p>
          Students under 18 should use paid features with a parent&apos;s or guardian&apos;s permission. We don&apos;t knowingly collect
          personal data from children under 13. If you think a child has given us personal data, contact us and we&apos;ll delete it.
        </p>
      </Section>

      <Section title="Changes">
        <p>We may update this policy. The latest version, with its date, is always on this page.</p>
      </Section>
    </LegalPage>
  );
}
