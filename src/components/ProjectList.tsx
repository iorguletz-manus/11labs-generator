"use client";

import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "./ConfirmDialog";

interface Project {
  id: string;
  name: string;
  createdAt: string;
}

export interface ProjectListRef {
  refresh: () => void;
}

const ProjectList = forwardRef<ProjectListRef>(function ProjectList(_, ref) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State pentru editare inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  // State pentru dialog confirmare ștergere
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    projectId: string | null;
    projectName: string;
  }>({
    isOpen: false,
    projectId: null,
    projectName: "",
  });

  // Încarcă proiectele
  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/projects");
      if (!response.ok) throw new Error("Eroare la încărcarea proiectelor");
      const data = await response.json();
      setProjects(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare necunoscută");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  // Expune metoda refresh pentru componenta părinte
  useImperativeHandle(ref, () => ({
    refresh: fetchProjects,
  }));

  // Începe editarea inline
  const startEditing = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(project.id);
    setEditingName(project.name);
  };

  // Salvează numele editat
  const saveEdit = async () => {
    if (!editingId || !editingName.trim()) {
      setEditingId(null);
      return;
    }

    try {
      const response = await fetch(`/api/projects/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingName.trim() }),
      });

      if (!response.ok) throw new Error("Eroare la salvare");

      // Actualizează lista local
      setProjects((prev) =>
        prev.map((p) =>
          p.id === editingId ? { ...p, name: editingName.trim() } : p
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare la salvare");
    } finally {
      setEditingId(null);
    }
  };

  // Anulează editarea
  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  // Deschide dialogul de confirmare ștergere
  const openDeleteDialog = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteDialog({
      isOpen: true,
      projectId: project.id,
      projectName: project.name,
    });
  };

  // Șterge proiectul
  const handleDelete = async () => {
    if (!deleteDialog.projectId) return;

    try {
      const response = await fetch(`/api/projects/${deleteDialog.projectId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Eroare la ștergere");

      // Actualizează lista local
      setProjects((prev) =>
        prev.filter((p) => p.id !== deleteDialog.projectId)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare la ștergere");
    } finally {
      setDeleteDialog({ isOpen: false, projectId: null, projectName: "" });
    }
  };

  // Formatare dată
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("ro-RO", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Loading state
  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-secondary">Se încarcă proiectele...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={fetchProjects}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
        >
          Încearcă din nou
        </button>
      </div>
    );
  }

  // Empty state
  if (projects.length === 0) {
    return (
      <div className="text-center py-12 bg-card rounded-lg border border-border">
        <p className="text-secondary">
          Nu ai niciun proiect. Creează primul tău proiect pentru a începe.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Lista proiecte */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        {projects.map((project, index) => (
          <div
            key={project.id}
            onClick={() => router.push(`/projects/${project.id}`)}
            className={`flex items-center justify-between px-4 py-3 hover:bg-muted cursor-pointer transition-colors ${
              index !== projects.length - 1 ? "border-b border-border" : ""
            }`}
          >
            {/* Numele proiectului */}
            <div className="flex-1 min-w-0">
              {editingId === project.id ? (
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={saveEdit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit();
                    if (e.key === "Escape") cancelEdit();
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full px-2 py-1 bg-background border border-primary rounded focus:outline-none focus:ring-2 focus:ring-primary"
                  autoFocus
                  maxLength={100}
                />
              ) : (
                <span className="font-medium truncate block">{project.name}</span>
              )}
            </div>

            {/* Data creării */}
            <div className="text-sm text-secondary mx-4 whitespace-nowrap">
              Creat: {formatDate(project.createdAt)}
            </div>

            {/* Butoane acțiuni */}
            <div className="flex items-center gap-2">
              {/* Buton redenumire */}
              <button
                onClick={(e) => startEditing(project, e)}
                className="p-2 text-secondary hover:text-foreground hover:bg-background rounded transition-colors"
                title="Redenumește"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  <path d="m15 5 4 4" />
                </svg>
              </button>

              {/* Buton ștergere */}
              <button
                onClick={(e) => openDeleteDialog(project, e)}
                className="p-2 text-secondary hover:text-red-500 hover:bg-background rounded transition-colors"
                title="Șterge"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  <line x1="10" x2="10" y1="11" y2="17" />
                  <line x1="14" x2="14" y1="11" y2="17" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Dialog confirmare ștergere */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        title="Șterge proiectul"
        message={`Ești sigur că vrei să ștergi proiectul "${deleteDialog.projectName}"? Această acțiune nu poate fi anulată și va șterge toate datele asociate.`}
        confirmText="Șterge"
        cancelText="Anulează"
        onConfirm={handleDelete}
        onCancel={() =>
          setDeleteDialog({ isOpen: false, projectId: null, projectName: "" })
        }
      />
    </>
  );
});

export default ProjectList;
