"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import TextEditor, { ChunkData } from "./TextEditor";
import VoiceSettings from "./VoiceSettings";

interface ProjectEditorProps {
  projectId: string;
  projectName: string;
}

interface AudioVariant {
  id: string;
  variantNumber: number;
  status: string;
  progress: number;
  isActive: boolean;
  errorMessage: string | null;
  usedVoiceId: string | null;
  usedVoiceSettings: Record<string, unknown> | null;
  hasAudio: boolean;
  createdAt: string;
}

export default function ProjectEditor({ projectId, projectName }: ProjectEditorProps) {
  const [chunks, setChunks] = useState<ChunkData[]>([]);
  const [selectedChunkIndex, setSelectedChunkIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State pentru audio
  const [audioVariants, setAudioVariants] = useState<AudioVariant[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // State pentru player în footer
  const [currentAudioVariantId, setCurrentAudioVariantId] = useState<string | null>(null);
  const [currentChunkForPlayer, setCurrentChunkForPlayer] = useState<ChunkData | null>(null);

  // Funcție pentru reîncărcarea chunk-urilor
  const loadChunks = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/text`);
      
      if (!response.ok) {
        throw new Error("Eroare la încărcarea textului");
      }
      
      const data = await response.json();
      setChunks(data.chunks || []);
    } catch (err) {
      console.error("Eroare la încărcarea chunk-urilor:", err);
      setError("Nu s-a putut încărca textul proiectului");
    }
  }, [projectId]);

  // Încarcă chunk-urile la mount
  useEffect(() => {
    const initialLoad = async () => {
      setIsLoading(true);
      await loadChunks();
      setIsLoading(false);
    };

    initialLoad();
  }, [loadChunks]);

  // Încarcă variantele audio când se schimbă chunk-ul selectat
  useEffect(() => {
    const loadAudioVariants = async () => {
      if (selectedChunkIndex === null || !chunks[selectedChunkIndex]) {
        setAudioVariants([]);
        return;
      }

      const chunk = chunks[selectedChunkIndex];
      try {
        const response = await fetch(`/api/chunks/${chunk.id}/generate`);
        if (response.ok) {
          const data = await response.json();
          setAudioVariants(data.variants || []);
        }
      } catch (err) {
        console.error("Eroare la încărcarea variantelor audio:", err);
      }
    };

    loadAudioVariants();
  }, [selectedChunkIndex, chunks]);

  // Handler pentru selectarea unui chunk
  const handleChunkSelect = useCallback((chunkIndex: number | null) => {
    setSelectedChunkIndex(chunkIndex);
    setAudioError(null);
  }, []);

  // Handler pentru actualizarea chunk-urilor din TextEditor
  const handleChunksUpdate = useCallback((newChunks: ChunkData[]) => {
    setChunks(newChunks);
  }, []);

  // Handler pentru când se schimbă setările unui chunk
  const handleChunkSettingsChange = useCallback(() => {
    loadChunks();
  }, [loadChunks]);

  // Handler pentru Ctrl+A - selectează toate chunk-urile
  const handleSelectAll = useCallback(() => {
    // Selectează tot textul din toate chunk-urile
    // Pentru moment, selectăm primul chunk și afișăm un mesaj
    console.log("Selectare toate chunk-urile - total:", chunks.length);
    // Poți implementa o logică mai complexă aici dacă dorești
  }, [chunks]);

  // Generează audio pentru un chunk
  const handleGenerateAudio = useCallback(async () => {
    if (selectedChunkIndex === null || !chunks[selectedChunkIndex]) return;

    const chunk = chunks[selectedChunkIndex];
    setIsGenerating(true);
    setAudioError(null);

    try {
      const response = await fetch(`/api/chunks/${chunk.id}/generate`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        setAudioError(data.error || "Eroare la generarea audio");
        return;
      }

      // Reîncarcă variantele audio
      const variantsResponse = await fetch(`/api/chunks/${chunk.id}/generate`);
      if (variantsResponse.ok) {
        const variantsData = await variantsResponse.json();
        setAudioVariants(variantsData.variants || []);
      }

      // Actualizează chunk-ul pentru a reflecta că are audio
      await loadChunks();

    } catch (err) {
      console.error("Eroare la generarea audio:", err);
      setAudioError("Eroare de conexiune la server");
    } finally {
      setIsGenerating(false);
    }
  }, [selectedChunkIndex, chunks, loadChunks]);

  // Generează audio pentru toate chunk-urile fără audio
  const handleGenerateAll = useCallback(async () => {
    const chunksWithoutAudio = chunks.filter(c => !c.hasAudio && c.text.trim());
    
    if (chunksWithoutAudio.length === 0) {
      setAudioError("Toate chunk-urile au deja audio generat");
      return;
    }

    setGeneratingAll(true);
    setAudioError(null);

    for (const chunk of chunksWithoutAudio) {
      try {
        const response = await fetch(`/api/chunks/${chunk.id}/generate`, {
          method: "POST",
        });

        if (!response.ok) {
          const data = await response.json();
          console.error(`Eroare la chunk ${chunk.id}:`, data.error);
        }
      } catch (err) {
        console.error(`Eroare la generarea chunk ${chunk.id}:`, err);
      }
    }

    // Reîncarcă toate chunk-urile
    await loadChunks();
    
    // Reîncarcă variantele pentru chunk-ul selectat
    if (selectedChunkIndex !== null && chunks[selectedChunkIndex]) {
      const variantsResponse = await fetch(`/api/chunks/${chunks[selectedChunkIndex].id}/generate`);
      if (variantsResponse.ok) {
        const variantsData = await variantsResponse.json();
        setAudioVariants(variantsData.variants || []);
      }
    }

    setGeneratingAll(false);
  }, [chunks, loadChunks, selectedChunkIndex]);

  // Play audio pentru un chunk specific
  const handlePlayChunk = useCallback((chunk: ChunkData, variantId: string) => {
    // Oprește audio-ul curent dacă există
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    setCurrentAudioVariantId(variantId);
    setCurrentChunkForPlayer(chunk);
    setIsPlaying(true);
    setCurrentTime(0);
    setDuration(0);
    
    // Audio-ul va fi încărcat automat de elementul audio din footer
  }, []);

  // Playback audio
  const handlePlayPause = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  // Stop audio
  const handleStop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  // Seek audio
  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const newTime = parseFloat(e.target.value);
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  }, []);

  // Format time
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Chunk-ul selectat
  const selectedChunk = selectedChunkIndex !== null ? chunks[selectedChunkIndex] : null;
  
  // Varianta activă pentru chunk-ul selectat
  const activeVariant = audioVariants.find(v => v.isActive && v.hasAudio);

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
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Coloana 1 - Voice Settings (300px) */}
        <div className="w-[300px] min-w-[300px] h-full bg-card border-r border-border overflow-hidden">
          <VoiceSettings 
            projectId={projectId} 
            selectedChunk={selectedChunk ? {
              id: selectedChunk.id,
              text: selectedChunk.text,
              order: selectedChunk.order,
              useCustomSettings: selectedChunk.useCustomSettings || false,
              customVoiceId: selectedChunk.customVoiceId || null,
              customVoiceSettings: selectedChunk.customVoiceSettings || null,
            } : null}
            selectedChunkIndex={selectedChunkIndex}
            onChunkSettingsChange={handleChunkSettingsChange}
          />
        </div>

        {/* Coloana 2 - Text Editor (flexibil) */}
        <div className="flex-1 h-full bg-background flex flex-col overflow-hidden">
          {/* TextEditor cu overflow propriu */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <TextEditor
              projectId={projectId}
              initialChunks={chunks}
              onChunkSelect={handleChunkSelect}
              onChunksUpdate={handleChunksUpdate}
              selectedChunkIndex={selectedChunkIndex}
              onSelectAll={handleSelectAll}
            />
          </div>
          
          {/* Buton Generează Toate - întotdeauna vizibil, fix în partea de jos */}
          <div className="flex-shrink-0 p-4 border-t border-border bg-card">
            <button
              className={`w-full px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                generatingAll 
                  ? 'bg-blue-500/50 text-white cursor-not-allowed' 
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              }`}
              onClick={handleGenerateAll}
              disabled={generatingAll}
            >
              {generatingAll ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">⏳</span>
                  Se generează...
                </span>
              ) : (
                `Generează Toate (${chunks.filter(c => !c.hasAudio && c.text.trim()).length} chunk-uri)`
              )}
            </button>
          </div>
        </div>

        {/* Coloana 3 - Audio Panel (350px) */}
        <div className="w-[350px] min-w-[350px] h-full bg-card border-l border-border p-4 overflow-y-auto">
          <h2 className="text-lg font-semibold mb-4">Audio</h2>
          
          {selectedChunk ? (
            <div>
              {/* Header cu preview text */}
              <div className="mb-4 p-3 bg-background rounded-md border border-border">
                <div className="text-xs text-secondary mb-1">
                  Chunk #{selectedChunkIndex !== null ? selectedChunkIndex + 1 : '?'}
                  {selectedChunk.useCustomSettings && (
                    <span className="ml-2 text-blue-400">⚙️ Setări custom</span>
                  )}
                </div>
                <div className="text-sm line-clamp-3">
                  {selectedChunk.text.substring(0, 100)}
                  {selectedChunk.text.length > 100 && "..."}
                </div>
              </div>

              {/* Eroare */}
              {audioError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-md">
                  <div className="text-sm text-red-400">{audioError}</div>
                </div>
              )}

              {/* Status audio generat cu buton play */}
              {activeVariant && (
                <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-md">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-green-400">✓ Audio generat</div>
                    <button
                      onClick={() => handlePlayChunk(selectedChunk, activeVariant.id)}
                      className="px-3 py-1 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors text-sm flex items-center gap-1"
                    >
                      ▶ Play
                    </button>
                  </div>
                </div>
              )}

              {/* Status generare */}
              {isGenerating && (
                <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-md">
                  <div className="text-sm text-blue-400 animate-pulse flex items-center gap-2">
                    <span className="animate-spin">⏳</span>
                    Se generează audio...
                  </div>
                </div>
              )}

              {/* Buton generare */}
              {!activeVariant && !isGenerating && (
                <div className="space-y-3">
                  <div className="p-3 bg-gray-500/10 border border-gray-500/30 rounded-md">
                    <div className="text-sm text-secondary">
                      Nu există audio pentru acest chunk.
                    </div>
                  </div>
                  <button
                    className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
                    onClick={handleGenerateAudio}
                    disabled={isGenerating}
                  >
                    Generează Audio
                  </button>
                </div>
              )}

              {/* Buton regenerare */}
              {activeVariant && !isGenerating && (
                <button
                  className="w-full px-4 py-2 bg-secondary/20 text-foreground rounded-md hover:bg-secondary/30 transition-colors text-sm"
                  onClick={handleGenerateAudio}
                >
                  🔄 Regenerează Audio
                </button>
              )}

              {/* Lista variantelor */}
              {audioVariants.length > 1 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2">Variante ({audioVariants.length})</h4>
                  <div className="space-y-2">
                    {audioVariants.map((variant) => (
                      <div
                        key={variant.id}
                        className={`p-2 rounded-md border text-sm ${
                          variant.isActive 
                            ? 'border-green-500/50 bg-green-500/10' 
                            : 'border-border bg-background'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span>Varianta #{variant.variantNumber}</span>
                          <div className="flex items-center gap-2">
                            {variant.hasAudio && (
                              <button
                                onClick={() => handlePlayChunk(selectedChunk, variant.id)}
                                className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs hover:bg-green-500/30"
                              >
                                ▶
                              </button>
                            )}
                            {variant.isActive && <span className="text-green-400 text-xs">Activă</span>}
                          </div>
                        </div>
                        {variant.status === 'error' && (
                          <div className="text-red-400 text-xs mt-1">{variant.errorMessage}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
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
              onClick={() => console.log("Export - va fi implementat în Faza 7")}
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

      {/* Footer fix cu Player Audio */}
      {currentAudioVariantId && currentChunkForPlayer && (
        <div className="h-16 min-h-16 bg-card border-t border-border px-4 flex items-center gap-4">
          {/* Audio element hidden */}
          <audio
            ref={audioRef}
            src={`/api/audio/${currentAudioVariantId}`}
            onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
            onLoadedMetadata={() => {
              setDuration(audioRef.current?.duration || 0);
              // Auto-play când se încarcă
              audioRef.current?.play();
            }}
            onEnded={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
          
          {/* Info chunk */}
          <div className="w-48 min-w-48">
            <div className="text-xs text-secondary">
              Chunk #{chunks.findIndex(c => c.id === currentChunkForPlayer.id) + 1}
            </div>
            <div className="text-sm truncate">
              {currentChunkForPlayer.text.substring(0, 30)}...
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePlayPause}
              className="w-10 h-10 flex items-center justify-center bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors"
            >
              {isPlaying ? '⏸' : '▶'}
            </button>
            <button
              onClick={handleStop}
              className="w-8 h-8 flex items-center justify-center bg-gray-500 text-white rounded-full hover:bg-gray-600 transition-colors text-sm"
            >
              ⏹
            </button>
          </div>
          
          {/* Progress bar */}
          <div className="flex-1 flex items-center gap-3">
            <span className="text-xs text-secondary w-10">{formatTime(currentTime)}</span>
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-500"
            />
            <span className="text-xs text-secondary w-10">{formatTime(duration)}</span>
          </div>

          {/* Close button */}
          <button
            onClick={() => {
              handleStop();
              setCurrentAudioVariantId(null);
              setCurrentChunkForPlayer(null);
            }}
            className="w-8 h-8 flex items-center justify-center text-secondary hover:text-foreground transition-colors"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
