import Groq from "groq-sdk";
import { NextResponse, type NextRequest } from "next/server";

// "Ask AI" doubt-solver on the notes pages (src/components/content/notes/ask-ai-panel.tsx).
// Streams plain text so the panel can type the answer out like ChatGPT.
// FREE ONLY: the Groq account must stay on the free plan (no card) — then
// hitting a limit just returns 429, it never bills. Students get no per-user
// cap; when one model's free quota runs out we fall through to the next
// (each model has its own free quota). Free tier also caps one request at
// ~8000 tokens, hence the small context / history / answer budgets below.
const MODELS = [process.env.GROQ_CHAT_MODEL ?? "openai/gpt-oss-120b", "openai/gpt-oss-20b"];
const MAX_CONTEXT_CHARS = 6000;
const MAX_MSG_CHARS = 1500;
const MAX_HISTORY = 8;

type Msg = { role: "user" | "assistant"; content: string };

export async function POST(request: NextRequest) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: "AI tutor isn't configured yet." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const messages: Msg[] = Array.isArray(body?.messages)
    ? body.messages
        .filter((m: Msg) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string")
        .slice(-MAX_HISTORY)
        .map((m: Msg) => ({ role: m.role, content: m.content.slice(0, MAX_MSG_CHARS) }))
    : [];
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "Ask a question first." }, { status: 400 });
  }
  const str = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : "");
  const subject = str(body.subject, 200);
  const context = str(body.context, MAX_CONTEXT_CHARS);
  const selection = str(body.selection, 1500);

  const system = `You are a friendly, patient tutor for Delhi University students reading the notes for "${subject}".
Explain doubts in simple language a first-year student understands: short paragraphs, bullet points, a quick real-life example where it helps, and bold the key terms.
If they ask for an exam answer, structure it the way DU examiners expect (intro, points with headings, conclusion).
Use the notes excerpt below as your main source; if the question goes beyond it, still answer from general knowledge but keep it relevant to the subject.
Reply in the language the student writes in (Hinglish is fine). Use Markdown; use $...$ for math.

NOTES EXCERPT (what the student is currently reading):
"""
${context || "(not available)"}
"""${selection ? `\n\nTHE STUDENT HIGHLIGHTED THIS PART:\n"""\n${selection}\n"""` : ""}`;

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY, maxRetries: 0 });
  let stream;
  let rateLimited = false;
  for (const model of MODELS) {
    try {
      stream = await groq.chat.completions.create({
        model,
        stream: true,
        max_tokens: 1200,
        temperature: 0.4,
        reasoning_effort: "low",
        include_reasoning: false,
        messages: [{ role: "system", content: system }, ...messages],
      });
      break;
    } catch (err) {
      console.error(`[ask-notes] groq error (${model}):`, err instanceof Error ? err.message : err);
      rateLimited = err instanceof Groq.RateLimitError;
      if (!rateLimited) break;
    }
  }
  if (!stream) {
    return NextResponse.json(
      { error: rateLimited ? "Lots of students are asking right now — try again in a minute." : "Couldn't reach the AI. Try again." },
      { status: rateLimited ? 429 : 502 },
    );
  }

  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content;
            if (text) controller.enqueue(encoder.encode(text));
          }
        } catch {
          controller.enqueue(encoder.encode("\n\n_(The answer got cut off — ask again.)_"));
        }
        controller.close();
      },
    }),
    { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } },
  );
}
