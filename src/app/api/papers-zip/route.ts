import fs from "fs";
import path from "path";

// "Download all" on /papers: streams every paper of one subject as a single
// ZIP. PDFs are fetched from Google Drive a few at a time and written out as
// they arrive (stored, not compressed — PDFs are already compressed), so the
// server only ever holds a handful of files in memory.
//   GET /api/papers-zip?name=<zip name>&p=<driveId>|<label>&p=...
export const dynamic = "force-dynamic";

const MAX_FILES = 60;
const PARALLEL = 4;

// Only Drive files that are in our own catalog (written by
// scripts/build-papers-split.mjs) — never an open proxy for any Drive file.
let allowed: Set<string> | null = null;
function allowedIds(): Set<string> {
  if (!allowed) {
    const file = path.join(process.cwd(), "public", "data", "papers", "drive-ids.json");
    allowed = new Set(JSON.parse(fs.readFileSync(file, "utf8")) as string[]);
  }
  return allowed;
}

// zlib.crc32 only exists from Node 22.2; production runs Node 20.
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function safeName(label: string) {
  return label.replace(/[^\p{L}\p{N} .,_()&+-]/gu, "_").replace(/\s+/g, " ").trim().slice(0, 120) || "paper";
}

async function fetchPdf(id: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(`https://drive.usercontent.google.com/download?id=${id}&export=download`, {
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    // Drive answers with an HTML page (quota / virus-scan notice) instead of
    // the file when it won't serve it.
    return buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46 ? buf : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ids = allowedIds();
  const files = url.searchParams
    .getAll("p")
    .map((v) => {
      const [id, ...rest] = v.split("|");
      return { id, label: rest.join("|") };
    })
    .filter((f) => ids.has(f.id))
    .slice(0, MAX_FILES);
  if (files.length === 0) return Response.json({ error: "No papers to download." }, { status: 400 });

  const zipName = `${safeName(url.searchParams.get("name") ?? "DU question papers")}.zip`;
  const width = String(files.length).length;
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  // Start fetches PARALLEL at a time; entries are written in order.
  const pending: Promise<Uint8Array | null>[] = [];
  const startUpTo = (n: number) => {
    while (pending.length < Math.min(n, files.length)) pending.push(fetchPdf(files[pending.length].id));
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const central: Uint8Array[] = [];
      let offset = 0;
      let written = 0;
      const push = (chunk: Uint8Array) => {
        controller.enqueue(chunk);
        offset += chunk.length;
      };

      for (let i = 0; i < files.length; i++) {
        startUpTo(i + PARALLEL);
        const data = await pending[i];
        pending[i] = Promise.resolve(null); // let the buffer be collected
        if (!data) continue;
        written += 1;
        const name = new TextEncoder().encode(
          `${String(i + 1).padStart(width, "0")} - ${safeName(files[i].label)}.pdf`,
        );
        const crc = crc32(data);

        const local = new DataView(new ArrayBuffer(30));
        local.setUint32(0, 0x04034b50, true);
        local.setUint16(4, 20, true);
        local.setUint16(6, 0x0800, true); // UTF-8 file names
        local.setUint16(8, 0, true); // stored
        local.setUint16(10, dosTime, true);
        local.setUint16(12, dosDate, true);
        local.setUint32(14, crc, true);
        local.setUint32(18, data.length, true);
        local.setUint32(22, data.length, true);
        local.setUint16(26, name.length, true);
        local.setUint16(28, 0, true);

        const entry = new DataView(new ArrayBuffer(46));
        entry.setUint32(0, 0x02014b50, true);
        entry.setUint16(4, 20, true);
        entry.setUint16(6, 20, true);
        entry.setUint16(8, 0x0800, true);
        entry.setUint16(10, 0, true);
        entry.setUint16(12, dosTime, true);
        entry.setUint16(14, dosDate, true);
        entry.setUint32(16, crc, true);
        entry.setUint32(20, data.length, true);
        entry.setUint32(24, data.length, true);
        entry.setUint16(28, name.length, true);
        entry.setUint32(42, offset, true);
        central.push(new Uint8Array(entry.buffer), name);

        push(new Uint8Array(local.buffer));
        push(name);
        push(data);
      }

      if (written === 0) {
        controller.error(new Error("Drive did not return any of the papers"));
        return;
      }
      const centralStart = offset;
      for (const chunk of central) push(chunk);
      const end = new DataView(new ArrayBuffer(22));
      end.setUint32(0, 0x06054b50, true);
      end.setUint16(8, written, true);
      end.setUint16(10, written, true);
      end.setUint32(12, offset - centralStart, true);
      end.setUint32(16, centralStart, true);
      push(new Uint8Array(end.buffer));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="papers.zip"; filename*=UTF-8''${encodeURIComponent(zipName)}`,
      "Cache-Control": "no-store",
    },
  });
}
