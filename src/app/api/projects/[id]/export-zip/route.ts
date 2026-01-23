import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import JSZip from "jszip";

// POST /api/projects/[id]/export-zip - Exportă fiecare chunk ca fișier MP3 individual într-o arhivă ZIP
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    // Obține proiectul cu toate chunk-urile și variantele active
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        chunks: {
          orderBy: { order: "asc" },
          include: {
            variants: {
              where: { isActive: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Proiectul nu a fost găsit" },
        { status: 404 }
      );
    }

    // Filtrează chunk-urile cu text
    const chunksWithText = project.chunks.filter(
      (chunk) => chunk.text && chunk.text.trim() !== ""
    );

    if (chunksWithText.length === 0) {
      return NextResponse.json(
        { error: "Proiectul nu are chunk-uri cu text" },
        { status: 400 }
      );
    }

    // Verifică că toate chunk-urile au audio
    const chunksWithoutAudio = chunksWithText.filter(
      (chunk) => !chunk.variants[0]?.audioData
    );

    if (chunksWithoutAudio.length > 0) {
      return NextResponse.json(
        {
          error: `${chunksWithoutAudio.length} chunk-uri nu au audio generat`,
          missingChunks: chunksWithoutAudio.map((c) => ({
            index: c.order + 1,
            text: c.text.substring(0, 50) + (c.text.length > 50 ? "..." : ""),
          })),
        },
        { status: 400 }
      );
    }

    // Creează arhiva ZIP
    const zip = new JSZip();
    const projectNameClean = project.name
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .replace(/\s+/g, "_");

    // Adaugă fiecare chunk ca fișier MP3
    for (const chunk of chunksWithText) {
      const variant = chunk.variants[0];
      if (variant?.audioData) {
        // Creează un nume de fișier descriptiv
        const chunkNumber = String(chunk.order + 1).padStart(3, "0");
        const textPreview = chunk.text
          .substring(0, 30)
          .replace(/[^a-zA-Z0-9\s]/g, "")
          .replace(/\s+/g, "_")
          .substring(0, 20);
        
        const fileName = `${chunkNumber}_${textPreview}.mp3`;
        
        // Adaugă fișierul în arhivă
        zip.file(fileName, variant.audioData);
      }
    }

    // Generează arhiva ZIP
    const zipBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 5 },
    });

    // Returnează arhiva
    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${projectNameClean}_chunks.zip"`,
        "Content-Length": zipBuffer.length.toString(),
      },
    });

  } catch (error) {
    console.error("Eroare la export ZIP:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Eroare la export" },
      { status: 500 }
    );
  }
}
