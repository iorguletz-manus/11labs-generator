import { NextResponse } from "next/server";

// GET /api/models - Proxy pentru ElevenLabs models API
export async function GET() {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "ElevenLabs API key nu este configurat" },
      { status: 500 }
    );
  }

  try {
    const response = await fetch("https://api.elevenlabs.io/v1/models", {
      headers: {
        "xi-api-key": apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs API error:", response.status, errorText);
      
      return NextResponse.json(
        { error: "Eroare la încărcarea modelelor" },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Filtrăm doar modelele TTS (text-to-speech)
    const models = data
      .filter((model: { can_do_text_to_speech: boolean }) => model.can_do_text_to_speech)
      .map((model: {
        model_id: string;
        name: string;
        description: string;
        languages: Array<{ language_id: string; name: string }>;
      }) => ({
        model_id: model.model_id,
        name: model.name,
        description: model.description,
        languages: model.languages,
      }));

    return NextResponse.json({ models });
  } catch (error) {
    console.error("Eroare la fetch models:", error);
    return NextResponse.json(
      { error: "Eroare la conectarea cu ElevenLabs" },
      { status: 500 }
    );
  }
}
