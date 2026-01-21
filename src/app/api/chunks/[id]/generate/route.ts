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

const MAX_VARIANTS = 5;

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

// Funcție pentru a genera o singură variantă audio
async function generateSingleVariant(
  chunk: { id: string; text: string },
  variantNumber: number,
  generateSettings: GenerateSettings,
  apiKey: string
): Promise<{ success: boolean; variantId: string; error?: string }> {
  // Creează varianta cu status "processing"
  const variant = await prisma.audioVariant.create({
    data: {
      chunkId: chunk.id,
      variantNumber,
      status: "processing",
      progress: 0,
      usedVoiceId: generateSettings.voiceId,
      usedVoiceSettings: JSON.stringify(generateSettings.settings),
    },
  });

  try {
    const { voiceId, settings } = generateSettings;

    // Construiește request-ul pentru ElevenLabs
    const elevenLabsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "Accept": "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
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

      return { success: false, variantId: variant.id, error: errorMessage };
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

    return { success: true, variantId: variant.id };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Eroare necunoscută";
    
    await prisma.audioVariant.update({
      where: { id: variant.id },
      data: {
        status: "error",
        errorMessage,
      },
    });

    return { success: false, variantId: variant.id, error: errorMessage };
  }
}

// POST /api/chunks/[id]/generate - Generează 5 variante audio pentru un chunk
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

    // Verifică dacă există deja variante
    const existingVariants = await prisma.audioVariant.count({
      where: { chunkId },
    });

    if (existingVariants >= MAX_VARIANTS) {
      return NextResponse.json(
        { error: `Chunk-ul are deja ${MAX_VARIANTS} variante. Șterge una pentru a genera alta.` },
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

    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
    
    if (!ELEVENLABS_API_KEY) {
      return NextResponse.json(
        { error: "API key ElevenLabs nu este configurat" },
        { status: 500 }
      );
    }

    // Calculează câte variante mai putem genera
    const variantsToGenerate = Math.min(MAX_VARIANTS - existingVariants, MAX_VARIANTS);
    const startVariantNumber = existingVariants + 1;

    // Generează toate variantele în paralel
    const generationPromises = [];
    for (let i = 0; i < variantsToGenerate; i++) {
      const variantNumber = startVariantNumber + i;
      generationPromises.push(
        generateSingleVariant(
          { id: chunkId, text: chunk.text },
          variantNumber,
          generateSettings,
          ELEVENLABS_API_KEY
        )
      );
    }

    // Așteaptă toate generările
    const results = await Promise.all(generationPromises);

    // Numără succesele și erorile
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    // Obține toate variantele actualizate
    const allVariants = await prisma.audioVariant.findMany({
      where: { chunkId },
      orderBy: { variantNumber: "asc" },
    });

    return NextResponse.json({
      success: true,
      message: `Generate ${successful} variante cu succes${failed > 0 ? `, ${failed} au eșuat` : ""}`,
      totalVariants: allVariants.length,
      variants: allVariants.map((v) => ({
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
