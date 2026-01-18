import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProjectEditor from "@/components/ProjectEditor";

interface ProjectEditorPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectEditorPage({ params }: ProjectEditorPageProps) {
  const { id } = await params;

  // Încarcă proiectul din baza de date
  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
    },
  });

  // Dacă proiectul nu există, afișează 404
  if (!project) {
    notFound();
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="h-16 bg-card border-b border-border flex items-center px-6">
        <Link
          href="/projects"
          className="text-secondary hover:text-foreground transition-colors mr-4"
        >
          ← Înapoi la Proiecte
        </Link>
        <h1 className="text-xl font-semibold">{project.name}</h1>
      </header>

      {/* Main Content - 3 Columns via ProjectEditor */}
      <ProjectEditor projectId={project.id} projectName={project.name} />
    </div>
  );
}
