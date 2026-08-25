import "server-only";
import blogManifest from "@/data/blog-manifest.json";

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

export function getAllBlogPosts(): BlogPost[] {
  return blogManifest as BlogPost[];
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
