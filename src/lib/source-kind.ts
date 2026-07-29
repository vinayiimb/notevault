// Pure, dependency-free — safe to import from either a client or server
// module. Kept separate from note-ingestion.ts (which pulls in server-only
// extractors backed by Node's fs/pdf.js) so a client component that only
// needs to classify a file before upload doesn't drag those into the
// browser bundle.
export type SourceKind = "pdf" | "docx" | "pptx" | "text" | "image" | "unsupported";

export function detectSourceKind(fileName: string, mimeType: string): SourceKind {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  if (mimeType === "application/pdf" || ext === "pdf") return "pdf";
  if (mimeType.includes("wordprocessingml") || ext === "docx") return "docx";
  if (mimeType.includes("presentationml") || ext === "pptx") return "pptx";
  if (mimeType.startsWith("image/") || ["jpg", "jpeg", "png"].includes(ext)) return "image";
  if (mimeType.startsWith("text/") || ["md", "markdown", "txt"].includes(ext)) return "text";
  return "unsupported";
}
