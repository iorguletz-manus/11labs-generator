import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface VoiceSettings {
  stability: number;
  similarity: number;
  style: number;
  speed: number;
  model: string;
  speakerBoost?: boolean;
}

interface GenerateSettings {
  voiceId: string;
  settings: VoiceSettings;
}

// Funcția getSettingsForChunk - determină setările de folosit la generare
async function getSettingsForChunk(chunkId: string): Promise<GenerateSettings | null> {
  const chunk = await prisma.chunk.findUnique({
    where: { id: chunkId },
    include: {
      project: true,
    },
  });

  if (!chunk) {
    return null;
  }

  // Dacă chunk-ul are setări custom, le folosim pe acestea
  if (chunk.useCustomSettings && chunk.customVoiceId) {
    const customSettings = chunk.customVoiceSettings 
      ? JSON.parse(chunk.customVoiceSettings) 
      : null;
    
    return {
      voiceId: chunk.customVoiceId,
      settings: customSettings || {
        stability: 50,
        similarity: 75,
        style: 0,
        speed: 1.0,
        model: "eleven_multilingual_v2",
        speakerBoost: true,
      },
    };
  }

  // Altfel, folosim setările proiectului (default)
  if (!chunk.project.voiceId) {
    return null; // Nu există voce configurată
  }

  const projectSettings = chunk.project.voiceSettings 
    ? JSON.parse(chunk.project.voiceSettings) 
    : null;

  return {
    voiceId: chunk.project.voiceId,
    settings: projectSettings || {
      stability: 50,
      similarity: 75,
      style: 0,
      speed: 1.0,
      model: "eleven_multilingual_v2",
      speakerBoost: true,
    },
  };
}

// POST /api/chunks/[id]/generate - Generează audio pentru un chunk
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: chunkId } = await params;

    // Verifică dacă chunk-ul există
    const chunk = await prisma.chunk.findUnique({
      where: { id: chunkId },
    });

    if (!chunk) {
      return NextResponse.json(
        { error: "Chunk-ul nu a fost găsit" },
        { status: 404 }
      );
    }

    if (!chunk.text || chunk.text.trim() === "") {
      return NextResponse.json(
        { error: "Chunk-ul nu are text" },
        { status: 400 }
      );
    }

    // Obține setările pentru generare
    const generateSettings = await getSettingsForChunk(chunkId);

    if (!generateSettings) {
      return NextResponse.json(
        { error: "Nu există o voce configurată. Selectează o voce în setările proiectului sau chunk-ului." },
        { status: 400 }
      );
    }

    // Determină numărul variantei (următorul număr disponibil)
    const existingVariants = await prisma.audioVariant.count({
      where: { chunkId },
    });
    const variantNumber = existingVariants + 1;

    // Creează varianta cu status "processing"
    const variant = await prisma.audioVariant.create({
      data: {
        chunkId,
        variantNumber,
        status: "processing",
        progress: 0,
        usedVoiceId: generateSettings.voiceId,
        usedVoiceSettings: JSON.stringify(generateSettings.settings),
      },
    });

    // Apelează ElevenLabs API
    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
    
    if (!ELEVENLABS_API_KEY) {
      await prisma.audioVariant.update({
        where: { id: variant.id },
        data: {
          status: "error",
          errorMessage: "API key ElevenLabs nu este configurat",
        },
      });
      return NextResponse.json(
        { error: "API key ElevenLabs nu este configurat" },
        { status: 500 }
      );
    }

    const { voiceId, settings } = generateSettings;

    // Construiește request-ul pentru ElevenLabs
    const elevenLabsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "Accept": "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: chunk.text,
          model_id: settings.model || "eleven_multilingual_v2",
          voice_settings: {
            stability: (settings.stability || 50) / 100,
            similarity_boost: (settings.similarity || 75) / 100,
            style: (settings.style || 0) / 100,
            use_speaker_boost: settings.speakerBoost ?? true,
          },
        }),
      }
    );

    if (!elevenLabsResponse.ok) {
      const errorText = await elevenLabsResponse.text();
      let errorMessage = "Eroare la generarea audio";
      
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.detail?.message || errorJson.error || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }

      await prisma.audioVariant.update({
        where: { id: variant.id },
        data: {
          status: "error",
          errorMessage,
        },
      });

      return NextResponse.json(
        { error: errorMessage },
        { status: elevenLabsResponse.status }
      );
    }

    // Obține audio-ul ca ArrayBuffer și convertește la Buffer
    const audioArrayBuffer = await elevenLabsResponse.arrayBuffer();
    const audioBuffer = Buffer.from(audioArrayBuffer);

    // Actualizează varianta cu audio-ul generat
    await prisma.audioVariant.update({
      where: { id: variant.id },
      data: {
        audioData: audioBuffer,
        status: "done",
        progress: 100,
        isActive: variantNumber === 1, // Prima variantă este activă implicit
      },
    });

    // Returnează informații despre varianta creată
    return NextResponse.json({
      success: true,
      variant: {
        id: variant.id,
        variantNumber,
        status: "done",
        usedVoiceId: generateSettings.voiceId,
        usedVoiceSettings: generateSettings.settings,
      },
    });

  } catch (error) {
    console.error("Eroare la generarea audio:", error);
    return NextResponse.json(
      { error: "Eroare internă la generarea audio" },
      { status: 500 }
    );
  }
}

// GET /api/chunks/[id]/generate - Obține statusul și variantele audio
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: chunkId } = await params;

    const variants = await prisma.audioVariant.findMany({
      where: { chunkId },
      orderBy: { variantNumber: "asc" },
    });

    return NextResponse.json({
      variants: variants.map((v) => ({
        id: v.id,
        variantNumber: v.variantNumber,
        status: v.status,
        progress: v.progress,
        isActive: v.isActive,
        errorMessage: v.errorMessage,
        usedVoiceId: v.usedVoiceId,
        usedVoiceSettings: v.usedVoiceSettings ? JSON.parse(v.usedVoiceSettings) : null,
        hasAudio: !!(v.audioData || v.audioUrl),
        createdAt: v.createdAt,
      })),
    });

  } catch (error) {
    console.error("Eroare la obținerea variantelor:", error);
    return NextResponse.json(
      { error: "Eroare internă" },
      { status: 500 }
    );
  }
}
