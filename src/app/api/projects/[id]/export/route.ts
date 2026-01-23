import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    // Creează directorul temporar pentru fișierele audio
    const tempDir = path.join('/tmp', `export-${id}-${Date.now()}`);
    if (!existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true });
    }

    // Salvează fiecare audio într-un fișier temporar
    const audioFiles: string[] = [];
    for (let i = 0; i < chunksWithText.length; i++) {
      const chunk = chunksWithText[i];
      const variant = chunk.variants[0];
      const audioPath = path.join(tempDir, `chunk-${i.toString().padStart(4, '0')}.mp3`);
      
      // Verifică dacă există date audio
      if (!variant.audioData) {
        console.error(`Chunk ${i} nu are date audio`);
        continue;
      }
      
      // audioData este deja un Buffer (Bytes în Prisma)
      await writeFile(audioPath, variant.audioData);
      audioFiles.push(audioPath);
    }

    // Creează fișierul de concatenare pentru ffmpeg
    const concatFilePath = path.join(tempDir, 'concat.txt');
    const concatContent = audioFiles.map((f) => `file '${f}'`).join('\n');
    await writeFile(concatFilePath, concatContent);

    // Concatenează fișierele audio cu ffmpeg
    const outputPath = path.join(tempDir, 'output.mp3');
    await execAsync(
      `ffmpeg -f concat -safe 0 -i "${concatFilePath}" -c copy "${outputPath}" -y`
    );

    // Citește fișierul rezultat
    const { readFile } = await import('fs/promises');
    const outputBuffer = await readFile(outputPath);

    // Curăță fișierele temporare
    for (const file of audioFiles) {
      await unlink(file).catch(() => {});
    }
    await unlink(concatFilePath).catch(() => {});
    await unlink(outputPath).catch(() => {});

    // Generează numele fișierului
    const sanitizedName = project.name
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);
    const fileName = `${sanitizedName}_audiobook.mp3`;

    // Returnează fișierul MP3
    return new NextResponse(outputBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': outputBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Eroare la export:', error);
    return NextResponse.json(
      { error: 'Eroare la generarea fișierului MP3' },
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
