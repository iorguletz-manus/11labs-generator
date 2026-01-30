# 📋 PRD Tehnic - 11Labs Audiobook Generator

**Versiune:** 4.0  
**Data:** 30 Ianuarie 2026  
**Status:** Production

---

## 📑 Cuprins

1. [Prezentare Generală](#1-prezentare-generală)
2. [Arhitectură Tehnică](#2-arhitectură-tehnică)
3. [Schema Bazei de Date](#3-schema-bazei-de-date)
4. [API Routes](#4-api-routes)
5. [Componente Frontend](#5-componente-frontend)
6. [Fluxuri Principale](#6-fluxuri-principale)
7. [Integrări Externe](#7-integrări-externe)
8. [Environment Variables](#8-environment-variables)
9. [Deployment](#9-deployment)
10. [Decizii de Design](#10-decizii-de-design)

---

## 1. Prezentare Generală

### 1.1 Scop
Aplicație web pentru generarea de audiobook-uri folosind ElevenLabs API. Permite:
- Crearea de proiecte cu text segmentat în chunk-uri
- Generarea de variante audio pentru fiecare chunk
- Setări globale (nivel proiect) și custom (nivel chunk)
- Export final ca ZIP cu toate audio-urile

### 1.2 Stack Tehnologic
- **Frontend:** Next.js 16.1.3 (App Router), React 19.2.3, TailwindCSS 4
- **Backend:** Next.js API Routes (serverless)
- **Database:** SQLite (local dev) + Turso/LibSQL (production)
- **ORM:** Prisma 5.22.0
- **External API:** ElevenLabs Text-to-Speech
- **Deployment:** Vercel
- **Package Manager:** pnpm

### 1.3 Versiuni Majore
- **v1-v3:** Funcționalități de bază
- **v4 (current):** Adăugat suport pentru setări custom per chunk

---

## 2. Arhitectură Tehnică

### 2.1 Structura Proiectului

```
11labs-generator/
├── prisma/
│   ├── schema.prisma          # Schema DB
│   ├── migrations/            # Migrări Prisma
│   └── dev.db                 # SQLite local
├── src/
│   ├── app/
│   │   ├── api/               # API Routes (Next.js)
│   │   ├── projects/          # Pages pentru proiecte
│   │   ├── layout.tsx         # Root layout
│   │   └── page.tsx           # Home page
│   ├── components/            # React components
│   └── lib/
│       └── prisma.ts          # Prisma client singleton
├── public/                    # Static assets
└── scripts/                   # Utility scripts
```

### 2.2 Arhitectură Aplicație

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│  (Next.js App Router + React Components)                    │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ ProjectList  │  │ProjectEditor │  │ TextEditor   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │VoiceSettings │  │ChunkSettings │  │ConfirmDialog │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Routes (Backend)                      │
│                                                              │
│  /api/projects              - CRUD proiecte                 │
│  /api/projects/[id]/text    - Salvare text chunks           │
│  /api/projects/[id]/voice   - Setări voce proiect           │
│  /api/projects/[id]/export  - Export MP3 final              │
│  /api/chunks/[id]/generate  - Generare audio chunk          │
│  /api/chunks/[id]/settings  - Setări custom chunk           │
│  /api/variants/[id]         - CRUD variante audio           │
│  /api/voices                - Lista voci ElevenLabs         │
│  /api/models                - Lista modele ElevenLabs       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Prisma ORM                                │
│                                                              │
│  Models: Project, Chunk, AudioVariant                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Database                                  │
│                                                              │
│  Local: SQLite (dev.db)                                     │
│  Production: Turso/LibSQL (cloud)                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                External API: ElevenLabs                      │
│                                                              │
│  - Text-to-Speech generation                                │
│  - Voice listing                                            │
│  - Model listing                                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Schema Bazei de Date

### 3.1 Model ER

```
┌─────────────────────────────────────────────┐
│              Project                         │
├─────────────────────────────────────────────┤
│ id (PK)            String (cuid)            │
│ name               String                    │
│ voiceId            String? (nullable)        │
│ voiceSettings      String? (JSON)           │
│ createdAt          DateTime                  │
│ updatedAt          DateTime                  │
└─────────────────────────────────────────────┘
                    │
                    │ 1:N
                    ▼
┌─────────────────────────────────────────────┐
│              Chunk                           │
├─────────────────────────────────────────────┤
│ id (PK)                String (cuid)        │
│ projectId (FK)         String               │
│ text                   String               │
│ order                  Int                  │
│ useCustomSettings      Boolean (default: false) │
│ customVoiceId          String? (nullable)   │
│ customVoiceSettings    String? (JSON)       │
│ createdAt              DateTime             │
│ updatedAt              DateTime             │
└─────────────────────────────────────────────┘
                    │
                    │ 1:N
                    ▼
┌─────────────────────────────────────────────┐
│           AudioVariant                       │
├─────────────────────────────────────────────┤
│ id (PK)                String (cuid)        │
│ chunkId (FK)           String               │
│ variantNumber          Int                  │
│ audioUrl               String? (nullable)   │
│ audioData              Bytes? (nullable)    │
│ isActive               Boolean (default: false) │
│ status                 String (default: "queued") │
│ progress               Int (default: 0)     │
│ errorMessage           String? (nullable)   │
│ usedVoiceId            String? (nullable)   │
│ usedVoiceSettings      String? (JSON)       │
│ createdAt              DateTime             │
└─────────────────────────────────────────────┘
```

### 3.2 Relații
- **Project → Chunk:** 1:N (cascade delete)
- **Chunk → AudioVariant:** 1:N (cascade delete)

### 3.3 Indexuri
- `Chunk`: `[projectId, order]`
- `AudioVariant`: `[chunkId]`, unique `[chunkId, variantNumber]`

### 3.4 JSON Fields
**voiceSettings** și **customVoiceSettings**:
```json
{
  "stability": 0.5,
  "similarity": 0.75,
  "style": 0.0,
  "speed": 1.0,
  "model": "eleven_multilingual_v2"
}
```

---

## 4. API Routes

### 4.1 Projects

#### `GET /api/projects`
- **Scop:** Lista toate proiectele
- **Response:** `Project[]`

#### `POST /api/projects`
- **Scop:** Creează proiect nou
- **Body:** `{ name: string }`
- **Response:** `Project`

#### `GET /api/projects/[id]`
- **Scop:** Detalii proiect + chunks + variante
- **Response:** `Project & { chunks: (Chunk & { variants: AudioVariant[] })[] }`

#### `DELETE /api/projects/[id]`
- **Scop:** Șterge proiect (cascade delete chunks și variante)
- **Response:** `{ success: true }`

#### `PUT /api/projects/[id]/text`
- **Scop:** Salvează text-ul proiectului (split în chunks)
- **Body:** `{ text: string }`
- **Logic:** 
  - Split text by `\n\n` (paragrafe)
  - Creează/actualizează chunks în ordinea corectă
  - Șterge chunks în plus
- **Response:** `{ chunks: Chunk[] }`

#### `PUT /api/projects/[id]/voice`
- **Scop:** Salvează setările de voce globale
- **Body:** `{ voiceId?: string, voiceSettings?: VoiceSettings }`
- **Response:** `Project`

#### `GET /api/projects/[id]/export`
- **Scop:** Concatenează toate audio-urile active într-un MP3 final
- **Logic:**
  - Găsește varianta activă pentru fiecare chunk (în ordine)
  - Concatenează audio-urile folosind FFmpeg
- **Response:** Audio stream (MP3)

#### `GET /api/projects/[id]/export-zip`
- **Scop:** Export ZIP cu toate audio-urile active
- **Response:** ZIP stream

---

### 4.2 Chunks

#### `POST /api/chunks/[id]/generate`
- **Scop:** Generează 5 variante audio pentru un chunk
- **Body:** `{ text?: string }` (optional - folosit pentru text nou din editor)
- **Logic:**
  1. **ȘTERGE** toate variantele vechi: `prisma.audioVariant.deleteMany({ where: { chunkId } })`
  2. Determină setările de voce:
     - Dacă `chunk.useCustomSettings = true` → folosește `customVoiceId` și `customVoiceSettings`
     - Altfel → folosește setările de la proiect
  3. Generează 5 variante în paralel cu ElevenLabs API
  4. Salvează fiecare variantă în DB cu `usedVoiceId` și `usedVoiceSettings` (snapshot)
- **Response:** `{ success: true, variants: AudioVariant[] }`

#### `PUT /api/chunks/[id]/settings`
- **Scop:** Salvează setări custom per chunk
- **Body:** `{ useCustomSettings: boolean, customVoiceId?: string, customVoiceSettings?: VoiceSettings }`
- **Response:** `Chunk`

---

### 4.3 Variants

#### `DELETE /api/variants/[id]`
- **Scop:** Șterge o variantă audio
- **Response:** `{ success: true }`

#### `POST /api/variants/[id]/activate`
- **Scop:** Activează o variantă (dezactivează celelalte din același chunk)
- **Logic:**
  1. Dezactivează toate variantele chunk-ului: `isActive = false`
  2. Activează varianta curentă: `isActive = true`
- **Response:** `AudioVariant`

---

### 4.4 ElevenLabs

#### `GET /api/voices`
- **Scop:** Lista voci disponibile din ElevenLabs
- **Response:** `Voice[]` (de la ElevenLabs API)

#### `GET /api/models`
- **Scop:** Lista modele disponibile din ElevenLabs
- **Response:** `Model[]` (de la ElevenLabs API)

#### `GET /api/audio/[variantId]`
- **Scop:** Servește audio-ul unei variante
- **Response:** Audio stream

---

## 5. Componente Frontend

### 5.1 Pages

#### `/` - Home Page
- **Componente:** `ProjectList`
- **Funcționalitate:** Listează toate proiectele, buton "Create New Project"

#### `/projects/[id]` - Project Editor
- **Componente:** `ProjectEditor`, `TextEditor`, `VoiceSettings`, `ChunkSettings`
- **Funcționalitate:** Editor complet pentru proiect

---

### 5.2 Componente Principale

#### `ProjectList.tsx`
- **Scop:** Afișează lista de proiecte
- **State:** `projects: Project[]`
- **Actions:** 
  - Deschide proiect
  - Șterge proiect (cu confirmare)
  - Creează proiect nou (modal)

#### `ProjectEditor.tsx`
- **Scop:** Container principal pentru editarea proiectului
- **State:**
  - `project: Project`
  - `chunks: (Chunk & { variants: AudioVariant[], hasAudio: boolean })[]`
  - `selectedChunkIndex: number`
- **Actions:**
  - `handleGenerateAudio(chunkId)` - Generează audio pentru chunk selectat
  - `handleGenerateAll()` - Generează audio pentru toate chunk-urile
  - `handleDeleteVariant(variantId)` - Șterge variantă
  - `handleActivateVariant(variantId)` - Activează variantă
  - `handleExport()` - Export MP3 final
  - `handleExportZip()` - Export ZIP
- **Important:** 
  - După generare/ștergere, **NU** reîncarcă chunk-urile de pe server (`loadChunks()`)
  - Actualizează doar `hasAudio` local în state cu `setChunks()`
  - Previne race condition între salvare și reîncărcare

#### `TextEditor.tsx`
- **Scop:** Editor de text cu autosave
- **Props:** `projectId: string`, `initialChunks: Chunk[]`
- **State:**
  - `chunks: Chunk[]`
  - `chunksRef: React.MutableRefObject<Chunk[]>` (pentru blur handler)
  - `autosaveTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>`
- **Autosave Logic:**
  - **Delay:** 10 secunde după ultima modificare
  - **Blur:** Salvare instant când utilizatorul dă click în afară
  - **Reset:** Timer se resetează la fiecare tastă apăsată
- **Important:**
  - Folosește `chunksRef.current` în `onBlur` pentru a avea întotdeauna chunk-urile actuale
  - Previne pierderea modificărilor când utilizatorul dă click în afară rapid

#### `VoiceSettings.tsx`
- **Scop:** Setări de voce globale (nivel proiect)
- **Props:** `projectId: string`, `initialVoiceId?: string`, `initialVoiceSettings?: VoiceSettings`
- **State:**
  - `voices: Voice[]` (de la ElevenLabs)
  - `models: Model[]` (de la ElevenLabs)
  - `voiceId: string`
  - `voiceSettings: VoiceSettings`
- **Actions:**
  - Salvează setări de voce globale
  - Preview voce (play sample)

#### `ChunkSettings.tsx`
- **Scop:** Setări custom per chunk (override)
- **Props:** `chunk: Chunk`, `onSave: (settings) => void`
- **State:**
  - `useCustomSettings: boolean`
  - `customVoiceId?: string`
  - `customVoiceSettings?: VoiceSettings`
- **Actions:**
  - Toggle custom settings
  - Salvează setări custom

#### `ConfirmDialog.tsx`
- **Scop:** Dialog de confirmare pentru acțiuni destructive
- **Props:** `open: boolean`, `title: string`, `message: string`, `onConfirm: () => void`, `onCancel: () => void`

#### `CreateProjectModal.tsx`
- **Scop:** Modal pentru crearea de proiect nou
- **Props:** `open: boolean`, `onClose: () => void`, `onCreate: (name: string) => void`

---

## 6. Fluxuri Principale

### 6.1 Flux: Creare Proiect

```
User                    Frontend                API                    DB
 │                         │                     │                     │
 │  Click "New Project"    │                     │                     │
 ├────────────────────────>│                     │                     │
 │                         │                     │                     │
 │  Introduce nume         │                     │                     │
 ├────────────────────────>│                     │                     │
 │                         │                     │                     │
 │                         │  POST /api/projects │                     │
 │                         ├────────────────────>│                     │
 │                         │                     │                     │
 │                         │                     │  INSERT Project     │
 │                         │                     ├────────────────────>│
 │                         │                     │                     │
 │                         │                     │  Project            │
 │                         │                     │<────────────────────┤
 │                         │                     │                     │
 │                         │  { project }        │                     │
 │                         │<────────────────────┤                     │
 │                         │                     │                     │
 │  Redirect /projects/[id]│                     │                     │
 │<────────────────────────┤                     │                     │
```

### 6.2 Flux: Salvare Text (Autosave)

```
User                    TextEditor              API                    DB
 │                         │                     │                     │
 │  Scrie text             │                     │                     │
 ├────────────────────────>│                     │                     │
 │                         │                     │                     │
 │                         │  onChange           │                     │
 │                         │  - Split by \n\n    │                     │
 │                         │  - setChunks()      │                     │
 │                         │  - Start timer (10s)│                     │
 │                         │                     │                     │
 │  [10s pass]             │                     │                     │
 │                         │                     │                     │
 │                         │  saveText()         │                     │
 │                         │  PUT /api/.../text  │                     │
 │                         ├────────────────────>│                     │
 │                         │                     │                     │
 │                         │                     │  UPSERT Chunks      │
 │                         │                     ├────────────────────>│
 │                         │                     │                     │
 │                         │                     │  Chunks             │
 │                         │                     │<────────────────────┤
 │                         │                     │                     │
 │                         │  { chunks }         │                     │
 │                         │<────────────────────┤                     │
 │                         │                     │                     │
 │                         │  Status: "Salvat ✓" │                     │
 │<────────────────────────┤                     │                     │
```

**Alternativ: Salvare la Blur**
```
User                    TextEditor              API                    DB
 │                         │                     │                     │
 │  Click în afară         │                     │                     │
 ├────────────────────────>│                     │                     │
 │                         │                     │                     │
 │                         │  onBlur             │                     │
 │                         │  - Clear timer      │                     │
 │                         │  - saveText(chunksRef.current) │          │
 │                         │  PUT /api/.../text  │                     │
 │                         ├────────────────────>│                     │
 │                         │                     │                     │
 │                         │                     │  UPSERT Chunks      │
 │                         │                     ├────────────────────>│
```

### 6.3 Flux: Generare Audio

```
User                    ProjectEditor           API                    ElevenLabs
 │                         │                     │                     │
 │  Click "Generate"       │                     │                     │
 ├────────────────────────>│                     │                     │
 │                         │                     │                     │
 │                         │  POST /api/chunks/[id]/generate │         │
 │                         │  Body: { text: chunk.text }     │         │
 │                         ├────────────────────>│                     │
 │                         │                     │                     │
 │                         │                     │  DELETE variants    │
 │                         │                     │  (șterge vechi)     │
 │                         │                     │                     │
 │                         │                     │  Determine settings │
 │                         │                     │  (custom sau global)│
 │                         │                     │                     │
 │                         │                     │  POST /v1/text-to-speech │
 │                         │                     ├────────────────────>│
 │                         │                     │                     │
 │                         │                     │  Audio data (x5)    │
 │                         │                     │<────────────────────┤
 │                         │                     │                     │
 │                         │                     │  INSERT variants    │
 │                         │                     │  (5 noi)            │
 │                         │                     │                     │
 │                         │  { variants }       │                     │
 │                         │<────────────────────┤                     │
 │                         │                     │                     │
 │                         │  setChunks(...)     │                     │
 │                         │  - Update hasAudio=true LOCAL │           │
 │                         │  - NU reîncarcă de pe server  │           │
 │                         │                     │                     │
 │  Afișează variante      │                     │                     │
 │<────────────────────────┤                     │                     │
```

### 6.4 Flux: Export Final

```
User                    ProjectEditor           API                    FFmpeg
 │                         │                     │                     │
 │  Click "Export"         │                     │                     │
 ├────────────────────────>│                     │                     │
 │                         │                     │                     │
 │                         │  GET /api/projects/[id]/export │          │
 │                         ├────────────────────>│                     │
 │                         │                     │                     │
 │                         │                     │  Găsește variante active │
 │                         │                     │  (în ordine chunks) │
 │                         │                     │                     │
 │                         │                     │  Concatenate audio  │
 │                         │                     ├────────────────────>│
 │                         │                     │                     │
 │                         │                     │  MP3 final          │
 │                         │                     │<────────────────────┤
 │                         │                     │                     │
 │                         │  Audio stream       │                     │
 │                         │<────────────────────┤                     │
 │                         │                     │                     │
 │  Download MP3           │                     │                     │
 │<────────────────────────┤                     │                     │
```

---

## 7. Integrări Externe

### 7.1 ElevenLabs API

**Base URL:** `https://api.elevenlabs.io`

#### Endpoints folosite:

**1. Text-to-Speech**
```
POST /v1/text-to-speech/{voice_id}
Headers:
  xi-api-key: {ELEVENLABS_API_KEY}
Body:
  {
    "text": "...",
    "model_id": "eleven_multilingual_v2",
    "voice_settings": {
      "stability": 0.5,
      "similarity_boost": 0.75,
      "style": 0.0,
      "use_speaker_boost": true
    }
  }
Response: Audio stream (MP3)
```

**2. Get Voices**
```
GET /v1/voices
Headers:
  xi-api-key: {ELEVENLABS_API_KEY}
Response:
  {
    "voices": [
      {
        "voice_id": "...",
        "name": "...",
        "preview_url": "...",
        ...
      }
    ]
  }
```

**3. Get Models**
```
GET /v1/models
Headers:
  xi-api-key: {ELEVENLABS_API_KEY}
Response:
  [
    {
      "model_id": "...",
      "name": "...",
      "languages": [...],
      ...
    }
  ]
```

### 7.2 FFmpeg (pentru export)

**Folosit pentru:** Concatenarea audio-urilor în MP3 final

**Comandă tipică:**
```bash
ffmpeg -i "concat:file1.mp3|file2.mp3|file3.mp3" -acodec copy output.mp3
```

---

## 8. Environment Variables

### 8.1 Variabile Necesare

```bash
# ElevenLabs API
ELEVENLABS_API_KEY=sk_...

# Database - Local Development
DATABASE_URL=file:./dev.db

# Database - Production (Turso)
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=eyJ...
```

### 8.2 Configurare

**Local (.env):**
```bash
DATABASE_URL=file:./dev.db
ELEVENLABS_API_KEY=sk_...
```

**Production (Vercel):**
- Setate în Vercel Dashboard → Settings → Environment Variables
- Toate variabilele sunt setate pentru "All Environments"

---

## 9. Deployment

### 9.1 Vercel

**Repository:** `iorguletz-manus/11labs-generator`  
**Branch:** `main`  
**Auto-deploy:** Da (la fiecare push pe main)

**Build Command:**
```bash
prisma generate && next build
```

**Install Command:**
```bash
pnpm install
```

**Output Directory:** `.next`

### 9.2 Database Migrations

**Local:**
```bash
pnpm prisma migrate dev
```

**Production:**
- Migrările se aplică automat la build pe Vercel
- Turso/LibSQL se sincronizează automat

---

## 10. Decizii de Design

### 10.1 De ce Prisma + SQLite/Turso?
- **Prisma:** ORM type-safe, migrări automate, suport excelent pentru Next.js
- **SQLite:** Simplu pentru development local, zero configurare
- **Turso:** SQLite în cloud, latență mică, scaling automat

### 10.2 De ce Next.js App Router?
- **Server Components:** Performance mai bun, SEO
- **API Routes:** Backend și frontend în același proiect
- **Streaming:** Suport nativ pentru streaming audio

### 10.3 De ce setări custom per chunk (v4)?
- **Flexibilitate:** Utilizatorii pot folosi voci diferite pentru naratori diferiți
- **Override:** Setările custom au prioritate față de cele globale
- **Snapshot:** `usedVoiceSettings` păstrează setările exacte folosite la generare

### 10.4 De ce autosave cu delay + blur?
- **UX:** Utilizatorul nu trebuie să apese "Save" manual
- **Performance:** Delay de 10s previne request-uri excesive
- **Blur:** Salvare instant când utilizatorul schimbă focus-ul

### 10.5 De ce ștergere variante vechi la regenerare?
- **Consistență:** Evită confuzia cu variante vechi generate cu text/setări diferite
- **Storage:** Economisește spațiu în DB
- **UX:** Utilizatorul vede doar variantele relevante pentru textul curent

### 10.6 De ce NU reîncărcăm chunk-urile după generare?
- **Race condition:** Dacă reîncărcăm de pe server înainte ca salvarea să se finalizeze, aducem textul vechi
- **Performance:** Actualizarea locală a `hasAudio` este instant
- **Consistență:** Păstrăm textul din editor, nu îl suprascrim

---

## 📝 Note Finale

### Modificări Recente (30 Ian 2026)
1. ✅ Fix autosave: folosește `chunksRef` în `onBlur` pentru a preveni pierderea modificărilor
2. ✅ Fix race condition: elimină `loadChunks()` după generare/ștergere, actualizează `hasAudio` local
3. ✅ Fix generare cu text vechi: API primește textul în body, șterge variantele vechi înainte de generare

### Best Practices
- **Întotdeauna testează local** înainte de push pe production
- **Folosește Prisma Studio** pentru debugging DB: `pnpm prisma studio`
- **Verifică logurile Vercel** pentru erori în production
- **Păstrează .env securizat** - nu face commit cu chei API

### Resurse
- [ElevenLabs API Docs](https://elevenlabs.io/docs/api-reference)
- [Prisma Docs](https://www.prisma.io/docs)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Turso Docs](https://docs.turso.tech)

---

**Versiune PRD:** 1.0  
**Ultima actualizare:** 30 Ianuarie 2026  
**Autor:** Manus AI Agent
