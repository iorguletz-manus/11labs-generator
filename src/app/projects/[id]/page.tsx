"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, useRef } from "react";
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
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Închide dropdown-ul când se face click în afară
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowExportDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  // Handler pentru export MP3 concatenat
  const handleExportConcatenated = useCallback(async () => {
    if (!project) return;
    
    setShowExportDropdown(false);
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

  // Handler pentru export ZIP cu fișiere individuale
  const handleExportZip = useCallback(async () => {
    if (!project) return;
    
    setShowExportDropdown(false);
    setIsExporting(true);
    setExportError(null);
    setExportSuccess(false);

    try {
      const response = await fetch(`/api/projects/${id}/export-zip`, {
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
      
      const fileName = `${project.name.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_')}_chunks.zip`;
      
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);

    } catch (err) {
      console.error('Eroare la export ZIP:', err);
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
        
        {/* Export Button cu Dropdown */}
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
          
          {/* Dropdown Container */}
          <div className="relative" ref={dropdownRef}>
            <button
              className={`px-4 py-2 rounded-md transition-colors text-sm font-medium flex items-center gap-2 ${
                isExporting
                  ? 'bg-gray-500 cursor-not-allowed text-white'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
              onClick={() => !isExporting && setShowExportDropdown(!showExportDropdown)}
              disabled={isExporting}
            >
              {isExporting ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Se exportă...
                </>
              ) : (
                <>
                  📥 Export
                  <span className="text-xs">▼</span>
                </>
              )}
            </button>
            
            {/* Dropdown Menu */}
            {showExportDropdown && !isExporting && (
              <div className="absolute right-0 mt-2 w-64 bg-card border border-border rounded-md shadow-lg z-50">
                <div className="py-1">
                  <button
                    onClick={handleExportConcatenated}
                    className="w-full px-4 py-3 text-left hover:bg-background transition-colors flex items-start gap-3"
                  >
                    <span className="text-xl">🎵</span>
                    <div>
                      <div className="font-medium text-sm">MP3 Concatenat</div>
                      <div className="text-xs text-secondary">
                        Un singur fișier MP3 cu toate chunk-urile lipite
                      </div>
                    </div>
                  </button>
                  
                  <div className="border-t border-border" />
                  
                  <button
                    onClick={handleExportZip}
                    className="w-full px-4 py-3 text-left hover:bg-background transition-colors flex items-start gap-3"
                  >
                    <span className="text-xl">📦</span>
                    <div>
                      <div className="font-medium text-sm">ZIP Individual</div>
                      <div className="text-xs text-secondary">
                        Arhivă ZIP cu câte un MP3 per chunk
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content - 3 Columns via ProjectEditor */}
      <ProjectEditor projectId={project.id} projectName={project.name} />
    </div>
  );
}
