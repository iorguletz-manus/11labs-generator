"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import ProjectEditor from "@/components/ProjectEditor";

export default function ProjectEditorPage() {
  const params = useParams();
  const id = params.id as string;
  
  const [project, setProject] = useState<{ id: string; name: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State pentru export
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Încarcă proiectul
  useEffect(() => {
    const loadProject = async () => {
      try {
        const response = await fetch(`/api/projects/${id}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError("Proiectul nu a fost găsit");
          } else {
            setError("Eroare la încărcarea proiectului");
          }
          return;
        }
        const data = await response.json();
        setProject(data);
      } catch (err) {
        console.error("Eroare:", err);
        setError("Eroare de conexiune");
      } finally {
        setIsLoading(false);
      }
    };

    loadProject();
  }, [id]);

  // Handler pentru export MP3
  const handleExport = useCallback(async () => {
    if (!project) return;
    
    setIsExporting(true);
    setExportError(null);
    setExportSuccess(false);

    try {
      // Verifică mai întâi dacă exportul este posibil
      const checkResponse = await fetch(`/api/projects/${id}/export`);
      const checkData = await checkResponse.json();

      if (!checkData.ready) {
        const missingList = checkData.missingChunks
          ?.map((c: { index: number; text: string }) => `Chunk #${c.index}: "${c.text}"`)
          .join('\n');
        setExportError(
          `Nu se poate exporta. ${checkData.chunksWithoutAudio} chunk-uri nu au audio:\n${missingList || ''}`
        );
        setIsExporting(false);
        return;
      }

      // Descarcă fișierul
      const response = await fetch(`/api/projects/${id}/export`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        setExportError(errorData.error || 'Eroare la export');
        setIsExporting(false);
        return;
      }

      // Creează blob și descarcă
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Extrage numele fișierului din header sau folosește default
      const contentDisposition = response.headers.get('Content-Disposition');
      let fileName = `${project.name.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_')}_audiobook.mp3`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) fileName = match[1];
      }
      
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);

    } catch (err) {
      console.error('Eroare la export:', err);
      setExportError('Eroare de conexiune la server');
    } finally {
      setIsExporting(false);
    }
  }, [id, project]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-secondary">Se încarcă...</div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4">
        <div className="text-red-500">{error || "Proiectul nu a fost găsit"}</div>
        <Link href="/projects" className="text-primary hover:underline">
          ← Înapoi la Proiecte
        </Link>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6">
        <div className="flex items-center">
          <Link
            href="/projects"
            className="text-secondary hover:text-foreground transition-colors mr-4"
          >
            ← Înapoi la Proiecte
          </Link>
          <h1 className="text-xl font-semibold">{project.name}</h1>
        </div>
        
        {/* Export Button în Header */}
        <div className="flex items-center gap-3">
          {exportError && (
            <div className="text-xs text-red-400 max-w-md truncate" title={exportError}>
              ❌ {exportError.split('\n')[0]}
            </div>
          )}
          {exportSuccess && (
            <div className="text-xs text-green-400">
              ✅ Export reușit!
            </div>
          )}
          <button
            className={`px-4 py-2 rounded-md transition-colors text-sm font-medium ${
              isExporting
                ? 'bg-gray-500 cursor-not-allowed text-white'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">⏳</span>
                Se exportă...
              </span>
            ) : (
              '📥 Export Final MP3'
            )}
          </button>
        </div>
      </header>

      {/* Main Content - 3 Columns via ProjectEditor */}
      <ProjectEditor projectId={project.id} projectName={project.name} />
    </div>
  );
}
