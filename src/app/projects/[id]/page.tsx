import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

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

      {/* Main Content - 3 Columns */}
      <div className="flex-1 flex overflow-hidden">
        {/* Coloana 1 - Voice Settings (300px) */}
        <div className="w-[300px] min-w-[300px] h-full bg-card border-r border-border p-4">
          <h2 className="text-lg font-semibold mb-4">Setări Voce</h2>
          <p className="text-sm text-secondary">
            Setările vocii vor fi implementate în Faza 4.
          </p>
        </div>

        {/* Coloana 2 - Text Chunks (flexibil) */}
        <div className="flex-1 h-full bg-background p-4 overflow-y-auto">
          <h2 className="text-lg font-semibold mb-4">Text Chunks</h2>
          <p className="text-sm text-secondary">
            Editorul de text și chunk-uri va fi implementat în Faza 3.
          </p>
        </div>

        {/* Coloana 3 - Audio Queue (350px) */}
        <div className="w-[350px] min-w-[350px] h-full bg-card border-l border-border p-4">
          <h2 className="text-lg font-semibold mb-4">Audio Queue</h2>
          <p className="text-sm text-secondary">
            Queue-ul audio va fi implementat în Faza 6.
          </p>
        </div>
      </div>
    </div>
  );
}
