import { NextResponse } from "next/server";

// GET /api/voices - Proxy pentru ElevenLabs voices API
export async function GET() {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "ElevenLabs API key nu este configurat" },
      { status: 500 }
    );
  }

  try {
    const response = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: {
        "xi-api-key": apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs API error:", response.status, errorText);
      
      if (response.status === 401) {
        return NextResponse.json(
          { error: "API Key ElevenLabs invalid" },
          { status: 401 }
        );
      }
      
      return NextResponse.json(
        { error: "Eroare la încărcarea vocilor" },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Returnăm doar informațiile necesare pentru fiecare voce
    const voices = data.voices.map((voice: {
      voice_id: string;
      name: string;
      category: string;
      labels: Record<string, string>;
      settings?: {
        stability: number;
        similarity_boost: number;
        style?: number;
        use_speaker_boost?: boolean;
      };
    }) => ({
      voice_id: voice.voice_id,
      name: voice.name,
      category: voice.category,
      labels: voice.labels,
      settings: voice.settings || {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0,
        use_speaker_boost: true,
      },
    }));

    return NextResponse.json({ voices });
  } catch (error) {
    console.error("Eroare la fetch voices:", error);
    return NextResponse.json(
      { error: "Eroare la conectarea cu ElevenLabs" },
      { status: 500 }
    );
  }
}
