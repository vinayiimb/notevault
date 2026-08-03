import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/seo";
import { getAllBlogPosts } from "@/lib/blog";

// Static, always-public routes with no dynamic segment.
const STATIC_ROUTES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/browse/college", priority: 0.8, changeFrequency: "weekly" },
  { path: "/pyq-notes", priority: 0.9, changeFrequency: "daily" },
  { path: "/exam-sessions", priority: 0.7, changeFrequency: "weekly" },
  { path: "/tools", priority: 0.5, changeFrequency: "monthly" },
  { path: "/tools/exam-kit", priority: 0.5, changeFrequency: "monthly" },
  { path: "/paid-notes", priority: 0.3, changeFrequency: "monthly" },
  { path: "/blog", priority: 0.6, changeFrequency: "weekly" },
  { path: "/resources", priority: 0.6, changeFrequency: "monthly" },
  { path: "/link-to-us", priority: 0.3, changeFrequency: "monthly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [programs, terms, subjects, pyqResources, examSessions, sessionLinks, driveFiles] =
    await Promise.all([
      prisma.program.findMany({ select: { slug: true, createdAt: true } }),
      prisma.term.findMany({ select: { id: true, createdAt: true } }),
      prisma.subject.findMany({ select: { id: true, createdAt: true } }),
      prisma.resource.findMany({
        where: { type: "PYQ", ocrText: { not: null } },
        select: { id: true, createdAt: true },
      }),
      prisma.examSession.findMany({ select: { id: true, updatedAt: true } }),
      prisma.sessionProgramLink.findMany({
        select: { id: true, sessionId: true, updatedAt: true },
      }),
      prisma.driveFileMatch.findMany({
        where: { driveSubjectId: { not: null } },
        select: { linkId: true, driveSubjectId: true, updatedAt: true, link: { select: { sessionId: true } } },
      }),
    ]);

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const programEntries: MetadataRoute.Sitemap = programs.map((program) => ({
    url: absoluteUrl(`/programs/${program.slug}`),
    lastModified: program.createdAt,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const termEntries: MetadataRoute.Sitemap = terms.map((term) => ({
    url: absoluteUrl(`/terms/${term.id}`),
    lastModified: term.createdAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const subjectEntries: MetadataRoute.Sitemap = subjects.map((subject) => ({
    url: absoluteUrl(`/subjects/${subject.id}`),
    lastModified: subject.createdAt,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const pyqEntries: MetadataRoute.Sitemap = pyqResources.map((resource) => ({
    url: absoluteUrl(`/pyq-notes/${resource.id}`),
    lastModified: resource.createdAt,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const examSessionEntries: MetadataRoute.Sitemap = examSessions.map((session) => ({
    url: absoluteUrl(`/exam-sessions/${session.id}`),
    lastModified: session.updatedAt,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const sessionLinkEntries: MetadataRoute.Sitemap = sessionLinks.map((link) => ({
    url: absoluteUrl(`/exam-sessions/${link.sessionId}/${link.id}`),
    lastModified: link.updatedAt,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  // De-dupe DriveFileMatch rows down to one entry per (link, driveSubject)
  // pair, since /exam-sessions/[id]/[linkId]/[subjectId] shows every file
  // sharing that pair rather than one file each.
  const seenSubjectPages = new Set<string>();
  const sessionSubjectEntries: MetadataRoute.Sitemap = [];
  for (const file of driveFiles) {
    const key = `${file.linkId}:${file.driveSubjectId}`;
    if (seenSubjectPages.has(key)) continue;
    seenSubjectPages.add(key);
    sessionSubjectEntries.push({
      url: absoluteUrl(`/exam-sessions/${file.link.sessionId}/${file.linkId}/${file.driveSubjectId}`),
      lastModified: file.updatedAt,
      changeFrequency: "monthly",
      priority: 0.5,
    });
  }

  const blogEntries: MetadataRoute.Sitemap = getAllBlogPosts().map((post) => ({
    url: absoluteUrl(`/blog/${post.slug}`),
    lastModified: new Date(post.updatedAt ?? post.publishedAt),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [
    ...staticEntries,
    ...blogEntries,
    ...programEntries,
    ...termEntries,
    ...subjectEntries,
    ...pyqEntries,
    ...examSessionEntries,
    ...sessionLinkEntries,
    ...sessionSubjectEntries,
  ];
}
