import type { Metadata } from "next";
import Link from "next/link";
import { ChatCircleText, GraduationCap, LinkSimple, WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
import { SITE_URL } from "@/lib/seo";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { CopyButton } from "@/components/pyq/copy-button";

export const metadata: Metadata = {
  title: "Share DU PYQ Online With Students",
  description:
    "DU PYQ Online is a free Delhi University question paper archive. If it's helped your students, feel free to link to it — entirely optional, no strings attached.",
  alternates: { canonical: "/link-to-us" },
};

const HTML_SNIPPET = `<a href="${SITE_URL}/">\n  DU PYQ Online – Delhi University Previous Year Question Papers\n</a>`;
const SHORT_DESCRIPTION =
  "DU PYQ Online is a free platform where Delhi University students can browse previous-year question papers, notes and exam resources by course, semester and subject.";
const DETAILED_DESCRIPTION =
  "DU PYQ Online provides free access to Delhi University previous-year question papers and study resources organised by programme, semester, subject and examination session. Students can use the platform without creating an account.";

function CopyBlock({ text }: { text: string }) {
  return (
    <div className="mt-3 flex items-start justify-between gap-4 rounded-xl border border-border bg-surface p-4">
      <p className="text-sm leading-6 text-foreground">{text}</p>
      <CopyButton
        text={text}
        label="Copy"
        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-accent hover:text-accent"
      />
    </div>
  );
}

export default function LinkToUsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Link to us", url: "/link-to-us" },
        ]}
      />

      <p className="flex items-center gap-2 text-sm font-medium text-accent">
        <LinkSimple size={18} weight="bold" /> Link to us
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
        Share DU PYQ Online With Students
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
        DU PYQ Online is a free resource for Delhi University students — previous-year question
        papers, notes, and exam material organised by course, semester, and subject, with no
        account required. If it&rsquo;s been useful to students at your college, department, or
        website, you&rsquo;re welcome to link to it below. It&rsquo;s entirely optional, and there&rsquo;s
        no request here for payment, a reciprocal link, or a dofollow link — link however feels
        right for your site.
      </p>

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">What&rsquo;s on the site</h2>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-muted">
          <li>Previous-year question papers by programme, semester, and subject</li>
          <li>Compiled subject notes and answer keys</li>
          <li>An examination-session archive with course-wise Google Drive folders</li>
          <li>Study tools — flashcards, revision drills, and an exam kit</li>
          <li>Guides on exam preparation and how to use the archive, on the blog</li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">Why colleges and societies share it</h2>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-muted">
          <li>It&rsquo;s free for students to use, with no signup or paywall</li>
          <li>It saves students time hunting for scattered PDFs before exams</li>
          <li>Departmental and society resource pages can point students to one place</li>
          <li>College magazines and blogs can reference it in exam-prep coverage</li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">Website URL</h2>
        <CopyBlock text={`${SITE_URL}/`} />
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">Suggested short description</h2>
        <CopyBlock text={SHORT_DESCRIPTION} />
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">Suggested detailed description</h2>
        <CopyBlock text={DETAILED_DESCRIPTION} />
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">HTML link snippet</h2>
        <div className="mt-3 flex items-start justify-between gap-4 rounded-xl border border-border bg-surface p-4">
          <pre className="min-w-0 flex-1 overflow-x-auto text-xs leading-5 text-foreground">
            <code>{HTML_SNIPPET}</code>
          </pre>
          <CopyButton
            text={HTML_SNIPPET}
            label="Copy"
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-accent hover:text-accent"
          />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">Questions or a broken link to report?</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Reach out through the{" "}
          <Link href="/feedback" className="text-accent hover:underline">
            feedback page
          </Link>{" "}
          or on{" "}
          <a
            href="https://wa.me/919376180015"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-accent hover:underline"
          >
            WhatsApp <WhatsappLogo size={14} weight="bold" />
          </a>
          .
        </p>
      </section>

      <div className="mt-12 flex flex-wrap items-center gap-3 border-t border-border pt-8">
        <CopyButton
          text={`${SITE_URL}/`}
          label="Copy Website Link"
          copiedLabel="Link copied"
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90"
        />
        <Link
          href="/pyq-notes"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
        >
          <GraduationCap size={16} weight="bold" />
          Browse DU PYQs
        </Link>
        <Link
          href="/feedback"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
        >
          <ChatCircleText size={16} weight="bold" />
          Contact us
        </Link>
      </div>
    </div>
  );
}
