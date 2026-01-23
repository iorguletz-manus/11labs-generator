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
  onSelectAll?: () => void; // Callback pentru Ctrl+A
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
  onSelectAll,
}: TextEditorProps) {
  const [chunks, setChunks] = useState<ChunkData[]>(initialChunks);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [lastSavedText, setLastSavedText] = useState<string>("");
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

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

  // Funcție pentru a verifica dacă cursorul este pe primul rând LOGIC (bazat pe \n)
  // Aceasta verifică dacă nu există niciun \n înainte de cursor
  const isOnFirstLine = (textarea: HTMLTextAreaElement): boolean => {
    const cursorPosition = textarea.selectionStart;
    const textBeforeCursor = textarea.value.substring(0, cursorPosition);
    return !textBeforeCursor.includes('\n');
  };

  // Funcție pentru a verifica dacă cursorul este pe ultimul rând LOGIC (bazat pe \n)
  const isOnLastLine = (textarea: HTMLTextAreaElement): boolean => {
    const cursorPosition = textarea.selectionStart;
    const textAfterCursor = textarea.value.substring(cursorPosition);
    return !textAfterCursor.includes('\n');
  };

  // Funcție pentru a verifica dacă săgeata sus ar trebui să navigheze la chunk-ul anterior
  // Returnează true doar dacă cursorul este pe primul rând ȘI la începutul acestuia
  const shouldNavigateToPrevChunk = (textarea: HTMLTextAreaElement): boolean => {
    const cursorPosition = textarea.selectionStart;
    // Dacă cursorul este la poziția 0, sigur trebuie să trecem la chunk-ul anterior
    if (cursorPosition === 0) return true;
    // Altfel, nu navigam - lasăm browser-ul să mute cursorul în sus
    return false;
  };

  // Funcție pentru a verifica dacă săgeata jos ar trebui să navigheze la chunk-ul următor
  // Returnează true doar dacă cursorul este pe ultimul rând ȘI la sfârșitul acestuia
  const shouldNavigateToNextChunk = (textarea: HTMLTextAreaElement): boolean => {
    const cursorPosition = textarea.selectionStart;
    const textLength = textarea.value.length;
    // Dacă cursorul este la sfârșitul textului, sigur trebuie să trecem la chunk-ul următor
    if (cursorPosition === textLength) return true;
    // Altfel, nu navigam - lasăm browser-ul să mute cursorul în jos
    return false;
  };

  // Handler pentru Enter, Backspace, Delete, săgeți și Ctrl+A
  const handleKeyDown = useCallback((e: React.KeyboardEvent, index: number) => {
    const textarea = e.target as HTMLTextAreaElement;
    
    // Salvare manuală cu Ctrl+S / Cmd+S
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      saveText(chunks);
      return;
    }

    // Ctrl+A - selectează toate chunk-urile
    if ((e.ctrlKey || e.metaKey) && e.key === "a") {
      e.preventDefault();
      onSelectAll?.();
      return;
    }

    // Săgeată sus - navighează la chunk-ul anterior DOAR dacă cursorul este la poziția 0
    if (e.key === "ArrowUp" && index > 0 && shouldNavigateToPrevChunk(textarea)) {
      e.preventDefault();
      const prevTextarea = document.querySelector(`[data-chunk-index="${index - 1}"]`) as HTMLTextAreaElement;
      if (prevTextarea) {
        prevTextarea.focus();
        // Poziționează cursorul la sfârșitul textului din chunk-ul anterior
        prevTextarea.setSelectionRange(prevTextarea.value.length, prevTextarea.value.length);
        onChunkSelect?.(index - 1);
      }
      return;
    }

    // Săgeată jos - navighează la chunk-ul următor DOAR dacă cursorul este la sfârșitul textului
    if (e.key === "ArrowDown" && index < chunks.length - 1 && shouldNavigateToNextChunk(textarea)) {
      e.preventDefault();
      const nextTextarea = document.querySelector(`[data-chunk-index="${index + 1}"]`) as HTMLTextAreaElement;
      if (nextTextarea) {
        nextTextarea.focus();
        // Poziționează cursorul la începutul textului din chunk-ul următor
        nextTextarea.setSelectionRange(0, 0);
        onChunkSelect?.(index + 1);
      }
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
          onChunkSelect?.(index + 1);
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
          onChunkSelect?.(index - 1);
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
  }, [chunks, saveText, triggerAutosave, onChunkSelect, onSelectAll]);

  // Handler pentru click pe chunk
  const handleChunkClick = useCallback((index: number) => {
    onChunkSelect?.(index);
  }, [onChunkSelect]);

  // Auto-resize textarea pentru a se potrivi exact cu continutul
  const autoResizeTextarea = useCallback((textarea: HTMLTextAreaElement) => {
    // Reset height pentru a obtine scrollHeight corect
    textarea.style.height = 'auto';
    // Seteaza height la scrollHeight (continut + padding intern)
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, []);

  // Effect pentru auto-resize la toate textarea-urile cand se schimba chunks
  useEffect(() => {
    chunks.forEach((_, index) => {
      const textarea = document.querySelector(`[data-chunk-index="${index}"]`) as HTMLTextAreaElement;
      if (textarea) {
        autoResizeTextarea(textarea);
      }
    });
  }, [chunks, autoResizeTextarea]);

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
      
      // Split pe \n și filtrăm liniile goale, apoi facem trim pe fiecare linie
      const pastedLines = pastedText
        .split("\n")
        .map(line => line.trim())  // Elimină spațiile și enter-urile de la început/sfârșit
        .filter(line => line.length > 0);  // Elimină liniile goale
      
      // Dacă după filtrare nu mai avem linii, nu facem nimic
      if (pastedLines.length === 0) return;
      
      const newChunks = [...chunks];
      
      // Primul chunk: text înainte + prima linie paste-uită
      const firstLineText = (textBefore + pastedLines[0]).trim();
      newChunks[index] = { 
        ...newChunks[index], 
        text: firstLineText,
        hasAudio: false,
      };
      
      // Chunk-uri noi pentru liniile din mijloc și ultima
      const additionalChunks = pastedLines.slice(1).map((line, i) => {
        // Ultima linie primește textul de după cursor
        const isLastLine = i === pastedLines.length - 2;
        const lineText = isLastLine ? (line + textAfter).trim() : line;
        
        return {
          id: `temp-${Date.now()}-${i}`,
          text: lineText,
          order: index + 1 + i,
          hasAudio: false,
          isGenerating: false,
          activeVariantId: null,
        };
      });
      
      newChunks.splice(index + 1, 0, ...additionalChunks);
      
      // Reordonăm
      newChunks.forEach((chunk, i) => {
        chunk.order = i;
      });
      
      setChunks(newChunks);
      triggerAutosave(newChunks);
    }
  }, [chunks, triggerAutosave]);

  // Handler pentru click în afara chunk-urilor
  const handleEditorClick = useCallback((e: React.MouseEvent) => {
    // Verifică dacă click-ul a fost direct pe container, nu pe un textarea
    if (e.target === editorRef.current) {
      onChunkSelect?.(null);
    }
  }, [onChunkSelect]);

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
    const classes: string[] = [];
    
    // Border color based on audio status
    if (chunk.isGenerating) {
      classes.push("border-blue-500");
      classes.push("shadow-[0_0_10px_rgba(59,130,246,0.5)]"); // Glow effect
    } else if (chunk.hasAudio) {
      classes.push("border-green-500");
    } else {
      classes.push("border-gray-400");
    }
    
    // Background for selected chunk - mai vizibil
    if (isSelected) {
      classes.push("bg-slate-700/50"); // Background mai închis pentru selecție
      classes.push("ring-2 ring-primary/50"); // Ring pentru vizibilitate
    }
    
    // Warning background for chunks over limit
    if (chunk.text.length > MAX_CHUNK_LENGTH) {
      classes.push("bg-red-500/10");
    }
    
    return classes.join(" ");
  };
  
  // Obține stilul pentru animație pulse
  const getPulseStyle = (chunk: ChunkData) => {
    if (chunk.isGenerating) {
      return {
        animation: "pulse 1.5s ease-in-out infinite",
      };
    }
    return {};
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header Editor */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <h2 className="text-lg font-semibold">Text Editor</h2>
        <div className="flex items-center gap-4">
          <span className="text-xs text-secondary">
            {chunks.length} chunk{chunks.length !== 1 ? '-uri' : ''}
          </span>
          <div className="text-sm text-secondary">
            {saveStatus === "saving" && "Se salvează..."}
            {saveStatus === "saved" && "Salvat ✓"}
            {saveStatus === "unsaved" && "Nesalvat"}
          </div>
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
      <div 
        ref={editorRef}
        className="flex-1 p-4 overflow-y-auto bg-background"
        onClick={handleEditorClick}
      >
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
              onClick={(e) => {
                e.stopPropagation();
                handleChunkClick(index);
              }}
              onPaste={(e) => handlePaste(e, index)}
              placeholder={index === 0 ? "Scrie sau lipește textul aici..." : ""}
              className={`w-full min-h-[60px] p-3 pl-4 border-l-4 resize-none bg-transparent focus:outline-none focus:ring-1 focus:ring-primary/30 rounded-r transition-all duration-300 ${getBorderClass(chunk, selectedChunkIndex === index)}`}
              style={{ 
                borderLeftWidth: "4px",
                overflow: "hidden",
                ...getPulseStyle(chunk),
              }}
              onInput={(e) => autoResizeTextarea(e.target as HTMLTextAreaElement)}
              ref={(el) => el && autoResizeTextarea(el)}
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
    </div>
  );
}
