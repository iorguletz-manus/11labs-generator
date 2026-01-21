import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// DELETE /api/variants/[id] - Șterge o variantă audio
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: variantId } = await params;

    // Verifică dacă varianta există
    const variant = await prisma.audioVariant.findUnique({
      where: { id: variantId },
      include: {
        chunk: {
          include: {
            variants: true,
          },
        },
      },
    });

    if (!variant) {
      return NextResponse.json(
        { error: "Varianta nu a fost găsită" },
        { status: 404 }
      );
    }

    const wasActive = variant.isActive;
    const chunkId = variant.chunkId;
    const otherVariants = variant.chunk.variants.filter(v => v.id !== variantId);

    // Șterge varianta
    await prisma.audioVariant.delete({
      where: { id: variantId },
    });

    // Dacă varianta ștearsă era activă și mai există alte variante, activează prima
    if (wasActive && otherVariants.length > 0) {
      const firstVariant = otherVariants.sort((a, b) => a.variantNumber - b.variantNumber)[0];
      await prisma.audioVariant.update({
        where: { id: firstVariant.id },
        data: { isActive: true },
      });
    }

    // Renumerotează variantele rămase
    const remainingVariants = await prisma.audioVariant.findMany({
      where: { chunkId },
      orderBy: { variantNumber: "asc" },
    });

    for (let i = 0; i < remainingVariants.length; i++) {
      if (remainingVariants[i].variantNumber !== i + 1) {
        await prisma.audioVariant.update({
          where: { id: remainingVariants[i].id },
          data: { variantNumber: i + 1 },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Varianta a fost ștearsă",
    });

  } catch (error) {
    console.error("Eroare la ștergerea variantei:", error);
    return NextResponse.json(
      { error: "Eroare internă la ștergerea variantei" },
      { status: 500 }
    );
  }
}

// GET /api/variants/[id] - Obține detalii despre o variantă
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: variantId } = await params;

    const variant = await prisma.audioVariant.findUnique({
      where: { id: variantId },
    });

    if (!variant) {
      return NextResponse.json(
        { error: "Varianta nu a fost găsită" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: variant.id,
      variantNumber: variant.variantNumber,
      status: variant.status,
      progress: variant.progress,
      isActive: variant.isActive,
      errorMessage: variant.errorMessage,
      usedVoiceId: variant.usedVoiceId,
      usedVoiceSettings: variant.usedVoiceSettings ? JSON.parse(variant.usedVoiceSettings) : null,
      hasAudio: !!(variant.audioData || variant.audioUrl),
      createdAt: variant.createdAt,
    });

  } catch (error) {
    console.error("Eroare la obținerea variantei:", error);
    return NextResponse.json(
      { error: "Eroare internă" },
      { status: 500 }
    );
  }
}
