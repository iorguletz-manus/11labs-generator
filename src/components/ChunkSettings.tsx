"use client";

import { useState, useEffect, useCallback } from "react";
import { VoiceSettingsData } from "./ProjectSettings";

interface Voice {
  voice_id: string;
  name: string;
  category: string;
}

interface Model {
  model_id: string;
  name: string;
}

interface ChunkSettingsProps {
  chunkId: string;
  chunkIndex: number;
  voices: Voice[];
  models: Model[];
  projectVoiceId: string;
  projectSettings: VoiceSettingsData;
  initialUseCustomSettings?: boolean;
  initialCustomVoiceId?: string | null;
  initialCustomSettings?: VoiceSettingsData | null;
  onSettingsChange?: () => void;
}

export default function ChunkSettings({
  chunkId,
  chunkIndex,
  voices,
  models,
  projectVoiceId,
  projectSettings,
  initialUseCustomSettings = false,
  initialCustomVoiceId = null,
  initialCustomSettings = null,
  onSettingsChange,
}: ChunkSettingsProps) {
  const [useCustomSettings, setUseCustomSettings] = useState(initialUseCustomSettings);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(initialCustomVoiceId || projectVoiceId || "");
  const [settings, setSettings] = useState<VoiceSettingsData>(
    initialCustomSettings || projectSettings
  );
  const [saving, setSaving] = useState(false);

  // Actualizează starea când se schimbă chunk-ul selectat
  useEffect(() => {
    setUseCustomSettings(initialUseCustomSettings);
    setSelectedVoiceId(initialCustomVoiceId || projectVoiceId || "");
    setSettings(initialCustomSettings || projectSettings);
  }, [chunkId, initialUseCustomSettings, initialCustomVoiceId, initialCustomSettings, projectVoiceId, projectSettings]);

  // Salvează setările
  const saveSettings = useCallback(async (
    useCustom: boolean, 
    voiceId: string, 
    newSettings: VoiceSettingsData
  ) => {
    try {
      setSaving(true);
      const response = await fetch(`/api/chunks/${chunkId}/settings`, {
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
        onSettingsChange?.();
      }
    } catch (err) {
      console.error("Eroare la salvarea setărilor:", err);
    } finally {
      setSaving(false);
    }
  }, [chunkId, onSettingsChange]);

  // Handler pentru schimbarea modului (default/custom)
  const handleModeChange = (useCustom: boolean) => {
    setUseCustomSettings(useCustom);
    if (!useCustom) {
      // Resetăm la setările proiectului
      setSelectedVoiceId(projectVoiceId || "");
      setSettings(projectSettings);
    }
    saveSettings(useCustom, useCustom ? selectedVoiceId : "", settings);
  };

  // Handler pentru schimbarea vocii
  const handleVoiceChange = (voiceId: string) => {
    setSelectedVoiceId(voiceId);
    if (useCustomSettings) {
      saveSettings(true, voiceId, settings);
    }
  };

  // Handler pentru schimbarea setărilor
  const handleSettingChange = (key: keyof VoiceSettingsData, value: number | string | boolean) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    if (useCustomSettings) {
      saveSettings(true, selectedVoiceId, newSettings);
    }
  };

  // Handler pentru reset la default
  const handleReset = async () => {
    try {
      setSaving(true);
      const response = await fetch(`/api/chunks/${chunkId}/settings`, {
        method: "DELETE",
      });

      if (response.ok) {
        setUseCustomSettings(false);
        setSelectedVoiceId(projectVoiceId || "");
        setSettings(projectSettings);
        onSettingsChange?.();
      }
    } catch (err) {
      console.error("Eroare la resetare:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎯</span>
          <div>
            <h2 className="text-md font-semibold text-gray-900">Setări Chunk Selectat</h2>
            <p className="text-xs text-gray-500">Chunk #{chunkIndex + 1}</p>
          </div>
        </div>
        {saving && (
          <span className="text-xs text-gray-500">Se salvează...</span>
        )}
      </div>

      {/* Radio buttons pentru mod */}
      <div className="space-y-2 p-3 bg-gray-50 rounded-lg">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={`chunk-mode-${chunkId}`}
            checked={!useCustomSettings}
            onChange={() => handleModeChange(false)}
            className="w-4 h-4 text-blue-600"
          />
          <span className="text-sm text-gray-700">Folosește setările default</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={`chunk-mode-${chunkId}`}
            checked={useCustomSettings}
            onChange={() => handleModeChange(true)}
            className="w-4 h-4 text-blue-600"
          />
          <span className="text-sm text-gray-700">Setări custom pentru acest chunk</span>
        </label>
      </div>

      {/* Controale (disabled când folosește default) */}
      <div className={`space-y-3 ${!useCustomSettings ? 'opacity-50 pointer-events-none' : ''}`}>
        {/* Voice Selector */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Voce
          </label>
          <select
            value={selectedVoiceId}
            onChange={(e) => handleVoiceChange(e.target.value)}
            disabled={!useCustomSettings}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 text-sm disabled:bg-gray-100"
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
            value={settings.model}
            onChange={(e) => handleSettingChange("model", e.target.value)}
            disabled={!useCustomSettings}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 text-sm disabled:bg-gray-100"
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
              <span className="text-xs text-gray-500">{settings.stability}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={settings.stability}
              onChange={(e) => handleSettingChange("stability", parseInt(e.target.value))}
              disabled={!useCustomSettings}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 disabled:accent-gray-400"
            />
          </div>

          {/* Similarity */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium text-gray-700">Similarity</label>
              <span className="text-xs text-gray-500">{settings.similarity}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={settings.similarity}
              onChange={(e) => handleSettingChange("similarity", parseInt(e.target.value))}
              disabled={!useCustomSettings}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 disabled:accent-gray-400"
            />
          </div>

          {/* Style */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium text-gray-700">Style</label>
              <span className="text-xs text-gray-500">{settings.style}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={settings.style}
              onChange={(e) => handleSettingChange("style", parseInt(e.target.value))}
              disabled={!useCustomSettings}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 disabled:accent-gray-400"
            />
          </div>

          {/* Speed */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium text-gray-700">Speed</label>
              <span className="text-xs text-gray-500">{settings.speed.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="50"
              max="200"
              value={settings.speed * 100}
              onChange={(e) => handleSettingChange("speed", parseInt(e.target.value) / 100)}
              disabled={!useCustomSettings}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 disabled:accent-gray-400"
            />
          </div>
        </div>
      </div>

      {/* Buton Reset */}
      {useCustomSettings && (
        <button
          onClick={handleReset}
          disabled={saving}
          className="w-full px-3 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <span>↺</span>
          <span>Resetează la default</span>
        </button>
      )}
    </div>
  );
}
