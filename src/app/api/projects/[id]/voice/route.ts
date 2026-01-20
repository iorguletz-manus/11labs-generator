import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/projects/[id]/voice - Obține setările vocii pentru un proiect
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const project = await prisma.project.findUnique({
      where: { id },
      select: {
        voiceId: true,
        voiceSettings: true,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Proiectul nu a fost găsit" },
        { status: 404 }
      );
    }

    // Parse voiceSettings din JSON string
    let settings = null;
    if (project.voiceSettings) {
      try {
        settings = JSON.parse(project.voiceSettings);
      } catch {
        settings = null;
      }
    }

    return NextResponse.json({
      voiceId: project.voiceId,
      settings: settings || {
        stability: 50,
        similarity: 75,
        style: 0,
        speed: 1.0,
        model: "eleven_multilingual_v2",
      },
    });
  } catch (error) {
    console.error("Eroare la încărcarea setărilor vocii:", error);
    return NextResponse.json(
      { error: "Eroare la încărcarea setărilor vocii" },
      { status: 500 }
    );
  }
}

// PUT /api/projects/[id]/voice - Salvează setările vocii pentru un proiect
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { voiceId, settings } = body;

    // Validări
    if (settings) {
      if (settings.stability !== undefined && (settings.stability < 0 || settings.stability > 100)) {
        return NextResponse.json(
          { error: "Stability trebuie să fie între 0 și 100" },
          { status: 400 }
        );
      }
      if (settings.similarity !== undefined && (settings.similarity < 0 || settings.similarity > 100)) {
        return NextResponse.json(
          { error: "Similarity trebuie să fie între 0 și 100" },
          { status: 400 }
        );
      }
      if (settings.style !== undefined && (settings.style < 0 || settings.style > 100)) {
        return NextResponse.json(
          { error: "Style trebuie să fie între 0 și 100" },
          { status: 400 }
        );
      }
      if (settings.speed !== undefined && (settings.speed < 0.5 || settings.speed > 2.0)) {
        return NextResponse.json(
          { error: "Speed trebuie să fie între 0.5 și 2.0" },
          { status: 400 }
        );
      }
    }

    const project = await prisma.project.update({
      where: { id },
      data: {
        voiceId: voiceId || null,
        voiceSettings: settings ? JSON.stringify(settings) : null,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      voiceId: project.voiceId,
      settings: settings,
    });
  } catch (error) {
    console.error("Eroare la salvarea setărilor vocii:", error);
    return NextResponse.json(
      { error: "Eroare la salvarea setărilor vocii" },
      { status: 500 }
    );
  }
}
