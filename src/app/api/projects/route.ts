import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/projects - Lista proiecte (sortate după createdAt DESC)
export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
    });

    return NextResponse.json(projects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json(
      { error: "Eroare la încărcarea proiectelor" },
      { status: 500 }
    );
  }
}

// POST /api/projects - Creare proiect nou
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const name = body.name || "Proiect nou";

    // Validare
    if (name.length > 100) {
      return NextResponse.json(
        { error: "Numele proiectului nu poate depăși 100 de caractere" },
        { status: 400 }
      );
    }

    const project = await prisma.project.create({
      data: {
        name: name.trim(),
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json(
      { error: "Eroare la crearea proiectului" },
      { status: 500 }
    );
  }
}
