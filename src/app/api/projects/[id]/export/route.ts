import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const FFMPEG_API_URL = 'https://api.ffmpeg-api.com';

// Helper function to upload a file to ffmpeg-api
async function uploadToFfmpegApi(audioBuffer: Buffer, fileName: string): Promise<string> {
  const authHeader = process.env.FFMPEG_API_AUTH || `Basic ${process.env.FFMPEG_API_KEY}`;
  
  // 1. Get upload URL
  const fileResponse = await fetch(`${FFMPEG_API_URL}/file`, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file_name: fileName }),
  });

  if (!fileResponse.ok) {
    const error = await fileResponse.text();
    throw new Error(`Failed to get upload URL: ${error}`);
  }

  const { file, upload } = await fileResponse.json();

  // 2. Upload the file
  const uploadResponse = await fetch(upload.url, {
    method: 'PUT',
    body: new Uint8Array(audioBuffer),
    headers: {
      'Content-Type': 'audio/mpeg',
    },
  });

  if (!uploadResponse.ok) {
    throw new Error(`Failed to upload file: ${uploadResponse.statusText}`);
  }

  return file.file_path;
}

// Helper function to process (concatenate) audio files
async function concatenateAudioFiles(filePaths: string[], outputFileName: string): Promise<Buffer> {
  const authHeader = process.env.FFMPEG_API_AUTH || `Basic ${process.env.FFMPEG_API_KEY}`;
  
  // Build inputs array
  const inputs = filePaths.map(file_path => ({ file_path }));
  
  // Build filter_complex for concatenation
  // Format: [0:a][1:a][2:a]concat=n=3:v=0:a=1[out]
  const inputLabels = filePaths.map((_, i) => `[${i}:a]`).join('');
  const filterComplex = `${inputLabels}concat=n=${filePaths.length}:v=0:a=1[out]`;

  const processResponse = await fetch(`${FFMPEG_API_URL}/ffmpeg/process`, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      task: {
        inputs,
        filter_complex: filterComplex,
        outputs: [
          {
            file: outputFileName,
            options: ['-acodec', 'libmp3lame', '-ab', '192k'],
            maps: ['[out]'],
          },
        ],
      },
    }),
  });

  if (!processResponse.ok) {
    const error = await processResponse.text();
    throw new Error(`Failed to process audio: ${error}`);
  }

  const result = await processResponse.json();

  if (!result.ok) {
    throw new Error(`FFmpeg processing failed: ${result.error || 'Unknown error'}`);
  }

  // Download the result
  const downloadUrl = result.result[0].download_url;
  const downloadResponse = await fetch(downloadUrl);

  if (!downloadResponse.ok) {
    throw new Error(`Failed to download result: ${downloadResponse.statusText}`);
  }

  const arrayBuffer = await downloadResponse.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verifică dacă avem credențiale pentru ffmpeg-api
    if (!process.env.FFMPEG_API_KEY && !process.env.FFMPEG_API_AUTH) {
      return NextResponse.json(
        { error: 'FFMPEG API credentials not configured' },
        { status: 500 }
      );
    }

    // Obține proiectul cu toate chunk-urile și variantele audio
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        chunks: {
          orderBy: { order: 'asc' },
          include: {
            variants: {
              where: { isActive: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Proiectul nu a fost găsit' },
        { status: 404 }
      );
    }

    // Filtrează chunk-urile cu text (ignoră cele goale)
    const chunksWithText = project.chunks.filter(
      (chunk) => chunk.text && chunk.text.trim().length > 0
    );

    if (chunksWithText.length === 0) {
      return NextResponse.json(
        { error: 'Nu există chunk-uri cu text în acest proiect' },
        { status: 400 }
      );
    }

    // Verifică dacă toate chunk-urile cu text au audio
    const chunksWithoutAudio = chunksWithText.filter(
      (chunk) => chunk.variants.length === 0
    );

    if (chunksWithoutAudio.length > 0) {
      const missingChunks = chunksWithoutAudio.map((chunk) => ({
        index: chunk.order + 1,
        text: chunk.text.substring(0, 50) + (chunk.text.length > 50 ? '...' : ''),
      }));

      return NextResponse.json(
        {
          error: 'Unele chunk-uri nu au audio generat',
          missingChunks,
        },
        { status: 400 }
      );
    }

    // Upload all audio files to ffmpeg-api
    console.log(`Uploading ${chunksWithText.length} audio files to ffmpeg-api...`);
    const filePaths: string[] = [];
    
    for (let i = 0; i < chunksWithText.length; i++) {
      const chunk = chunksWithText[i];
      const variant = chunk.variants[0];
      
      if (!variant.audioData) {
        console.error(`Chunk ${chunk.order} nu are date audio`);
        continue;
      }
      
      const audioBuffer = Buffer.from(variant.audioData);
      const fileName = `chunk_${i.toString().padStart(3, '0')}.mp3`;
      
      const filePath = await uploadToFfmpegApi(audioBuffer, fileName);
      filePaths.push(filePath);
      console.log(`Uploaded chunk ${i + 1}/${chunksWithText.length}: ${filePath}`);
    }

    if (filePaths.length === 0) {
      return NextResponse.json(
        { error: 'Nu s-au găsit date audio valide' },
        { status: 400 }
      );
    }

    // Generează numele fișierului
    const sanitizedName = project.name
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);
    const outputFileName = `${sanitizedName}_audiobook.mp3`;

    // Concatenate all audio files using ffmpeg-api
    console.log(`Concatenating ${filePaths.length} audio files...`);
    const concatenatedBuffer = await concatenateAudioFiles(filePaths, outputFileName);
    console.log(`Concatenation complete! Final size: ${concatenatedBuffer.length} bytes`);

    // Returnează fișierul MP3
    return new NextResponse(new Uint8Array(concatenatedBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': `attachment; filename="${outputFileName}"`,
        'Content-Length': concatenatedBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Eroare la export:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Eroare la generarea fișierului MP3' },
      { status: 500 }
    );
  }
}

// GET pentru a verifica statusul exportului
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        chunks: {
          orderBy: { order: 'asc' },
          include: {
            variants: {
              where: { isActive: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Proiectul nu a fost găsit' },
        { status: 404 }
      );
    }

    const chunksWithText = project.chunks.filter(
      (chunk) => chunk.text && chunk.text.trim().length > 0
    );

    const chunksWithAudio = chunksWithText.filter(
      (chunk) => chunk.variants.length > 0
    );

    const chunksWithoutAudio = chunksWithText.filter(
      (chunk) => chunk.variants.length === 0
    );

    return NextResponse.json({
      ready: chunksWithoutAudio.length === 0 && chunksWithText.length > 0,
      totalChunks: chunksWithText.length,
      chunksWithAudio: chunksWithAudio.length,
      chunksWithoutAudio: chunksWithoutAudio.length,
      missingChunks: chunksWithoutAudio.map((chunk) => ({
        index: chunk.order + 1,
        text: chunk.text.substring(0, 50) + (chunk.text.length > 50 ? '...' : ''),
      })),
    });
  } catch (error) {
    console.error('Eroare la verificare export:', error);
    return NextResponse.json(
      { error: 'Eroare la verificarea statusului' },
      { status: 500 }
    );
  }
}
