import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarBlank, Clock, UserCircle } from "@phosphor-icons/react/dist/ssr";
import { getAllBlogPosts, getBlogPostBySlug, getRelatedBlogPosts } from "@/lib/blog";
import { extractContentHeadings, preprocessNotesMarkdown } from "@/lib/content/toc";
import { ContentThemeProvider } from "@/components/content/notes/theme-provider";
import { ContentLightboxProvider } from "@/components/content/notes/note-image";
import { NotesMarkdown } from "@/components/content/notes/notes-markdown";
import { ContentTocSidebar } from "@/components/content/notes/toc-sidebar";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { ArticleJsonLd } from "@/components/seo/article-jsonld";

export function generateStaticParams() {
  return getAllBlogPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);
  if (!post) return {};

  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    keywords: post.keywords,
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt ?? post.publishedAt,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
}

const WHITE_BLOG_THEME = {
  light: {
    background: "#ffffff",
    surface: "#ffffff",
    surfaceMuted: "#f8fafc",
    border: "#e2e8f0",
    text: "#0f172a",
    textMuted: "#475569",
    primary: "#4f46e5",
    primaryText: "#ffffff",
    secondary: "#0284c7",
    accent: "#6366f1",
    success: "#16a34a",
    warning: "#d97706",
    error: "#dc2626",
    info: "#2563eb",
    link: "#4f46e5",
    selection: "#e0e7ff",
    gradientFrom: "#4f46e5",
    gradientTo: "#0284c7",
  },
  dark: {
    background: "#ffffff",
    surface: "#ffffff",
    surfaceMuted: "#f8fafc",
    border: "#e2e8f0",
    text: "#0f172a",
    textMuted: "#475569",
    primary: "#4f46e5",
    primaryText: "#ffffff",
    secondary: "#0284c7",
    accent: "#6366f1",
    success: "#16a34a",
    warning: "#d97706",
    error: "#dc2626",
    info: "#2563eb",
    link: "#4f46e5",
    selection: "#e0e7ff",
    gradientFrom: "#4f46e5",
    gradientTo: "#0284c7",
  },
};

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);
  if (!post) notFound();

  const preprocessed = preprocessNotesMarkdown(post.content);
  const headings = extractContentHeadings(preprocessed);
  const related = getRelatedBlogPosts(post);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <BreadcrumbJsonLd
          items={[
            { name: "Home", url: "/" },
            { name: "Blog", url: "/blog" },
            { name: post.title, url: `/blog/${post.slug}` },
          ]}
        />
        <ArticleJsonLd
          title={post.title}
          description={post.description}
          slug={post.slug}
          author={post.author}
          publishedAt={post.publishedAt}
          updatedAt={post.updatedAt}
          keywords={post.keywords}
        />

        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
          <Link href="/" className="hover:text-slate-900">
            Home
          </Link>
          <span aria-hidden>/</span>
          <Link href="/blog" className="hover:text-slate-900">
            Blog
          </Link>
          <span aria-hidden>/</span>
          <span className="truncate font-medium text-slate-900">{post.title}</span>
        </nav>

        <Link
          href="/blog"
          className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-indigo-600"
        >
          <ArrowLeft size={16} weight="bold" /> Back to blog
        </Link>

        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_240px]">
          <article className="min-w-0">
            <header className="border-b border-slate-200 pb-8">
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">{post.title}</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">{post.description}</p>
              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium text-slate-500">
                <span className="flex items-center gap-1.5">
                  <UserCircle size={16} weight="bold" /> {post.author}
                </span>
                <span className="flex items-center gap-1.5">
                  <CalendarBlank size={16} weight="bold" />
                  <time dateTime={post.publishedAt}>Published {formatDate(post.publishedAt)}</time>
                </span>
                {post.updatedAt && post.updatedAt !== post.publishedAt && (
                  <time dateTime={post.updatedAt}>Updated {formatDate(post.updatedAt)}</time>
                )}
                <span className="flex items-center gap-1.5">
                  <Clock size={16} weight="bold" /> {post.readingTimeMinutes} min read
                </span>
              </div>
            </header>

            <div className="mt-8">
              <ContentThemeProvider subjectTheme={WHITE_BLOG_THEME} forceMode="light">
                <ContentLightboxProvider>
                  <NotesMarkdown content={preprocessed} />
                </ContentLightboxProvider>
              </ContentThemeProvider>
            </div>

            <div className="mt-12 rounded-2xl border border-indigo-100 bg-slate-50 p-6 sm:p-8">
              <h2 className="text-lg font-bold text-slate-900">Ready to start revising?</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Browse the complete DU previous year question paper archive, organized by course,
                semester and subject, and build your own topic-frequency revision plan.
              </p>
              <Link
                href="/pyq-notes"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-indigo-700"
              >
                Open the full PYQ archive
              </Link>
            </div>

            {related.length > 0 && (
              <div className="mt-12 border-t border-slate-200 pt-8">
                <h2 className="text-lg font-bold text-slate-900">Related articles</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {related.map((item) => (
                    <Link
                      key={item.slug}
                      href={`/blog/${item.slug}`}
                      className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-indigo-500 hover:shadow-xs"
                    >
                      <p className="text-sm font-bold text-slate-900">{item.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-600">{item.description}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </article>

          <ContentTocSidebar headings={headings} />
        </div>
      </div>
    </div>
  );
}
