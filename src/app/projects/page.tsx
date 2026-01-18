"use client";

import { useState, useRef } from "react";
import ProjectList from "@/components/ProjectList";
import CreateProjectModal from "@/components/CreateProjectModal";

export default function ProjectsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const projectListRef = useRef<{ refresh: () => void }>(null);

  const handleProjectCreated = () => {
    // Reîncarcă lista de proiecte
    projectListRef.current?.refresh();
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6">
        <h1 className="text-xl font-bold text-primary">11Labs Audiobook Generator</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
        >
          + Proiect Nou
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold mb-6">Proiectele Mele</h2>
          <ProjectList ref={projectListRef} />
        </div>
      </main>

      {/* Modal creare proiect */}
      <CreateProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={handleProjectCreated}
      />
    </div>
  );
}
