"use client";

import { useState, useEffect, useCallback } from "react";
import TextEditor, { ChunkData } from "./TextEditor";
import VoiceSettings from "./VoiceSettings";

interface ProjectEditorProps {
  projectId: string;
  projectName: string;
}

export default function ProjectEditor({ projectId, projectName }: ProjectEditorProps) {
  const [chunks, setChunks] = useState<ChunkData[]>([]);
  const [selectedChunkIndex, setSelectedChunkIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Încarcă chunk-urile la mount
  useEffect(() => {
    const loadChunks = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/projects/${projectId}/text`);
        
        if (!response.ok) {
          throw new Error("Eroare la încărcarea textului");
        }
        
        const data = await response.json();
        setChunks(data.chunks || []);
      } catch (err) {
        console.error("Eroare la încărcarea chunk-urilor:", err);
        setError("Nu s-a putut încărca textul proiectului");
      } finally {
        setIsLoading(false);
      }
    };

    loadChunks();
  }, [projectId]);

  // Handler pentru selectarea unui chunk
  const handleChunkSelect = useCallback((chunkIndex: number | null) => {
    setSelectedChunkIndex(chunkIndex);
  }, []);

  // Handler pentru actualizarea chunk-urilor din TextEditor
  const handleChunksUpdate = useCallback((newChunks: ChunkData[]) => {
    setChunks(newChunks);
  }, []);

  // Chunk-ul selectat
  const selectedChunk = selectedChunkIndex !== null ? chunks[selectedChunkIndex] : null;

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-secondary">Se încarcă...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Coloana 1 - Voice Settings (300px) */}
      <div className="w-[300px] min-w-[300px] h-full bg-card border-r border-border overflow-y-auto">
        <VoiceSettings projectId={projectId} />
      </div>

      {/* Coloana 2 - Text Editor (flexibil) */}
      <div className="flex-1 h-full bg-background flex flex-col overflow-hidden">
        <TextEditor
          projectId={projectId}
          initialChunks={chunks}
          onChunkSelect={handleChunkSelect}
          onChunksUpdate={handleChunksUpdate}
          selectedChunkIndex={selectedChunkIndex}
        />
      </div>

      {/* Coloana 3 - Audio Panel (350px) */}
      <div className="w-[350px] min-w-[350px] h-full bg-card border-l border-border p-4 overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">Audio</h2>
        
        {selectedChunk ? (
          <div>
            {/* Header cu preview text */}
            <div className="mb-4 p-3 bg-background rounded-md border border-border">
              <div className="text-xs text-secondary mb-1">Chunk selectat</div>
              <div className="text-sm line-clamp-3">
                {selectedChunk.text.substring(0, 100)}
                {selectedChunk.text.length > 100 && "..."}
              </div>
            </div>

            {/* Status audio */}
            {selectedChunk.hasAudio ? (
              <div className="space-y-3">
                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-md">
                  <div className="text-sm text-green-400">✓ Audio generat</div>
                  <div className="text-xs text-secondary mt-1">
                    Playback-ul va fi implementat în Faza 6.
                  </div>
                </div>
              </div>
            ) : selectedChunk.isGenerating ? (
              <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-md">
                <div className="text-sm text-blue-400 animate-pulse">
                  ⏳ Se generează audio...
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-gray-500/10 border border-gray-500/30 rounded-md">
                  <div className="text-sm text-secondary">
                    Nu există audio pentru acest chunk.
                  </div>
                </div>
                <button
                  className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
                  onClick={() => console.log("Generează audio - va fi implementat în Faza 5")}
                >
                  Generează Audio
                </button>
              </div>
            )}

            {/* Buton regenerare */}
            {selectedChunk.hasAudio && (
              <button
                className="w-full mt-3 px-4 py-2 bg-secondary/20 text-foreground rounded-md hover:bg-secondary/30 transition-colors text-sm"
                onClick={() => console.log("Regenerează - va fi implementat în Faza 6")}
              >
                🔄 Regenerează Audio
              </button>
            )}
          </div>
        ) : (
          <div className="text-sm text-secondary text-center py-8">
            Selectează un chunk din editor pentru a vedea opțiunile audio.
          </div>
        )}

        {/* Separator */}
        <div className="my-6 border-t border-border" />

        {/* Export Section */}
        <div>
          <h3 className="text-md font-semibold mb-3">Export</h3>
          <button
            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium mb-2"
            onClick={() => console.log("Export - va fi implementat în Faza 9")}
          >
            Export Final MP3
          </button>
          <button
            className="w-full px-4 py-2 bg-red-500/20 text-red-400 rounded-md hover:bg-red-500/30 transition-colors text-sm"
            onClick={() => console.log("Șterge toate - va fi implementat")}
          >
            Șterge Toate Audio-urile
          </button>
        </div>
      </div>
    </div>
  );
}
