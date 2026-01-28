import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PUT /api/projects/[id]/text
 * Salvează textul complet și sincronizează chunk-urile în baza de date.
 * 
 * Body: { full_text: string }
 * 
 * Logica:
 * 1. Face split după '\n' pentru a identifica chunk-urile
 * 2. Compară cu chunk-urile existente în DB
 * 3. Chunk-uri noi → se creează
 * 4. Chunk-uri modificate → se actualizează, audio-urile se șterg
 * 5. Chunk-uri care nu mai există → se șterg (cascade la audio)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { full_text } = body;

    // Validare input
    if (typeof full_text !== "string") {
      return NextResponse.json(
        { error: "Textul este obligatoriu" },
        { status: 400 }
      );
    }

    // Verifică dacă proiectul există
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        chunks: {
          orderBy: { order: "asc" },
          include: { variants: true },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Proiectul nu a fost găsit" },
        { status: 404 }
      );
    }

    // Split text în chunk-uri (fiecare linie = un chunk)
    // Păstrăm toate liniile, inclusiv cele goale (pentru a permite chunk-uri goale)
    let newChunkTexts = full_text.split("\n");
    
    // Dacă textul e complet gol, avem un singur chunk gol
    if (newChunkTexts.length === 0 || (newChunkTexts.length === 1 && newChunkTexts[0] === "")) {
      newChunkTexts = [""];
    }

    const existingChunks = project.chunks;

    // Pregătim operațiile de batch
    const operations: Promise<unknown>[] = [];

    // Procesăm fiecare chunk nou
    for (let i = 0; i < newChunkTexts.length; i++) {
      const newText = newChunkTexts[i];
      const existingChunk = existingChunks[i];

      if (existingChunk) {
        // Chunk-ul există deja
        if (existingChunk.text !== newText) {
          // Textul s-a modificat - actualizăm și ștergem audio-urile
          operations.push(
            prisma.chunk.update({
              where: { id: existingChunk.id },
              data: {
                text: newText,
                order: i,
                updatedAt: new Date(),
              },
            })
          );

          // Ștergem toate variantele audio pentru acest chunk
          if (existingChunk.variants.length > 0) {
            operations.push(
              prisma.audioVariant.deleteMany({
                where: { chunkId: existingChunk.id },
              })
            );
          }
        } else if (existingChunk.order !== i) {
          // Doar ordinea s-a schimbat
          operations.push(
            prisma.chunk.update({
              where: { id: existingChunk.id },
              data: { order: i },
            })
          );
        }
      } else {
        // Chunk nou - îl creăm
        operations.push(
          prisma.chunk.create({
            data: {
              projectId: id,
              text: newText,
              order: i,
            },
          })
        );
      }
    }

    // Ștergem chunk-urile care nu mai există (cele cu index >= newChunkTexts.length)
    const chunksToDelete = existingChunks.slice(newChunkTexts.length);
    for (const chunk of chunksToDelete) {
      operations.push(
        prisma.chunk.delete({
          where: { id: chunk.id },
        })
      );
    }

    // Executăm toate operațiile
    await Promise.all(operations);

    // Actualizăm timestamp-ul proiectului
    await prisma.project.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    // Returnăm chunk-urile actualizate
    const updatedChunks = await prisma.chunk.findMany({
      where: { projectId: id },
      orderBy: { order: "asc" },
      include: {
        variants: {
          orderBy: { variantNumber: "asc" },
        },
      },
    });

    return NextResponse.json({
      success: true,
      chunks: updatedChunks.map((chunk) => ({
        id: chunk.id,
        text: chunk.text,
        order: chunk.order,
        hasAudio: chunk.variants.some((v) => v.status === "done"),
        isGenerating: chunk.variants.some((v) => v.status === "processing" || v.status === "queued"),
        activeVariantId: chunk.variants.find((v) => v.isActive)?.id || null,
        // Câmpuri noi v4
        useCustomSettings: chunk.useCustomSettings,
        customVoiceId: chunk.customVoiceId,
        customVoiceSettings: chunk.customVoiceSettings 
          ? JSON.parse(chunk.customVoiceSettings) 
          : null,
      })),
    });
  } catch (error) {
    console.error("Eroare la salvarea textului:", error);
    return NextResponse.json(
      { error: "Eroare internă la salvarea textului" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/projects/[id]/text
 * Returnează textul complet și chunk-urile proiectului
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Verifică mai întâi dacă proiectul există
    const project = await prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Proiectul nu a fost găsit" },
        { status: 404 }
      );
    }

    // Încarcă chunk-urile separat pentru a optimiza query-ul
    const chunks = await prisma.chunk.findMany({
      where: { projectId: id },
      orderBy: { order: "asc" },
      select: {
        id: true,
        text: true,
        order: true,
        useCustomSettings: true,
        customVoiceId: true,
        customVoiceSettings: true,
        variants: {
          select: {
            id: true,
            status: true,
            isActive: true,
          },
          orderBy: { variantNumber: "asc" },
        },
      },
    });

    // Reconstruim textul complet din chunk-uri
    const fullText = chunks.map((chunk) => chunk.text).join("\n");

    return NextResponse.json({
      full_text: fullText,
      chunks: chunks.map((chunk) => ({
        id: chunk.id,
        text: chunk.text,
        order: chunk.order,
        hasAudio: chunk.variants.some((v) => v.status === "done"),
        isGenerating: chunk.variants.some((v) => v.status === "processing" || v.status === "queued"),
        activeVariantId: chunk.variants.find((v) => v.isActive)?.id || null,
        variantsCount: chunk.variants.length,
        // Câmpuri noi v4
        useCustomSettings: chunk.useCustomSettings,
        customVoiceId: chunk.customVoiceId,
        customVoiceSettings: chunk.customVoiceSettings 
          ? JSON.parse(chunk.customVoiceSettings) 
          : null,
      })),
    });
  } catch (error) {
    console.error("Eroare la încărcarea textului:", error);
    return NextResponse.json(
      { error: "Eroare internă la încărcarea textului" },
      { status: 500 }
    );
  }
}
