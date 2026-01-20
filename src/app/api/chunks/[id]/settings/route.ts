import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PUT /api/chunks/[id]/settings - Actualizează setările custom pentru un chunk
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const { useCustomSettings, customVoiceId, customVoiceSettings } = body;

    // Validare: dacă useCustomSettings este true, trebuie să avem și customVoiceId
    if (useCustomSettings && !customVoiceId) {
      return NextResponse.json(
        { error: "customVoiceId este obligatoriu când useCustomSettings este true" },
        { status: 400 }
      );
    }

    // Verifică dacă chunk-ul există
    const existingChunk = await prisma.chunk.findUnique({
      where: { id },
    });

    if (!existingChunk) {
      return NextResponse.json(
        { error: "Chunk-ul nu a fost găsit" },
        { status: 404 }
      );
    }

    // Actualizează setările chunk-ului
    const updatedChunk = await prisma.chunk.update({
      where: { id },
      data: {
        useCustomSettings: useCustomSettings ?? false,
        customVoiceId: useCustomSettings ? customVoiceId : null,
        customVoiceSettings: useCustomSettings && customVoiceSettings 
          ? JSON.stringify(customVoiceSettings) 
          : null,
      },
    });

    return NextResponse.json({
      id: updatedChunk.id,
      useCustomSettings: updatedChunk.useCustomSettings,
      customVoiceId: updatedChunk.customVoiceId,
      customVoiceSettings: updatedChunk.customVoiceSettings 
        ? JSON.parse(updatedChunk.customVoiceSettings) 
        : null,
    });
  } catch (error) {
    console.error("Eroare la actualizarea setărilor chunk-ului:", error);
    return NextResponse.json(
      { error: "Eroare la actualizarea setărilor" },
      { status: 500 }
    );
  }
}

// DELETE /api/chunks/[id]/settings - Resetează chunk-ul la setări default
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Verifică dacă chunk-ul există
    const existingChunk = await prisma.chunk.findUnique({
      where: { id },
    });

    if (!existingChunk) {
      return NextResponse.json(
        { error: "Chunk-ul nu a fost găsit" },
        { status: 404 }
      );
    }

    // Resetează setările la default
    const updatedChunk = await prisma.chunk.update({
      where: { id },
      data: {
        useCustomSettings: false,
        customVoiceId: null,
        customVoiceSettings: null,
      },
    });

    return NextResponse.json({
      id: updatedChunk.id,
      useCustomSettings: false,
      customVoiceId: null,
      customVoiceSettings: null,
      message: "Setările au fost resetate la default",
    });
  } catch (error) {
    console.error("Eroare la resetarea setărilor chunk-ului:", error);
    return NextResponse.json(
      { error: "Eroare la resetarea setărilor" },
      { status: 500 }
    );
  }
}

// GET /api/chunks/[id]/settings - Obține setările unui chunk
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const chunk = await prisma.chunk.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            voiceId: true,
            voiceSettings: true,
          },
        },
      },
    });

    if (!chunk) {
      return NextResponse.json(
        { error: "Chunk-ul nu a fost găsit" },
        { status: 404 }
      );
    }

    // Returnează atât setările custom cât și cele default ale proiectului
    return NextResponse.json({
      id: chunk.id,
      useCustomSettings: chunk.useCustomSettings,
      customVoiceId: chunk.customVoiceId,
      customVoiceSettings: chunk.customVoiceSettings 
        ? JSON.parse(chunk.customVoiceSettings) 
        : null,
      // Setările default ale proiectului (pentru referință)
      projectDefaults: {
        voiceId: chunk.project.voiceId,
        voiceSettings: chunk.project.voiceSettings 
          ? JSON.parse(chunk.project.voiceSettings) 
          : null,
      },
    });
  } catch (error) {
    console.error("Eroare la obținerea setărilor chunk-ului:", error);
    return NextResponse.json(
      { error: "Eroare la obținerea setărilor" },
      { status: 500 }
    );
  }
}
