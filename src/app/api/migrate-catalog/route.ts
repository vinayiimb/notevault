import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const catalogPath = path.join(process.cwd(), "public/data/papers-catalog.json");
    if (!fs.existsSync(catalogPath)) {
      return NextResponse.json({ error: "papers-catalog.json not found" }, { status: 404 });
    }
    const papers = JSON.parse(fs.readFileSync(catalogPath, "utf-8"));
    
    // We will batch insert them to CatalogPaperUpload
    let inserted = 0;
    
    // Chunk into 1000s
    for (let i = 0; i < papers.length; i += 1000) {
      const chunk = papers.slice(i, i + 1000);
      const data = chunk.map((p: any, idx: number) => {
        // Create a unique hash since fileHash is @unique
        const uniqueHash = `static-migration-${i + idx}-${Date.now()}`;
        return {
          course: p.course || "Unknown",
          subject: p.subject || "Unknown",
          yearRange: p.yearRange || "Unknown",
          semesterGroup: p.semesterGroup || "Unknown",
          semester: p.semester ? parseInt(p.semester, 10) : null,
          fileUrl: p.pdfUrl,
          fileName: p.fileName || p.note || `Paper-${idx}.pdf`,
          fileSize: 1024, // dummy
          fileHash: uniqueHash,
          note: p.note,
        };
      });
      
      await prisma.catalogPaperUpload.createMany({
        data,
        skipDuplicates: true,
      });
      inserted += data.length;
    }
    
    return NextResponse.json({ success: true, inserted });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
