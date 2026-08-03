// Central SEO constants and structured-data builders, reused across
// robots.ts, sitemap.ts, generateMetadata() exports, and JSON-LD blocks.
export const SITE_URL = "https://www.dupyq.online";
export const SITE_NAME = "DU PYQ Online";

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    "name": SITE_NAME,
    "url": `${SITE_URL}/`,
    "logo": {
      "@type": "ImageObject",
      "url": `${SITE_URL}/logo.png`,
      "width": 512,
      "height": 512
    }
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    "url": `${SITE_URL}/`,
    "name": SITE_NAME,
    "alternateName": [
      "DU PYQ",
      "Delhi University PYQ"
    ],
    "description": "Free Delhi University previous year question papers, notes, syllabus and answer keys.",
    "publisher": {
      "@id": `${SITE_URL}/#organization`
    },
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": `${SITE_URL}/search?q={search_term_string}`
      },
      "query-input": "required name=search_term_string"
    }
  };
}

export function blogPostingJsonLd(post: {
  title: string;
  description: string;
  slug: string;
  author: string;
  publishedAt: string;
  updatedAt?: string;
  keywords?: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    url: absoluteUrl(`/blog/${post.slug}`),
    mainEntityOfPage: absoluteUrl(`/blog/${post.slug}`),
    datePublished: post.publishedAt,
    dateModified: post.updatedAt ?? post.publishedAt,
    keywords: post.keywords?.join(", "),
    author: { "@type": "Organization", name: post.author },
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  };
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": item.url.startsWith("http") ? item.url : absoluteUrl(item.url),
    })),
  };
}
