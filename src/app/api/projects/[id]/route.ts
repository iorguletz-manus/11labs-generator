import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/projects/[id] - Obține un proiect
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        voiceId: true,
        voiceSettings: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Proiectul nu a fost găsit" },
        { status: 404 }
      );
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error("Error fetching project:", error);
    return NextResponse.json(
      { error: "Eroare la încărcarea proiectului" },
      { status: 500 }
    );
  }
}

// PUT /api/projects/[id] - Redenumire proiect
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name } = body;

    // Validare
    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Numele proiectului nu poate fi gol" },
        { status: 400 }
      );
    }

    if (name.length > 100) {
      return NextResponse.json(
        { error: "Numele proiectului nu poate depăși 100 de caractere" },
        { status: 400 }
      );
    }

    // Verifică dacă proiectul există
    const existingProject = await prisma.project.findUnique({
      where: { id },
    });

    if (!existingProject) {
      return NextResponse.json(
        { error: "Proiectul nu a fost găsit" },
        { status: 404 }
      );
    }

    const project = await prisma.project.update({
      where: { id },
      data: {
        name: name.trim(),
      },
    });

    return NextResponse.json(project);
  } catch (error) {
    console.error("Error updating project:", error);
    return NextResponse.json(
      { error: "Eroare la actualizarea proiectului" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id] - Ștergere proiect (cu cascade)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Verifică dacă proiectul există
    const existingProject = await prisma.project.findUnique({
      where: { id },
    });

    if (!existingProject) {
      return NextResponse.json(
        { error: "Proiectul nu a fost găsit" },
        { status: 404 }
      );
    }

    // Șterge proiectul (cascade va șterge și chunks și variants)
    await prisma.project.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json(
      { error: "Eroare la ștergerea proiectului" },
      { status: 500 }
    );
  }
}
