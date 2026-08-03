import { blogPostingJsonLd } from "@/lib/seo";

type ArticleJsonLdProps = Parameters<typeof blogPostingJsonLd>[0];

export function ArticleJsonLd(props: ArticleJsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(blogPostingJsonLd(props)) }}
    />
  );
}
