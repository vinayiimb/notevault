import "server-only";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const BLOG_CONTENT_DIR = path.join(process.cwd(), "src", "content", "blog");

export type BlogPostFrontmatter = {
  title: string;
  description: string;
  slug: string;
  author: string;
  publishedAt: string;
  updatedAt?: string;
  keywords?: string[];
  featuredImage?: string;
  imageAlt?: string;
};

export type BlogPost = BlogPostFrontmatter & {
  content: string;
  readingTimeMinutes: number;
};

function readingTimeFor(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function loadPost(fileName: string): BlogPost {
  const raw = readFileSync(path.join(BLOG_CONTENT_DIR, fileName), "utf8");
  const { data, content } = matter(raw);
  const frontmatter = data as BlogPostFrontmatter;
  return {
    ...frontmatter,
    content,
    readingTimeMinutes: readingTimeFor(content),
  };
}

// Reads every Markdown file once per request; the archive has a handful of
// posts today, so there's no need for build-time caching yet.
export function getAllBlogPosts(): BlogPost[] {
  const files = readdirSync(BLOG_CONTENT_DIR).filter((file) => file.endsWith(".md"));
  return files
    .map(loadPost)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}

export function getBlogPostBySlug(slug: string): BlogPost | null {
  return getAllBlogPosts().find((post) => post.slug === slug) ?? null;
}

export function getRelatedBlogPosts(current: BlogPost, limit = 3): BlogPost[] {
  const others = getAllBlogPosts().filter((post) => post.slug !== current.slug);
  const currentKeywords = new Set(current.keywords ?? []);

  const scored = others.map((post) => {
    const overlap = (post.keywords ?? []).filter((keyword) => currentKeywords.has(keyword)).length;
    return { post, overlap };
  });

  scored.sort((a, b) => b.overlap - a.overlap || new Date(b.post.publishedAt).getTime() - new Date(a.post.publishedAt).getTime());
  return scored.slice(0, limit).map((entry) => entry.post);
}
