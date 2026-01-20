"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";

// Tipuri pentru chunk-uri
export interface ChunkData {
  id: string;
  text: string;
  order: number;
  hasAudio: boolean;
  isGenerating: boolean;
  activeVariantId: string | null;
  // Câmpuri noi v4
  useCustomSettings?: boolean;
  customVoiceId?: string | null;
  customVoiceSettings?: {
    stability: number;
    similarity: number;
    style: number;
    speed: number;
    model: string;
    speakerBoost: boolean;
  } | null;
}

interface TextEditorProps {
  projectId: string;
  initialChunks: ChunkData[];
  onChunkSelect?: (chunkIndex: number | null) => void;
  onChunksUpdate?: (chunks: ChunkData[]) => void;
  selectedChunkIndex?: number | null;
}

// Constante
const MAX_CHUNK_LENGTH = 5000;
const AUTOSAVE_DELAY = 2000; // 2 secunde

export default function TextEditor({
  projectId,
  initialChunks,
  onChunkSelect,
  onChunksUpdate,
  selectedChunkIndex,
}: TextEditorProps) {
  const [chunks, setChunks] = useState<ChunkData[]>(initialChunks);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [lastSavedText, setLastSavedText] = useState<string>("");
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Calculează chunk-uri peste limită
  const chunksOverLimit = chunks.filter((chunk) => chunk.text.length > MAX_CHUNK_LENGTH);

  // Inițializează textul din chunk-uri
  useEffect(() => {
    const initialText = initialChunks.map((c) => c.text).join("\n");
    setLastSavedText(initialText);
    setChunks(initialChunks.length > 0 ? initialChunks : [{
      id: "temp-0",
      text: "",
      order: 0,
      hasAudio: false,
      isGenerating: false,
      activeVariantId: null,
    }]);
  }, [initialChunks]);

  // Salvare către API
  const saveText = useCallback(async (chunksToSave: ChunkData[]) => {
    const text = chunksToSave.map(c => c.text).join("\n");
    if (text === lastSavedText) {
      setSaveStatus("saved");
      return;
    }

    setSaveStatus("saving");

    try {
      const response = await fetch(`/api/projects/${projectId}/text`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_text: text }),
      });

      if (!response.ok) {
        throw new Error("Eroare la salvare");
      }

      const data = await response.json();
      
      // Actualizăm chunk-urile cu datele din server
      if (data.chunks && data.chunks.length > 0) {
        setChunks(data.chunks);
        onChunksUpdate?.(data.chunks);
      }
      setLastSavedText(text);
      setSaveStatus("saved");
    } catch (error) {
      console.error("Eroare la salvare:", error);
      setSaveStatus("unsaved");
    }
  }, [projectId, lastSavedText, onChunksUpdate]);

  // Trigger autosave
  const triggerAutosave = useCallback((newChunks: ChunkData[]) => {
    setSaveStatus("unsaved");
    
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }

    autosaveTimeoutRef.current = setTimeout(() => {
      saveText(newChunks);
    }, AUTOSAVE_DELAY);
  }, [saveText]);

  // Handler pentru modificarea textului unui chunk
  const handleChunkChange = useCallback((index: number, newText: string) => {
    const newChunks = [...chunks];
    newChunks[index] = { ...newChunks[index], text: newText };
    setChunks(newChunks);
    triggerAutosave(newChunks);
  }, [chunks, triggerAutosave]);

  // Handler pentru Enter, Backspace și Delete
  const handleKeyDown = useCallback((e: React.KeyboardEvent, index: number) => {
    const textarea = e.target as HTMLTextAreaElement;
    
    // Salvare manuală cu Ctrl+S / Cmd+S
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      saveText(chunks);
      return;
    }

    // Enter - creează chunk nou
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      
      const cursorPosition = textarea.selectionStart;
      const textBefore = chunks[index].text.substring(0, cursorPosition);
      const textAfter = chunks[index].text.substring(cursorPosition);
      
      const newChunks = [...chunks];
      newChunks[index] = { ...newChunks[index], text: textBefore };
      newChunks.splice(index + 1, 0, {
        id: `temp-${Date.now()}`,
        text: textAfter,
        order: index + 1,
        hasAudio: false,
        isGenerating: false,
        activeVariantId: null,
      });
      
      // Reordonăm
      newChunks.forEach((chunk, i) => {
        chunk.order = i;
      });
      
      setChunks(newChunks);
      triggerAutosave(newChunks);
      
      // Focus pe noul chunk
      setTimeout(() => {
        const nextTextarea = document.querySelector(`[data-chunk-index="${index + 1}"]`) as HTMLTextAreaElement;
        if (nextTextarea) {
          nextTextarea.focus();
          nextTextarea.setSelectionRange(0, 0);
        }
      }, 0);
    }
    
    // Backspace la începutul chunk-ului - unește cu chunk-ul anterior
    if (e.key === "Backspace" && textarea.selectionStart === 0 && textarea.selectionEnd === 0 && index > 0) {
      e.preventDefault();
      
      const prevChunk = chunks[index - 1];
      const currentChunk = chunks[index];
      const cursorPosition = prevChunk.text.length;
      
      const newChunks = [...chunks];
      newChunks[index - 1] = {
        ...prevChunk,
        text: prevChunk.text + currentChunk.text,
        hasAudio: false, // Invalidăm audio-ul când unim
      };
      newChunks.splice(index, 1);
      
      // Reordonăm
      newChunks.forEach((chunk, i) => {
        chunk.order = i;
      });
      
      setChunks(newChunks);
      triggerAutosave(newChunks);
      
      // Focus pe chunk-ul anterior la poziția de unire
      setTimeout(() => {
        const prevTextarea = document.querySelector(`[data-chunk-index="${index - 1}"]`) as HTMLTextAreaElement;
        if (prevTextarea) {
          prevTextarea.focus();
          prevTextarea.setSelectionRange(cursorPosition, cursorPosition);
        }
      }, 0);
    }

    // Delete la finalul chunk-ului - unește cu chunk-ul următor
    if (e.key === "Delete" && textarea.selectionStart === textarea.selectionEnd && textarea.selectionStart === chunks[index].text.length && index < chunks.length - 1) {
      e.preventDefault();
      
      const currentChunk = chunks[index];
      const nextChunk = chunks[index + 1];
      const cursorPosition = currentChunk.text.length;
      
      const newChunks = [...chunks];
      newChunks[index] = {
        ...currentChunk,
        text: currentChunk.text + nextChunk.text,
        hasAudio: false, // Invalidăm audio-ul când unim
      };
      newChunks.splice(index + 1, 1);
      
      // Reordonăm
      newChunks.forEach((chunk, i) => {
        chunk.order = i;
      });
      
      setChunks(newChunks);
      triggerAutosave(newChunks);
      
      // Păstrăm focus pe chunk-ul curent la poziția de unire
      setTimeout(() => {
        const currentTextarea = document.querySelector(`[data-chunk-index="${index}"]`) as HTMLTextAreaElement;
        if (currentTextarea) {
          currentTextarea.focus();
          currentTextarea.setSelectionRange(cursorPosition, cursorPosition);
        }
      }, 0);
    }
  }, [chunks, saveText, triggerAutosave]);

  // Handler pentru click pe chunk
  const handleChunkClick = useCallback((index: number) => {
    onChunkSelect?.(index);
  }, [onChunkSelect]);

  // Handler pentru paste
  const handlePaste = useCallback((e: React.ClipboardEvent, index: number) => {
    const pastedText = e.clipboardData.getData("text/plain");
    
    // Dacă textul paste-uit conține Enter-uri, creăm chunk-uri multiple
    if (pastedText.includes("\n")) {
      e.preventDefault();
      
      const textarea = e.target as HTMLTextAreaElement;
      const cursorPosition = textarea.selectionStart;
      const currentText = chunks[index].text;
      
      const textBefore = currentText.substring(0, cursorPosition);
      const textAfter = currentText.substring(textarea.selectionEnd);
      
      const pastedLines = pastedText.split("\n");
      
      const newChunks = [...chunks];
      
      // Primul chunk: text înainte + prima linie paste-uită
      newChunks[index] = { 
        ...newChunks[index], 
        text: textBefore + pastedLines[0],
        hasAudio: false,
      };
      
      // Chunk-uri noi pentru liniile din mijloc și ultima
      const additionalChunks = pastedLines.slice(1).map((line, i) => ({
        id: `temp-${Date.now()}-${i}`,
        text: i === pastedLines.length - 2 ? line + textAfter : line,
        order: index + 1 + i,
        hasAudio: false,
        isGenerating: false,
        activeVariantId: null,
      }));
      
      newChunks.splice(index + 1, 0, ...additionalChunks);
      
      // Reordonăm
      newChunks.forEach((chunk, i) => {
        chunk.order = i;
      });
      
      setChunks(newChunks);
      triggerAutosave(newChunks);
    }
  }, [chunks, triggerAutosave]);

  // Generează toate chunk-urile fără audio
  const handleGenerateAll = useCallback(() => {
    console.log("Generează toate - va fi implementat în Faza 7");
  }, []);

  // Cleanup la unmount
  useEffect(() => {
    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, []);

  // Obține clasa pentru border în funcție de status
  const getBorderClass = (chunk: ChunkData, isSelected: boolean) => {
    let borderColor = "border-gray-400"; // Fără audio
    
    if (chunk.isGenerating) {
      borderColor = "border-blue-500 animate-pulse";
    } else if (chunk.hasAudio) {
      borderColor = "border-green-500";
    }
    
    const bgColor = isSelected ? "bg-blue-500/10" : "";
    const warningBg = chunk.text.length > MAX_CHUNK_LENGTH ? "bg-red-500/10" : "";
    
    return `${borderColor} ${bgColor} ${warningBg}`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header Editor */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <h2 className="text-lg font-semibold">Text Editor</h2>
        <div className="text-sm text-secondary">
          {saveStatus === "saving" && "Se salvează..."}
          {saveStatus === "saved" && "Salvat ✓"}
          {saveStatus === "unsaved" && "Nesalvat"}
        </div>
      </div>

      {/* Warning pentru chunk-uri prea lungi */}
      {chunksOverLimit.length > 0 && (
        <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/30 text-red-400 text-sm">
          ⚠️ {chunksOverLimit.length} chunk-{chunksOverLimit.length === 1 ? "ul depășește" : "uri depășesc"} limita de {MAX_CHUNK_LENGTH} caractere. 
          ElevenLabs va refuza generarea. Te rog să le împarți (adaugă Enter).
        </div>
      )}

      {/* Editor Area */}
      <div className="flex-1 p-4 overflow-y-auto bg-background">
        {chunks.map((chunk, index) => (
          <div
            key={chunk.id}
            className={`relative mb-2`}
          >
            <textarea
              data-chunk-index={index}
              value={chunk.text}
              onChange={(e) => handleChunkChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              onClick={() => handleChunkClick(index)}
              onPaste={(e) => handlePaste(e, index)}
              placeholder={index === 0 ? "Scrie sau lipește textul aici..." : ""}
              className={`w-full min-h-[60px] p-3 pl-4 border-l-4 resize-none bg-transparent focus:outline-none focus:ring-1 focus:ring-primary/30 rounded-r ${getBorderClass(chunk, selectedChunkIndex === index)}`}
              style={{ 
                borderLeftWidth: "4px",
                height: "auto",
              }}
              rows={Math.max(2, Math.ceil(chunk.text.length / 80))}
            />
            {/* Icon pentru setări custom */}
            {chunk.useCustomSettings && (
              <div className="absolute top-1 right-2 text-sm" title="Acest chunk are setări custom">
                ⚙️
              </div>
            )}
            {/* Warning pentru chunk prea lung */}
            {chunk.text.length > MAX_CHUNK_LENGTH && (
              <div className={`absolute top-1 ${chunk.useCustomSettings ? 'right-8' : 'right-2'} text-xs text-red-400`}>
                {chunk.text.length}/{MAX_CHUNK_LENGTH}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer cu butonul Generează Toate */}
      <div className="px-4 py-3 border-t border-border bg-card">
        <div className="flex items-center justify-end">
          <button
            onClick={handleGenerateAll}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            Generează Toate
          </button>
        </div>
      </div>
    </div>
  );
}
