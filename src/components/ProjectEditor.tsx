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
  usedVoiceSettings: {
    stability?: number;
    similarity?: number;
    style?: number;
    speed?: number;
    model?: string;
  } | null;
  hasAudio: boolean;
  createdAt: string;
}

interface Voice {
  voice_id: string;
  name: string;
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

  // State pentru voices (pentru afișarea numelui vocii)
  const [voices, setVoices] = useState<Voice[]>([]);

  // Încarcă lista de voci
  useEffect(() => {
    const loadVoices = async () => {
      try {
        const response = await fetch("/api/voices");
        if (response.ok) {
          const data = await response.json();
          setVoices(data.voices || []);
        }
      } catch (err) {
        console.error("Eroare la încărcarea vocilor:", err);
      }
    };
    loadVoices();
  }, []);

  // Funcție pentru a obține numele vocii
  const getVoiceName = (voiceId: string | null) => {
    if (!voiceId) return "Necunoscută";
    const voice = voices.find(v => v.voice_id === voiceId);
    return voice?.name || voiceId.substring(0, 8) + "...";
  };

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
    console.log("Selectare toate chunk-urile - total:", chunks.length);
  }, [chunks]);

  // Generează audio pentru un chunk (5 variante)
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

      // Setează variantele din răspuns
      setAudioVariants(data.variants || []);

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

  // Activează o variantă
  const handleActivateVariant = useCallback(async (variantId: string) => {
    try {
      const response = await fetch(`/api/variants/${variantId}/activate`, {
        method: "PUT",
      });

      if (response.ok) {
        // Actualizează local variantele
        setAudioVariants(prev => prev.map(v => ({
          ...v,
          isActive: v.id === variantId
        })));
      }
    } catch (err) {
      console.error("Eroare la activarea variantei:", err);
    }
  }, []);

  // Șterge o variantă
  const handleDeleteVariant = useCallback(async (variantId: string) => {
    if (!confirm("Sigur vrei să ștergi această variantă?")) return;

    try {
      const response = await fetch(`/api/variants/${variantId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        // Reîncarcă variantele
        if (selectedChunkIndex !== null && chunks[selectedChunkIndex]) {
          const variantsResponse = await fetch(`/api/chunks/${chunks[selectedChunkIndex].id}/generate`);
          if (variantsResponse.ok) {
            const variantsData = await variantsResponse.json();
            setAudioVariants(variantsData.variants || []);
          }
        }
        
        // Dacă varianta ștearsă era cea din player, oprește
        if (currentAudioVariantId === variantId) {
          handleStop();
          setCurrentAudioVariantId(null);
          setCurrentChunkForPlayer(null);
        }
        
        // Reîncarcă chunk-urile pentru a actualiza statusul hasAudio
        await loadChunks();
      }
    } catch (err) {
      console.error("Eroare la ștergerea variantei:", err);
    }
  }, [selectedChunkIndex, chunks, currentAudioVariantId, loadChunks]);

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

  // Numărul de variante cu audio generat
  const completedVariants = audioVariants.filter(v => v.hasAudio && v.status === "done").length;

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
        <div className="w-[350px] min-w-[350px] h-full bg-card border-l border-border flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex-shrink-0 p-4 pb-2">
            <h2 className="text-lg font-semibold">Audio</h2>
          </div>
          
          {selectedChunk ? (
            <>
              {/* Zona scrollabilă cu variante */}
              <div className="flex-1 overflow-y-auto px-4">
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

                {/* Status generare */}
                {isGenerating && (
                  <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-md">
                    <div className="text-sm text-blue-400 animate-pulse flex items-center gap-2">
                      <span className="animate-spin">⏳</span>
                      Se generează 5 variante audio...
                    </div>
                  </div>
                )}

                {/* Mesaj când nu există variante */}
                {audioVariants.length === 0 && !isGenerating && (
                  <div className="p-3 bg-gray-500/10 border border-gray-500/30 rounded-md">
                    <div className="text-sm text-secondary">
                      Nu există audio pentru acest chunk.
                    </div>
                  </div>
                )}

                {/* Lista variantelor */}
                {audioVariants.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <h4 className="text-sm font-medium">
                        Variante ({completedVariants})
                      </h4>
                    </div>
                    
                    <div className="space-y-2 pb-2">
                      {audioVariants.map((variant) => (
                        <div
                          key={variant.id}
                          className={`p-3 rounded-md border transition-colors ${
                            variant.isActive 
                              ? 'border-green-500 bg-green-500/10' 
                              : 'border-border bg-background hover:border-border/80'
                          }`}
                        >
                          {/* Header variantă */}
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              {/* Radio button pentru activare */}
                              <button
                                onClick={() => variant.hasAudio && handleActivateVariant(variant.id)}
                                disabled={!variant.hasAudio || variant.status !== "done"}
                                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                                  variant.isActive 
                                    ? 'border-green-500 bg-green-500' 
                                    : variant.hasAudio 
                                      ? 'border-gray-400 hover:border-green-400' 
                                      : 'border-gray-600 cursor-not-allowed'
                                }`}
                              >
                                {variant.isActive && (
                                  <div className="w-2 h-2 rounded-full bg-white" />
                                )}
                              </button>
                              
                              <span className="font-medium text-sm">
                                Varianta {variant.variantNumber}
                              </span>
                              
                              {variant.isActive && (
                                <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded">
                                  Activă
                                </span>
                              )}
                            </div>
                            
                            {/* Butoane acțiuni */}
                            <div className="flex items-center gap-1">
                              {variant.hasAudio && variant.status === "done" && (
                                <button
                                  onClick={() => {
                                    if (currentAudioVariantId === variant.id && isPlaying) {
                                      // Dacă această variantă se redă, o punem pe pauză
                                      audioRef.current?.pause();
                                    } else {
                                      // Altfel, o redăm
                                      handlePlayChunk(selectedChunk, variant.id);
                                    }
                                  }}
                                  className={`p-1.5 rounded transition-colors ${
                                    currentAudioVariantId === variant.id && isPlaying
                                      ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                                      : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                                  }`}
                                  title={currentAudioVariantId === variant.id && isPlaying ? "Pauză" : "Redă"}
                                >
                                  {currentAudioVariantId === variant.id && isPlaying ? '⏸' : '▶'}
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteVariant(variant.id)}
                                className="p-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
                                title="Șterge"
                              >
                                🗑
                              </button>
                            </div>
                          </div>
                          
                          {/* Status */}
                          {variant.status === "processing" && (
                            <div className="text-xs text-blue-400 animate-pulse">
                              ⏳ Se generează...
                            </div>
                          )}
                          
                          {variant.status === "error" && (
                            <div className="text-xs text-red-400">
                              ❌ {variant.errorMessage || "Eroare la generare"}
                            </div>
                          )}
                          
                          {/* Setări folosite */}
                          {variant.hasAudio && variant.status === "done" && variant.usedVoiceSettings && (
                            <div className="text-xs text-secondary mt-1">
                              <span className="text-foreground/70">{getVoiceName(variant.usedVoiceId)}</span>
                              {" • "}
                              Stab: {variant.usedVoiceSettings.stability || 50}
                              {" • "}
                              Sim: {variant.usedVoiceSettings.similarity || 75}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Buton generare - FIX în partea de jos */}
              <div className="flex-shrink-0 p-4 border-t border-border bg-card">
                <button
                  className={`w-full px-4 py-3 rounded-md text-sm font-medium transition-colors ${
                    isGenerating 
                      ? 'bg-blue-500/50 text-white cursor-not-allowed' 
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                  }`}
                  onClick={handleGenerateAudio}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin">⏳</span>
                      Se generează...
                    </span>
                  ) : (
                    '🎙️ Generează 5 Variante Audio'
                  )}
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center px-4">
              <div className="text-sm text-secondary text-center">
                Selectează un chunk din editor pentru a vedea opțiunile audio.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer fix cu Player Audio - ÎNTOTDEAUNA VIZIBIL */}
      <div className="h-16 min-h-16 bg-card border-t border-border px-4 flex items-center gap-4">
        {/* Audio element hidden */}
        {currentAudioVariantId && (
          <audio
            ref={audioRef}
            src={`/api/audio/${currentAudioVariantId}`}
            onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
            onLoadedMetadata={() => {
              setDuration(audioRef.current?.duration || 0);
              audioRef.current?.play();
            }}
            onEnded={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
        )}
        
        {currentAudioVariantId && currentChunkForPlayer ? (
          <>
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
          </>
        ) : (
          /* Placeholder când nu se redă nimic */
          <div className="flex-1 flex items-center justify-center text-secondary text-sm">
            <span>🎧 Selectează o variantă audio pentru a o reda</span>
          </div>
        )}
      </div>
    </div>
  );
}
