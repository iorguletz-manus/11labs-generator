"use client";

import { useState } from "react";

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateProjectModal({
  isOpen,
  onClose,
  onCreated,
}: CreateProjectModalProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validare
    if (!name.trim()) {
      setError("Numele proiectului este obligatoriu");
      return;
    }

    if (name.length > 100) {
      setError("Numele proiectului nu poate depăși 100 de caractere");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Eroare la crearea proiectului");
      }

      // Resetează și închide modalul
      setName("");
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare la creare");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setName("");
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-card border border-border rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">Proiect Nou</h3>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="projectName"
              className="block text-sm font-medium mb-2"
            >
              Nume proiect
            </label>
            <input
              type="text"
              id="projectName"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Introdu numele proiectului"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              autoFocus
              maxLength={100}
              disabled={isLoading}
            />
            {error && (
              <p className="mt-2 text-sm text-red-500">{error}</p>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-secondary hover:text-foreground transition-colors"
              disabled={isLoading}
            >
              Anulează
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              {isLoading ? "Se creează..." : "Creează Proiect"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
