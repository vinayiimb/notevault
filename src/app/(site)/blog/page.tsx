import type { Metadata } from "next";
import Link from "next/link";
import { ArticleNyTimes, Clock } from "@phosphor-icons/react/dist/ssr";
import { getAllBlogPosts } from "@/lib/blog";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";

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

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <BreadcrumbJsonLd
          items={[
            { name: "Home", url: "/" },
            { name: "Blog", url: "/blog" },
          ]}
        />

        <div className="max-w-3xl">
          <p className="flex items-center gap-2 text-sm font-semibold text-indigo-600">
            <ArticleNyTimes size={18} weight="bold" /> Blog
          </p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Guides for DU exam preparation.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            Practical, step-by-step articles on using previous year question papers, planning
            semester revision, and getting the most out of the DU PYQ Online archive.
          </p>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-500/50 hover:shadow-md"
            >
              <div
                aria-hidden
                className="mb-4 flex h-32 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 transition-colors group-hover:bg-indigo-50/50"
              >
                <ArticleNyTimes size={36} weight="bold" className="text-indigo-500/80 transition-transform group-hover:scale-105" />
              </div>
              <h2 className="text-lg font-bold tracking-tight text-slate-900 group-hover:text-indigo-600">
                {post.title}
              </h2>
              <p className="mt-2 line-clamp-3 flex-1 text-sm leading-6 text-slate-600">{post.description}</p>
              <div className="mt-4 flex items-center gap-3 text-xs font-medium text-slate-400">
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
          <p className="mt-10 text-sm text-slate-500">No articles published yet — check back soon.</p>
        )}
      </div>
    </div>
  );
}
