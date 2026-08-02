import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { prisma } from "@/lib/prisma";
import { readBytesFromUrl } from "@/lib/storage";

// Bundles everything available for a subject — compiled notes plus every
// uploaded notes/PYQ file — into a single ZIP. Built server-side so it can
// read R2 objects directly (readBytesFromUrl) without hitting browser CORS,
// and so a slow/partial fetch never leaves the client stuck reconstructing
// a zip from a torn download.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const subject = await prisma.subject.findUnique({
    where: { id },
    include: {
      resources: { orderBy: { createdAt: "desc" } },
      notes: true,
    },
  });
  if (!subject) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (subject.resources.length === 0 && !subject.notes) {
    return NextResponse.json({ error: "Nothing to download for this subject yet" }, { status: 404 });
  }

  const zip = new JSZip();
  const usedNames = new Set<string>();

  function uniqueName(preferred: string) {
    let name = preferred;
    let n = 2;
    while (usedNames.has(name)) {
      const dot = preferred.lastIndexOf(".");
      name = dot === -1 ? `${preferred} (${n})` : `${preferred.slice(0, dot)} (${n})${preferred.slice(dot)}`;
      n += 1;
    }
    usedNames.add(name);
    return name;
  }

  if (subject.notes) {
    zip.file(uniqueName(`${subject.name} — compiled notes.md`), subject.notes.content);
  }

  const results = await Promise.allSettled(
    subject.resources.map(async (resource) => {
      const bytes = await readBytesFromUrl(resource.fileUrl);
      const extMatch = resource.fileName.match(/\.[^.]+$/);
      const ext = extMatch ? extMatch[0] : ".pdf";
      const base = resource.title.replace(/[\\/:*?"<>|]+/g, "").trim() || resource.fileName;
      const folder = resource.type === "PYQ" ? "PYQs" : "Notes";
      return { folder, name: uniqueName(`${folder}/${base}${ext}`), bytes };
    }),
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      zip.file(result.value.name, result.value.bytes);
    }
  }

  const failedCount = results.filter((r) => r.status === "rejected").length;
  if (failedCount > 0) {
    zip.file(
      "_missing files.txt",
      `${failedCount} file(s) could not be included in this ZIP — the originals are still available individually on the subject page.`,
    );
  }

  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const zipName = `${subject.name.replace(/[\\/:*?"<>|]+/g, "")}.zip`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipName}"`,
      "Content-Length": String(buffer.byteLength),
    },
  });
}
