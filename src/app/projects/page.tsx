export default function ProjectsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6">
        <h1 className="text-xl font-bold text-primary">11Labs Audiobook Generator</h1>
        <button className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors">
          + Proiect Nou
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold mb-6">Proiectele Mele</h2>
          
          {/* Empty State - va fi înlocuit cu lista reală în Faza 2 */}
          <div className="text-center py-12 bg-card rounded-lg border border-border">
            <p className="text-secondary mb-4">
              Nu ai niciun proiect. Creează primul tău proiect pentru a începe.
            </p>
            <button className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors">
              + Creează Proiect
            </button>
          </div>
          
          {/* Placeholder pentru lista proiectelor - Faza 2 */}
          <p className="text-sm text-secondary mt-6 text-center">
            Lista proiectelor și funcționalitatea CRUD vor fi implementate în Faza 2.
          </p>
        </div>
      </main>
    </div>
  );
}
