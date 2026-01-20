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

interface VoiceSettingsData {
  stability: number;
  similarity: number;
  style: number;
  speed: number;
  model: string;
  speakerBoost: boolean;
}

interface VoiceSettingsProps {
  projectId: string;
}

export default function VoiceSettings({ projectId }: VoiceSettingsProps) {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("");
  const [settings, setSettings] = useState<VoiceSettingsData>({
    stability: 50,
    similarity: 75,
    style: 0,
    speed: 1.0,
    model: "eleven_multilingual_v2",
    speakerBoost: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Încarcă vocile și modelele
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        // Încarcă vocile, modelele și setările proiectului în paralel
        const [voicesRes, modelsRes, projectVoiceRes] = await Promise.all([
          fetch("/api/voices"),
          fetch("/api/models"),
          fetch(`/api/projects/${projectId}/voice`),
        ]);

        if (voicesRes.ok) {
          const voicesData = await voicesRes.json();
          setVoices(voicesData.voices || []);
        } else {
          const errorData = await voicesRes.json();
          setError(errorData.error || "Eroare la încărcarea vocilor");
        }

        if (modelsRes.ok) {
          const modelsData = await modelsRes.json();
          setModels(modelsData.models || []);
        }

        if (projectVoiceRes.ok) {
          const projectVoiceData = await projectVoiceRes.json();
          if (projectVoiceData.voiceId) {
            setSelectedVoiceId(projectVoiceData.voiceId);
          }
          if (projectVoiceData.settings) {
            setSettings({
              stability: projectVoiceData.settings.stability ?? 50,
              similarity: projectVoiceData.settings.similarity ?? 75,
              style: projectVoiceData.settings.style ?? 0,
              speed: projectVoiceData.settings.speed ?? 1.0,
              model: projectVoiceData.settings.model ?? "eleven_multilingual_v2",
              speakerBoost: projectVoiceData.settings.speakerBoost ?? true,
            });
          }
        }
      } catch (err) {
        console.error("Eroare la încărcarea datelor:", err);
        setError("Eroare la conectarea cu serverul");
      } finally {
        setLoading(false);
      }
    }

    loadData();
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
      }
    } catch (err) {
      console.error("Eroare la salvarea setărilor:", err);
    } finally {
      setSaving(false);
    }
  }, [projectId]);

  // Handler pentru schimbarea vocii
  const handleVoiceChange = (voiceId: string) => {
    setSelectedVoiceId(voiceId);
    
    // Găsește vocea selectată și încarcă setările default
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

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="h-2 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600 text-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-sm text-red-700 underline hover:no-underline"
          >
            Încearcă din nou
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Setări Voce</h2>
        {saving && (
          <span className="text-xs text-gray-500">Se salvează...</span>
        )}
      </div>

      {/* Voice Selector */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Voce
        </label>
        <select
          value={selectedVoiceId}
          onChange={(e) => handleVoiceChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
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
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Model
        </label>
        <select
          value={settings.model}
          onChange={(e) => handleSettingChange("model", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
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

      {/* Stability Slider */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="block text-sm font-medium text-gray-700">
            Stability
          </label>
          <span className="text-sm text-gray-500">{settings.stability}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={settings.stability}
          onChange={(e) => handleSettingChange("stability", parseInt(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
        <p className="text-xs text-gray-500">
          Mai stabil = mai consistent, mai puțin expresiv
        </p>
      </div>

      {/* Similarity Slider */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="block text-sm font-medium text-gray-700">
            Similarity Boost
          </label>
          <span className="text-sm text-gray-500">{settings.similarity}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={settings.similarity}
          onChange={(e) => handleSettingChange("similarity", parseInt(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
        <p className="text-xs text-gray-500">
          Mai mare = mai aproape de vocea originală
        </p>
      </div>

      {/* Style Slider */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="block text-sm font-medium text-gray-700">
            Style
          </label>
          <span className="text-sm text-gray-500">{settings.style}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={settings.style}
          onChange={(e) => handleSettingChange("style", parseInt(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
        <p className="text-xs text-gray-500">
          Amplifică stilul vocii (poate reduce stabilitatea)
        </p>
      </div>

      {/* Speed Slider */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="block text-sm font-medium text-gray-700">
            Speed
          </label>
          <span className="text-sm text-gray-500">{settings.speed.toFixed(1)}x</span>
        </div>
        <input
          type="range"
          min="50"
          max="200"
          value={settings.speed * 100}
          onChange={(e) => handleSettingChange("speed", parseInt(e.target.value) / 100)}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
        <p className="text-xs text-gray-500">
          0.5x = lent, 1.0x = normal, 2.0x = rapid
        </p>
      </div>

      {/* Speaker Boost Toggle */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Speaker Boost
            </label>
            <p className="text-xs text-gray-500">
              Îmbunătățește similaritatea cu vocea originală
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleSettingChange("speakerBoost", !settings.speakerBoost)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              settings.speakerBoost ? "bg-blue-600" : "bg-gray-200"
            }`}
            role="switch"
            aria-checked={settings.speakerBoost}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                settings.speakerBoost ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Info despre vocea selectată */}
      {selectedVoiceId && (
        <div className="pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            Setările se aplică la toate generările viitoare pentru acest proiect.
          </p>
        </div>
      )}
    </div>
  );
}
