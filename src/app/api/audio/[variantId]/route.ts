import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/audio/[variantId] - Returnează fișierul audio pentru playback
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ variantId: string }> }
) {
  try {
    const { variantId } = await params;

    const variant = await prisma.audioVariant.findUnique({
      where: { id: variantId },
    });

    if (!variant) {
      return NextResponse.json(
        { error: "Varianta audio nu a fost găsită" },
        { status: 404 }
      );
    }

    if (!variant.audioData) {
      return NextResponse.json(
        { error: "Nu există audio pentru această variantă" },
        { status: 404 }
      );
    }

    // Returnează audio-ul ca stream MP3
    const audioBuffer = Buffer.from(variant.audioData);
    return new NextResponse(new Uint8Array(audioBuffer), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": variant.audioData.length.toString(),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });

  } catch (error) {
    console.error("Eroare la streaming audio:", error);
    return NextResponse.json(
      { error: "Eroare internă" },
      { status: 500 }
    );
  }
}
