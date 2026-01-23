# Documentație Tehnică: 11Labs Audiobook Generator

**Autor:** Manus AI
**Data:** 23 Ianuarie 2026
**Versiune:** 1.0

---

## 1. Introducere

Acest document oferă o privire detaliată asupra arhitecturii și implementării tehnice a aplicației **11Labs Audiobook Generator**. Scopul său este de a servi drept ghid pentru dezvoltatorii care lucrează la proiect, facilitând înțelegerea codului, navigarea prin structura aplicației și luarea deciziilor informate.

### 1.1. Scopul Aplicației

Aplicația permite utilizatorilor să creeze audiobook-uri prin transformarea unui text în vorbire (Text-to-Speech) folosind API-ul [ElevenLabs](https://elevenlabs.io/). Utilizatorii pot gestiona proiecte, pot împărți textul în segmente (chunk-uri), pot personaliza setările vocii pentru fiecare chunk și pot exporta rezultatul final ca un singur fișier audio MP3 sau ca o arhivă ZIP cu fișiere individuale.

### 1.2. Stack Tehnologic

Aplicația este construită folosind un stack modern, bazat pe JavaScript/TypeScript, cu următoarele tehnologii cheie:

| Tehnologie | Scop | Motivul alegerii |
|---|---|---|
| **Next.js 16** | Framework Full-Stack | Performanță, Server-Side Rendering (SSR), API Routes integrate. |
| **React 19** | Bibliotecă UI | Component-based, ecosistem vast, management eficient al stării. |
| **TypeScript** | Superset JavaScript | Tipare statică pentru un cod mai robust și mai ușor de întreținut. |
| **Tailwind CSS 4** | Framework CSS | Utility-first pentru stilizare rapidă și consistentă. |
| **Prisma 5.22** | ORM | Interacțiune sigură și intuitivă cu baza de date. |
| **SQLite / Turso** | Bază de date | SQLite pentru dezvoltare locală, Turso pentru producție (SQLite in the cloud). |
| **ElevenLabs API** | Serviciu Text-to-Speech | Calitate superioară a vocilor generate. |
| **FFMPEG API** | Procesare Audio | Concatenarea fișierelor audio pentru export. |

---

## 2. Arhitectura Generală

Aplicația urmează o arhitectură full-stack, unde Next.js servește atât frontend-ul (componente React) cât și backend-ul (API Routes).

### 2.1. Structura Proiectului

Structura de fișiere este organizată pentru a separa clar logica de frontend, backend și baza de date.

```
/home/ubuntu/11labs-generator/
├── prisma/                 # Schema și migrările bazei de date
│   └── schema.prisma
├── public/                 # Fișiere statice
├── src/
│   ├── app/                # Paginile și API Routes (Next.js App Router)
│   │   ├── api/            # Toate endpoint-urile backend
│   │   │   ├── projects/   # API pentru proiecte (CRUD, text, voice, export)
│   │   │   ├── chunks/     # API pentru chunk-uri (settings, generate)
│   │   │   ├── audio/      # API pentru streaming audio
│   │   │   └── ...
│   │   ├── projects/       # Paginile de frontend pentru proiecte
│   │   │   ├── page.tsx    # Pagina cu lista de proiecte
│   │   │   └── [id]/       # Pagina de editare a unui proiect
│   │   │       └── page.tsx
│   │   ├── layout.tsx      # Layout-ul principal al aplicației
│   │   └── page.tsx        # Pagina rădăcină (redirect)
│   ├── components/         # Componente React reutilizabile
│   │   ├── ProjectEditor.tsx # Componenta principală (3 coloane)
│   │   ├── TextEditor.tsx    # Editorul de text bazat pe chunk-uri
│   │   ├── VoiceSettings.tsx # Panoul de setări pentru voce
│   │   └── ...
│   └── lib/                # Biblioteci și utilități partajate
│       └── prisma.ts       # Instanța clientului Prisma
├── .env                    # Fișier de mediu (local)
├── package.json            # Dependențe și scripturi
└── ...
```

### 2.2. Fluxul de Date

Fluxul de date este centrat în jurul interacțiunii dintre componentele React și API Routes. Componentele frontend nu interacționează niciodată direct cu baza de date.

1.  **Componenta React (Frontend):** O acțiune a utilizatorului (ex: click pe un buton) declanșează un request `fetch` către un API Route.
2.  **API Route (Backend):** Endpoint-ul primește request-ul, validează datele și folosește clientul **Prisma** pentru a executa operații pe baza de date (citire, scriere, actualizare, ștergere).
3.  **Baza de Date (Prisma -> SQLite/Turso):** Operația este executată.
4.  **API Route (Backend):** Returnează un răspuns JSON către frontend (datele solicitate sau un status de succes/eroare).
5.  **Componenta React (Frontend):** Primește răspunsul și actualizează starea locală (folosind `useState`), ceea ce duce la re-randarea UI-ului cu noile date.

---

## 3. Baza de Date

Schema bazei de date este definită în `prisma/schema.prisma` și utilizează Prisma ORM pentru a mapa modelele la tabelele din baza de date.

### 3.1. Modele de Date

| Model | Descriere | Câmpuri Cheie |
|---|---|---|
| **Project** | Reprezintă un audiobook. Conține numele și setările de voce default. | `id`, `name`, `voiceId`, `voiceSettings` |
| **Chunk** | Reprezintă un segment de text dintr-un proiect. Poate avea setări de voce custom. | `id`, `projectId`, `text`, `order`, `useCustomSettings` |
| **AudioVariant** | Reprezintă o variantă audio generată pentru un chunk. Conține fișierul audio și setările folosite. | `id`, `chunkId`, `audioData`, `isActive`, `usedVoiceSettings` |

### 3.2. Relații

-   Un **Project** are mai multe **Chunk**-uri (relație 1-N).
-   Un **Chunk** are mai multe **AudioVariant**-e (relație 1-N).
-   Ștergerea unui `Project` duce la ștergerea în cascadă a tuturor `Chunk`-urilor și `AudioVariant`-elor asociate (`onDelete: Cascade`).

### 3.3. Conectivitate (Development vs. Production)

Fișierul `src/lib/prisma.ts` gestionează inteligent conexiunea la baza de date:

-   **În development (`NODE_ENV=development`):** Se conectează la o bază de date SQLite locală (`file:./prisma/dev.db`), specificată în `.env`.
-   **În producție (`NODE_ENV=production`):** Se conectează la [Turso](https://turso.tech/) folosind `TURSO_DATABASE_URL` și `TURSO_AUTH_TOKEN` din variabilele de mediu (setate pe Vercel).

---

## 4. Componente Frontend (React)

Interfața utilizator este construită dintr-o serie de componente React, localizate în `src/components/`.

### 4.1. Componente Principale

| Componentă | Fișier | Responsabilități |
|---|---|---|
| **ProjectEditor** | `ProjectEditor.tsx` | Componenta centrală a paginii de editare. Gestionează layout-ul cu 3 coloane și starea globală a editorului (chunk-uri selectate, variante audio, player). |
| **TextEditor** | `TextEditor.tsx` | Afișează textul sub formă de chunk-uri editabile. Gestionează logica de editare (Enter, Backspace, Paste), autosave și navigare. |
| **VoiceSettings** | `VoiceSettings.tsx` | Panoul din stânga care afișează setările de voce. Gestionează logica duală: setări default pentru proiect și setări custom per chunk. |
| **ProjectList** | `ProjectList.tsx` | Afișează lista de proiecte pe pagina `/projects`. Gestionează redenumirea și ștergerea proiectelor. |
| **CreateProjectModal** | `CreateProjectModal.tsx` | Modal pentru crearea unui proiect nou. |

### 4.2. Fluxul de Stare în `ProjectEditor`

`ProjectEditor.tsx` acționează ca un 
`container component` pentru pagina de editare, orchestrând interacțiunile dintre celelalte componente:

1.  **Încărcare Inițială:** La montare, `ProjectEditor` face fetch la `/api/projects/[id]/text` pentru a încărca toate chunk-urile proiectului și le stochează în starea `chunks`.
2.  **Selecție Chunk:** Când utilizatorul dă click pe un chunk în `TextEditor`, acesta apelează `onChunkSelect`. `ProjectEditor` actualizează `selectedChunkIndex` și face fetch la `/api/chunks/[id]/generate` pentru a încărca variantele audio ale chunk-ului selectat.
3.  **Modificare Setări:** Când utilizatorul modifică setările în `VoiceSettings`, componenta respectivă face direct un request `PUT` la API-ul corespunzător (`/api/projects/[id]/voice` sau `/api/chunks/[id]/settings`). După succes, apelează `onChunkSettingsChange` pentru a notifica `ProjectEditor` să reîncarce datele.
4.  **Generare Audio:** Click pe "Generează" în panoul din dreapta declanșează un `POST` la `/api/chunks/[id]/generate`. După succes, `ProjectEditor` reîncarcă variantele audio.
5.  **Playback Audio:** Click pe butonul de play al unei variante audio actualizează starea player-ului din footer (`currentAudioVariantId`), setând `src`-ul elementului `<audio>` la `/api/audio/[variantId]`.

---

## 5. Backend (API Routes)

Logica de business și interacțiunea cu baza de date sunt gestionate de API Routes în `src/app/api/`.

### 5.1. Endpoint-uri Cheie

| Endpoint | Metode | Descriere |
|---|---|---|
| `/api/projects` | `GET`, `POST` | `GET`: Listează toate proiectele. `POST`: Creează un proiect nou. |
| `/api/projects/[id]` | `GET`, `PUT`, `DELETE` | `GET`: Obține un proiect. `PUT`: Redenumește. `DELETE`: Șterge. |
| `/api/projects/[id]/text` | `GET`, `PUT` | `GET`: Obține chunk-urile. `PUT`: Sincronizează textul complet, creând/actualizând/ștergând chunk-uri. **Acesta este un endpoint critic pentru logica editorului.** |
| `/api/projects/[id]/voice` | `GET`, `PUT` | Gestionează setările de voce **default** ale proiectului. |
| `/api/chunks/[id]/settings` | `GET`, `PUT`, `DELETE` | Gestionează setările de voce **custom** pentru un singur chunk. |
| `/api/chunks/[id]/generate` | `POST`, `GET` | `POST`: Lansează generarea a 5 variante audio pentru un chunk. `GET`: Obține statusul și lista variantelor. |
| `/api/audio/[variantId]` | `GET` | Returnează fișierul audio (Buffer) pentru o variantă specifică, permițând streaming-ul în player. |
| `/api/projects/[id]/export` | `POST` | Concatenează variantele audio active folosind FFMPEG API și returnează un singur fișier MP3. |
| `/api/projects/[id]/export-zip` | `POST` | Creează o arhivă ZIP cu toate fișierele audio individuale. |
| `/api/voices` | `GET` | Acționează ca un proxy către API-ul ElevenLabs pentru a obține lista de voci disponibile. |

### 5.2. Logica de Sincronizare a Textului (`PUT /api/projects/[id]/text`)

Acest endpoint este responsabil pentru a menține baza de date sincronizată cu textul din editor. Logica sa este esențială:

1.  Primește textul complet (`full_text`) de la frontend.
2.  Împarte textul în linii (`\n`) pentru a obține un array de `newChunkTexts`.
3.  Compară acest array cu `existingChunks` din baza de date, linie cu linie (după index).
4.  **Dacă un chunk există dar textul diferă:** Actualizează textul și **șterge toate variantele audio asociate** pentru a forța regenerarea.
5.  **Dacă un chunk nu există la un anumit index:** Creează un chunk nou.
6.  **Dacă există mai multe chunk-uri în DB decât în textul nou:** Șterge chunk-urile în plus.
7.  Toate operațiile sunt executate într-o tranzacție pentru a asigura consistența.

### 5.3. Generarea Audio (`POST /api/chunks/[id]/generate`)

1.  Apelează funcția `getSettingsForChunk()` pentru a determina ce setări de voce să folosească (cele custom ale chunk-ului sau cele default ale proiectului).
2.  Generează 5 variante audio în paralel, creând mai întâi înregistrarea `AudioVariant` în DB cu statusul `processing`.
3.  Pentru fiecare variantă, face un request la API-ul ElevenLabs.
4.  La primirea răspunsului, salvează buffer-ul audio (`audioData`) în baza de date și actualizează statusul la `done` sau `error`.

---

## 6. Concluzii și Pași Următori

Aplicația are o fundație solidă, cu o separare clară a responsabilităților între frontend și backend. Utilizarea Prisma și a unui sistem dual de baze de date (SQLite/Turso) oferă flexibilitate maximă pentru dezvoltare și deployment.

Documentația `PROGRESS.md` oferă un istoric detaliat al deciziilor și implementărilor pe faze, fiind o resursă valoroasă pentru înțelegerea evoluției proiectului.

**Direcții viitoare (Faza 7):**

-   **Optimizare:** Analiza performanței la încărcarea proiectelor mari și optimizarea query-urilor Prisma.
-   **UI/UX Polish:** Îmbunătățirea feedback-ului vizual pentru utilizator, adăugarea de tranziții și micro-interacțiuni.
-   **Error Handling:** Implementarea unui sistem mai robust de afișare a erorilor către utilizator (ex: toast notifications).
-   **Funcționalități Noi:** Adăugarea de pauze configurabile între chunk-uri la export, afișarea duratei totale estimate a audiobook-ului.
