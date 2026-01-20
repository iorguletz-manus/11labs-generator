"use client";

import { useState, useEffect, useCallback } from "react";
import ProjectSettings, { VoiceSettingsData } from "./ProjectSettings";
import ChunkSettings from "./ChunkSettings";

interface Voice {
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
}

interface Model {
  model_id: string;
  name: string;
  description: string;
}

interface ChunkData {
  id: string;
  text: string;
  order: number;
  useCustomSettings: boolean;
  customVoiceId: string | null;
  customVoiceSettings: VoiceSettingsData | null;
}

interface VoiceSettingsProps {
  projectId: string;
  selectedChunk?: ChunkData | null;
  selectedChunkIndex?: number | null;
  onChunkSettingsChange?: () => void;
}

const DEFAULT_SETTINGS: VoiceSettingsData = {
  stability: 50,
  similarity: 75,
  style: 0,
  speed: 1.0,
  model: "eleven_multilingual_v2",
  speakerBoost: true,
};

export default function VoiceSettings({ 
  projectId, 
  selectedChunk,
  selectedChunkIndex,
  onChunkSettingsChange 
}: VoiceSettingsProps) {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(true);
  const [loadingModels, setLoadingModels] = useState(true);
  const [projectVoiceId, setProjectVoiceId] = useState<string>("");
  const [projectSettings, setProjectSettings] = useState<VoiceSettingsData>(DEFAULT_SETTINGS);

  // Încarcă vocile
  useEffect(() => {
    async function loadVoices() {
      try {
        setLoadingVoices(true);
        const response = await fetch("/api/voices");
        if (response.ok) {
          const data = await response.json();
          setVoices(data.voices || []);
        }
      } catch (err) {
        console.error("Eroare la încărcarea vocilor:", err);
      } finally {
        setLoadingVoices(false);
      }
    }

    loadVoices();
  }, []);

  // Încarcă modelele
  useEffect(() => {
    async function loadModels() {
      try {
        setLoadingModels(true);
        const response = await fetch("/api/models");
        if (response.ok) {
          const data = await response.json();
          setModels(data.models || []);
        }
      } catch (err) {
        console.error("Eroare la încărcarea modelelor:", err);
      } finally {
        setLoadingModels(false);
      }
    }

    loadModels();
  }, []);

  // Încarcă setările proiectului
  useEffect(() => {
    async function loadProjectSettings() {
      try {
        const response = await fetch(`/api/projects/${projectId}/voice`);
        if (response.ok) {
          const data = await response.json();
          if (data.voiceId) {
            setProjectVoiceId(data.voiceId);
          }
          if (data.settings) {
            setProjectSettings({
              stability: data.settings.stability ?? 50,
              similarity: data.settings.similarity ?? 75,
              style: data.settings.style ?? 0,
              speed: data.settings.speed ?? 1.0,
              model: data.settings.model ?? "eleven_multilingual_v2",
              speakerBoost: data.settings.speakerBoost ?? true,
            });
          }
        }
      } catch (err) {
        console.error("Eroare la încărcarea setărilor proiectului:", err);
      }
    }

    loadProjectSettings();
  }, [projectId]);

  // Handler pentru schimbarea setărilor proiectului
  const handleProjectSettingsChange = useCallback((voiceId: string, settings: VoiceSettingsData) => {
    setProjectVoiceId(voiceId);
    setProjectSettings(settings);
  }, []);

  if (loadingVoices || loadingModels) {
    return (
      <div className="p-4 space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-3/4"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-2 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Secțiunea 1: Setări Proiect (Default) */}
      <div className="p-4 border-b border-gray-200">
        <ProjectSettings
          projectId={projectId}
          voices={voices}
          models={models}
          onSettingsChange={handleProjectSettingsChange}
        />
      </div>

      {/* Secțiunea 2: Setări Chunk Selectat */}
      <div className="flex-1 p-4 overflow-y-auto">
        {selectedChunk && selectedChunkIndex !== null && selectedChunkIndex !== undefined ? (
          <ChunkSettings
            chunkId={selectedChunk.id}
            chunkIndex={selectedChunkIndex}
            voices={voices}
            models={models}
            projectVoiceId={projectVoiceId}
            projectSettings={projectSettings}
            initialUseCustomSettings={selectedChunk.useCustomSettings}
            initialCustomVoiceId={selectedChunk.customVoiceId}
            initialCustomSettings={selectedChunk.customVoiceSettings}
            onSettingsChange={onChunkSettingsChange}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="text-4xl mb-3 opacity-50">📝</div>
            <p className="text-sm text-gray-500">
              Selectează un chunk din editor pentru a-i configura setările individuale.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
