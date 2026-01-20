"use client";

import { useState, useEffect, useCallback } from "react";

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

export interface VoiceSettingsData {
  stability: number;
  similarity: number;
  style: number;
  speed: number;
  model: string;
  speakerBoost: boolean;
}

interface ProjectSettingsProps {
  projectId: string;
  voices: Voice[];
  models: Model[];
  onSettingsChange?: (voiceId: string, settings: VoiceSettingsData) => void;
}

export default function ProjectSettings({ 
  projectId, 
  voices, 
  models,
  onSettingsChange 
}: ProjectSettingsProps) {
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("");
  const [settings, setSettings] = useState<VoiceSettingsData>({
    stability: 50,
    similarity: 75,
    style: 0,
    speed: 1.0,
    model: "eleven_multilingual_v2",
    speakerBoost: true,
  });
  const [saving, setSaving] = useState(false);

  // Încarcă setările proiectului
  useEffect(() => {
    async function loadProjectSettings() {
      try {
        const response = await fetch(`/api/projects/${projectId}/voice`);
        if (response.ok) {
          const data = await response.json();
          if (data.voiceId) {
            setSelectedVoiceId(data.voiceId);
          }
          if (data.settings) {
            setSettings({
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

  // Salvează setările
  const saveSettings = useCallback(async (voiceId: string, newSettings: VoiceSettingsData) => {
    try {
      setSaving(true);
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
      } else {
        onSettingsChange?.(voiceId, newSettings);
      }
    } catch (err) {
      console.error("Eroare la salvarea setărilor:", err);
    } finally {
      setSaving(false);
    }
  }, [projectId, onSettingsChange]);

  // Handler pentru schimbarea vocii
  const handleVoiceChange = (voiceId: string) => {
    setSelectedVoiceId(voiceId);
    
    const selectedVoice = voices.find(v => v.voice_id === voiceId);
    if (selectedVoice?.settings) {
      const newSettings = {
        ...settings,
        stability: Math.round((selectedVoice.settings.stability || 0.5) * 100),
        similarity: Math.round((selectedVoice.settings.similarity_boost || 0.75) * 100),
        style: Math.round((selectedVoice.settings.style || 0) * 100),
        speakerBoost: selectedVoice.settings.use_speaker_boost ?? true,
      };
      setSettings(newSettings);
      saveSettings(voiceId, newSettings);
    } else {
      saveSettings(voiceId, settings);
    }
  };

  // Handler pentru schimbarea setărilor
  const handleSettingChange = (key: keyof VoiceSettingsData, value: number | string | boolean) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    saveSettings(selectedVoiceId, newSettings);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚙️</span>
          <h2 className="text-md font-semibold text-gray-900">Setări Proiect (Default)</h2>
        </div>
        {saving && (
          <span className="text-xs text-gray-500">Se salvează...</span>
        )}
      </div>

      {/* Voice Selector */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          Voce
        </label>
        <select
          value={selectedVoiceId}
          onChange={(e) => handleVoiceChange(e.target.value)}
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
          value={settings.model}
          onChange={(e) => handleSettingChange("model", e.target.value)}
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
            <span className="text-xs text-gray-500">{settings.stability}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={settings.stability}
            onChange={(e) => handleSettingChange("stability", parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
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
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
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
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
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
  );
}
