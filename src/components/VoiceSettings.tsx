"use client";

import { useState, useEffect, useCallback } from "react";
import { VoiceSettingsData } from "./ProjectSettings";

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
  useCustomSettings?: boolean;
  customVoiceId?: string | null;
  customVoiceSettings?: VoiceSettingsData | null;
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
  
  // Setări proiect (default)
  const [projectVoiceId, setProjectVoiceId] = useState<string>("");
  const [projectSettings, setProjectSettings] = useState<VoiceSettingsData>(DEFAULT_SETTINGS);
  const [savingProject, setSavingProject] = useState(false);
  
  // Setări chunk custom
  const [useCustomSettings, setUseCustomSettings] = useState(false);
  const [chunkVoiceId, setChunkVoiceId] = useState<string>("");
  const [chunkSettings, setChunkSettings] = useState<VoiceSettingsData>(DEFAULT_SETTINGS);
  const [savingChunk, setSavingChunk] = useState(false);

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

  // Actualizează starea când se schimbă chunk-ul selectat
  useEffect(() => {
    if (selectedChunk) {
      setUseCustomSettings(selectedChunk.useCustomSettings ?? false);
      setChunkVoiceId(selectedChunk.customVoiceId || projectVoiceId || "");
      setChunkSettings(selectedChunk.customVoiceSettings || projectSettings);
    } else {
      // Niciun chunk selectat - resetăm
      setUseCustomSettings(false);
      setChunkVoiceId("");
      setChunkSettings(DEFAULT_SETTINGS);
    }
  }, [selectedChunk, projectVoiceId, projectSettings]);

  // Salvează setările proiectului
  const saveProjectSettings = useCallback(async (voiceId: string, newSettings: VoiceSettingsData) => {
    try {
      setSavingProject(true);
      const response = await fetch(`/api/projects/${projectId}/voice`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voiceId: voiceId || null,
          settings: newSettings,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Eroare la salvare:", errorData.error);
      }
    } catch (err) {
      console.error("Eroare la salvarea setărilor:", err);
    } finally {
      setSavingProject(false);
    }
  }, [projectId]);

  // Salvează setările chunk-ului
  const saveChunkSettings = useCallback(async (
    useCustom: boolean, 
    voiceId: string, 
    newSettings: VoiceSettingsData
  ) => {
    if (!selectedChunk) return;
    
    try {
      setSavingChunk(true);
      const response = await fetch(`/api/chunks/${selectedChunk.id}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          useCustomSettings: useCustom,
          customVoiceId: useCustom ? voiceId : null,
          customVoiceSettings: useCustom ? newSettings : null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Eroare la salvare:", errorData.error);
      } else {
        onChunkSettingsChange?.();
      }
    } catch (err) {
      console.error("Eroare la salvarea setărilor:", err);
    } finally {
      setSavingChunk(false);
    }
  }, [selectedChunk, onChunkSettingsChange]);

  // Handler pentru schimbarea vocii proiectului
  const handleProjectVoiceChange = (voiceId: string) => {
    setProjectVoiceId(voiceId);
    
    const selectedVoice = voices.find(v => v.voice_id === voiceId);
    if (selectedVoice?.settings) {
      const newSettings = {
        ...projectSettings,
        stability: Math.round((selectedVoice.settings.stability || 0.5) * 100),
        similarity: Math.round((selectedVoice.settings.similarity_boost || 0.75) * 100),
        style: Math.round((selectedVoice.settings.style || 0) * 100),
        speakerBoost: selectedVoice.settings.use_speaker_boost ?? true,
      };
      setProjectSettings(newSettings);
      saveProjectSettings(voiceId, newSettings);
    } else {
      saveProjectSettings(voiceId, projectSettings);
    }
  };

  // Handler pentru schimbarea setărilor proiectului
  const handleProjectSettingChange = (key: keyof VoiceSettingsData, value: number | string | boolean) => {
    const newSettings = { ...projectSettings, [key]: value };
    setProjectSettings(newSettings);
    saveProjectSettings(projectVoiceId, newSettings);
  };

  // Handler pentru toggle ON/OFF custom settings
  const handleCustomToggle = () => {
    const newValue = !useCustomSettings;
    setUseCustomSettings(newValue);
    
    if (newValue) {
      // Activăm custom - copiem setările proiectului ca punct de plecare
      setChunkVoiceId(projectVoiceId);
      setChunkSettings(projectSettings);
      saveChunkSettings(true, projectVoiceId, projectSettings);
    } else {
      // Dezactivăm custom - resetăm la default
      saveChunkSettings(false, "", DEFAULT_SETTINGS);
    }
  };

  // Handler pentru schimbarea vocii chunk-ului
  const handleChunkVoiceChange = (voiceId: string) => {
    setChunkVoiceId(voiceId);
    saveChunkSettings(true, voiceId, chunkSettings);
  };

  // Handler pentru schimbarea setărilor chunk-ului
  const handleChunkSettingChange = (key: keyof VoiceSettingsData, value: number | string | boolean) => {
    const newSettings = { ...chunkSettings, [key]: value };
    setChunkSettings(newSettings);
    saveChunkSettings(true, chunkVoiceId, newSettings);
  };

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

  const hasChunkSelected = selectedChunk && selectedChunkIndex !== null && selectedChunkIndex !== undefined;
  const isDefaultExpanded = !hasChunkSelected || !useCustomSettings;
  const isChunkExpanded = hasChunkSelected && useCustomSettings;

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* Secțiunea 1: Setări Proiect (Default) */}
      <div className={`p-4 border-b border-gray-200 transition-all duration-200 ${isDefaultExpanded ? '' : 'bg-gray-50'}`}>
        {/* Header - întotdeauna vizibil */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚙️</span>
            <h2 className="text-md font-semibold text-gray-900">Setări Proiect (Default)</h2>
          </div>
          {savingProject && (
            <span className="text-xs text-gray-500">Se salvează...</span>
          )}
        </div>

        {/* Conținut - collapsed când chunk custom este activ */}
        {isDefaultExpanded && (
          <div className="space-y-4">
            {/* Voice Selector */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Voce
              </label>
              <select
                value={projectVoiceId}
                onChange={(e) => handleProjectVoiceChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 text-sm"
              >
                <option value="">Selectează o voce...</option>
                {voices.map((voice) => (
                  <option key={voice.voice_id} value={voice.voice_id}>
                    {voice.name} {voice.category && `(${voice.category})`}
                  </option>
                ))}
              </select>
            </div>

            {/* Model Selector */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Model
              </label>
              <select
                value={projectSettings.model}
                onChange={(e) => handleProjectSettingChange("model", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 text-sm"
              >
                {models.length === 0 ? (
                  <option value="eleven_multilingual_v2">Eleven Multilingual v2</option>
                ) : (
                  models.map((model) => (
                    <option key={model.model_id} value={model.model_id}>
                      {model.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Sliders */}
            <div className="space-y-3">
              {/* Stability */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-gray-700">Stability</label>
                  <span className="text-xs text-gray-500">{projectSettings.stability}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={projectSettings.stability}
                  onChange={(e) => handleProjectSettingChange("stability", parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>

              {/* Similarity */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-gray-700">Similarity</label>
                  <span className="text-xs text-gray-500">{projectSettings.similarity}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={projectSettings.similarity}
                  onChange={(e) => handleProjectSettingChange("similarity", parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>

              {/* Style */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-gray-700">Style</label>
                  <span className="text-xs text-gray-500">{projectSettings.style}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={projectSettings.style}
                  onChange={(e) => handleProjectSettingChange("style", parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>

              {/* Speed */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-gray-700">Speed</label>
                  <span className="text-xs text-gray-500">{projectSettings.speed.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="200"
                  value={projectSettings.speed * 100}
                  onChange={(e) => handleProjectSettingChange("speed", parseInt(e.target.value) / 100)}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>
            </div>

            {/* Info text */}
            <div className="pt-2 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                ℹ️ Aceste setări se aplică tuturor chunk-urilor fără setări custom.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Secțiunea 2: Setări Chunk Selectat - apare doar când un chunk este selectat */}
      {hasChunkSelected && (
        <div className={`flex-1 p-4 transition-all duration-200 ${isChunkExpanded ? '' : 'bg-gray-50'}`}>
          {/* Header cu toggle ON/OFF */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎯</span>
              <div>
                <h2 className="text-md font-semibold text-gray-900">Setări Chunk Selectat</h2>
                <p className="text-xs text-gray-500">Chunk #{(selectedChunkIndex ?? 0) + 1}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {savingChunk && (
                <span className="text-xs text-gray-500">Se salvează...</span>
              )}
              {/* Toggle ON/OFF */}
              <button
                onClick={handleCustomToggle}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  useCustomSettings ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    useCustomSettings ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Conținut - expanded doar când toggle este ON */}
          {isChunkExpanded && (
            <div className="space-y-4">
              {/* Voice Selector */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  Voce
                </label>
                <select
                  value={chunkVoiceId}
                  onChange={(e) => handleChunkVoiceChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 text-sm"
                >
                  <option value="">Selectează o voce...</option>
                  {voices.map((voice) => (
                    <option key={voice.voice_id} value={voice.voice_id}>
                      {voice.name} {voice.category && `(${voice.category})`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Model Selector */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  Model
                </label>
                <select
                  value={chunkSettings.model}
                  onChange={(e) => handleChunkSettingChange("model", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 text-sm"
                >
                  {models.length === 0 ? (
                    <option value="eleven_multilingual_v2">Eleven Multilingual v2</option>
                  ) : (
                    models.map((model) => (
                      <option key={model.model_id} value={model.model_id}>
                        {model.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Sliders */}
              <div className="space-y-3">
                {/* Stability */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-gray-700">Stability</label>
                    <span className="text-xs text-gray-500">{chunkSettings.stability}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={chunkSettings.stability}
                    onChange={(e) => handleChunkSettingChange("stability", parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>

                {/* Similarity */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-gray-700">Similarity</label>
                    <span className="text-xs text-gray-500">{chunkSettings.similarity}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={chunkSettings.similarity}
                    onChange={(e) => handleChunkSettingChange("similarity", parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>

                {/* Style */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-gray-700">Style</label>
                    <span className="text-xs text-gray-500">{chunkSettings.style}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={chunkSettings.style}
                    onChange={(e) => handleChunkSettingChange("style", parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>

                {/* Speed */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-gray-700">Speed</label>
                    <span className="text-xs text-gray-500">{chunkSettings.speed.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="200"
                    value={chunkSettings.speed * 100}
                    onChange={(e) => handleChunkSettingChange("speed", parseInt(e.target.value) / 100)}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
