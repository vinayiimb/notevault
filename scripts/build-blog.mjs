import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BLOG_CONTENT_DIR = path.join(__dirname, "../src/content/blog");
const OUT_FILE = path.join(__dirname, "../src/data/blog-manifest.json");

function readingTimeFor(content) {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function loadPost(fileName) {
  const raw = readFileSync(path.join(BLOG_CONTENT_DIR, fileName), "utf8");
  const { data, content } = matter(raw);
  return {
    ...data,
    content,
    readingTimeMinutes: readingTimeFor(content),
  };
}

function build() {
  const files = readdirSync(BLOG_CONTENT_DIR).filter((file) => file.endsWith(".md"));
  const posts = files.map(loadPost).sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  
  writeFileSync(OUT_FILE, JSON.stringify(posts, null, 2));
  console.log(`✅ Built blog manifest: ${posts.length} posts`);
}

build();
