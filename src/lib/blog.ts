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

/**
 * Explicit semester -> post slug map (only where a post genuinely covers
 * that semester) — deliberately not fuzzy-matched against titles, since a
 * wrong guess here would put a "Semester 5" link on a Semester 2 page.
 * Kept in sync by hand; add an entry only once a matching post exists.
 */
const SEMESTER_GUIDE_SLUG: Record<number, string> = {
  1: "du-semester-1-exam-guide-first-year-freshers",
  3: "du-semester-3-exam-guide-second-year-strategy",
  5: "du-semester-5-exam-guide-final-year-strategy",
};

/** The blog post that specifically covers this semester's exam prep, if one exists. */
export function getSemesterGuidePost(semester: number): BlogPost | null {
  const slug = SEMESTER_GUIDE_SLUG[semester];
  return slug ? getBlogPostBySlug(slug) : null;
}

/**
 * The general "how to use PYQs" guide, surfaced on subject/paper pages
 * regardless of semester — always applicable, never a semester-specific
 * guess.
 */
export function getPyqUsageGuidePost(): BlogPost | null {
  return getBlogPostBySlug("how-to-use-du-previous-year-question-papers");
}
