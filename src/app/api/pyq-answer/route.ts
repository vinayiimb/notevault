import { prisma } from "@/lib/prisma";
import { isBundle } from "@/lib/pyq-analyser";

// The HTML of one PYQ Analyser solution bundle, fetched only when a student
// opens that question (keeps /papers/analyser light). Served as text/plain
// with a sandbox CSP so opening this URL directly never runs the bundle's
// scripts on our origin; the page renders it in a sandboxed iframe instead.
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^[a-z0-9]{10,40}$/i.test(id)) return new Response("Bad id", { status: 400 });
  const q = await prisma.question.findUnique({ where: { id }, select: { answerText: true } });
  if (!q || !isBundle(q.answerText)) return new Response("Not found", { status: 404 });
  return new Response(q.answerText, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Security-Policy": "sandbox",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
