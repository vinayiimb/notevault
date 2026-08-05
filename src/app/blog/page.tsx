import type { Metadata } from "next";
import Link from "next/link";
import { ArticleNyTimes, Clock } from "@phosphor-icons/react/dist/ssr";
import { getAllBlogPosts } from "@/lib/blog";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { VisibleBreadcrumb } from "@/components/seo/visible-breadcrumb";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Guides on using Delhi University previous year question papers, exam preparation strategy, and how to get the most out of the DU PYQ Online archive.",
  alternates: { canonical: "/blog" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
}

export default function BlogIndexPage() {
  const posts = getAllBlogPosts();

  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: "Blog", url: "/blog" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <BreadcrumbJsonLd items={breadcrumbs} />
      <VisibleBreadcrumb items={breadcrumbs} />

      <div className="max-w-3xl">
        <p className="flex items-center gap-2 text-sm font-medium text-accent">
          <ArticleNyTimes size={18} weight="bold" /> Blog
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          Guides for DU exam preparation.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
          Practical, step-by-step articles on using previous year question papers, planning
          semester revision, and getting the most out of the DU PYQ Online archive.
        </p>
      </div>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="group flex flex-col rounded-2xl border border-border bg-surface p-5 shadow-2xs transition hover:border-accent/50 hover:shadow-sm"
          >
            <div
              aria-hidden
              className="mb-4 flex h-32 items-center justify-center rounded-xl bg-gradient-to-br from-accent-soft to-sky-soft/60"
            >
              <ArticleNyTimes size={32} weight="bold" className="text-accent/70" />
            </div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground group-hover:text-accent">
              {post.title}
            </h2>
            <p className="mt-2 line-clamp-3 flex-1 text-sm leading-6 text-muted">{post.description}</p>
            <div className="mt-4 flex items-center gap-3 text-xs text-muted">
              <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
              <span aria-hidden>·</span>
              <span className="flex items-center gap-1">
                <Clock size={14} weight="bold" /> {post.readingTimeMinutes} min read
              </span>
            </div>
          </Link>
        ))}
      </div>

      {posts.length === 0 && (
        <p className="mt-10 text-sm text-muted">No articles published yet — check back soon.</p>
      )}
    </div>
  );
}
