import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PUT /api/variants/[id]/activate - Setează varianta ca activă
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: variantId } = await params;

    // Verifică dacă varianta există
    const variant = await prisma.audioVariant.findUnique({
      where: { id: variantId },
    });

    if (!variant) {
      return NextResponse.json(
        { error: "Varianta nu a fost găsită" },
        { status: 404 }
      );
    }

    // Verifică dacă varianta are audio generat
    if (variant.status !== "done" || (!variant.audioData && !variant.audioUrl)) {
      return NextResponse.json(
        { error: "Nu poți activa o variantă fără audio generat" },
        { status: 400 }
      );
    }

    // Dezactivează toate celelalte variante ale aceluiași chunk
    await prisma.audioVariant.updateMany({
      where: {
        chunkId: variant.chunkId,
        id: { not: variantId },
      },
      data: { isActive: false },
    });

    // Activează varianta selectată
    await prisma.audioVariant.update({
      where: { id: variantId },
      data: { isActive: true },
    });

    return NextResponse.json({
      success: true,
      message: "Varianta a fost activată",
      variantId,
    });

  } catch (error) {
    console.error("Eroare la activarea variantei:", error);
    return NextResponse.json(
      { error: "Eroare internă la activarea variantei" },
      { status: 500 }
    );
  }
}
