# 11Labs Audiobook Generator - Progres și Decizii

**Ultima actualizare:** 23 Ianuarie 2026

---

## Stadiu Faze

| Fază | Descriere | Status | Data |
|------|-----------|--------|------|
| 1 | Setup și Fundație | ✅ Completă | 18 Ian 2026 |
| 2 | Proiecte CRUD | ✅ Completă | 18 Ian 2026 |
| 3 | Editor Text și Chunk-uri | ✅ Completă | 18 Ian 2026 |
| 4 | Setări Voce (v4 - Dual) | ✅ Completă | 21 Ian 2026 |
| 5 | Generare Audio (5 variante) | ✅ Completă | 23 Ian 2026 |
| 6 | Export Final MP3 | ✅ Completă | 23 Ian 2026 |
| 7 | Polish și Optimizări | ⏳ În așteptare | - |

---

## Decizii Importante

### Arhitectură

| Decizie | Alegere | Motiv |
|---------|---------|-------|
| Framework | Next.js 16 + TypeScript | Recomandat în specificații |
| Styling | Tailwind CSS 4 | Rapid și flexibil |
| ORM | Prisma 5.22 | Suport SQLite + Turso |
| DB Development | SQLite local (dev.db) | Simplu, fără dependențe |
| DB Production | Turso (libsql) | SQLite în cloud, gratuit |
| Hosting | Vercel | Auto-deploy din GitHub |
| Audio Concat | ffmpeg | Pentru concatenare MP3 la export |

### UI/UX

| Decizie | Alegere | Motiv |
|---------|---------|-------|
| Lista proiecte | Listă (nu carduri) | Cerință utilizator |
| Creare proiect | Modal cu input nume | Cerință utilizator (nu navigare directă) |
| Navigare | /projects → /projects/[id] | Conform specificații v1.1 |
| Header editor | "← Înapoi" + Nume proiect | Conform specificații v1.1 |
| Editor text | Textarea per chunk | Simplu și robust |
| Setări voce | Dual (Default + Custom per Chunk) | Conform specificații v4 |
| Player audio | Footer fix | Întotdeauna vizibil în partea de jos |
| Variante audio | 5 per chunk | Generare simultană cu selecție activă |

---

## Configurare Medii

### Development (Local)

```env
DATABASE_URL="file:./prisma/dev.db"
TURSO_DATABASE_URL="libsql://elevenlabsgenerator-evolva-ascendis.aws-eu-west-1.turso.io"
TURSO_AUTH_TOKEN="[token]"
ELEVENLABS_API_KEY="[key]"
```

### Production (Vercel)

Environment variables setate în Vercel Dashboard:
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `ELEVENLABS_API_KEY`
- `DATABASE_URL` (pentru build)

---

## Structura Rutelor

```
/                    → Redirect la /projects
/projects            → Lista proiecte (CRUD)
/projects/[id]       → Editor proiect (3 coloane)
/api/projects        → GET (lista), POST (creare)
/api/projects/[id]   → GET, PUT (redenumire), DELETE
/api/projects/[id]/text → GET (chunk-uri), PUT (salvare text)
/api/projects/[id]/voice → GET, PUT (setări voce)
/api/projects/[id]/export → GET (verificare), POST (export MP3)
/api/chunks/[id]/settings → GET, PUT, DELETE (setări custom per chunk)
/api/chunks/[id]/generate → GET (variante), POST (generare 5 variante audio)
/api/audio/[variantId] → GET (streaming audio pentru playback)
/api/variants/[id] → DELETE (ștergere variantă)
/api/variants/[id]/activate → PUT (setare variantă activă)
/api/voices          → GET (lista voci ElevenLabs)
/api/models          → GET (lista modele ElevenLabs)
```

---

## Componente Create

### Faza 2

- `ProjectList.tsx` - Lista proiecte cu redenumire inline și ștergere
- `CreateProjectModal.tsx` - Modal pentru creare proiect cu validare
- `ConfirmDialog.tsx` - Dialog generic de confirmare

### Faza 3

- `TextEditor.tsx` - Editor text cu chunk-uri, autosave și salvare manuală (Ctrl+S)
- `ProjectEditor.tsx` - Wrapper pentru pagina editor cu 3 coloane
- API `/api/projects/[id]/text` - Endpoint pentru salvare și sincronizare chunk-uri

### Faza 4 (v4 - Sistem Dual)

- `VoiceSettings.tsx` - Container pentru cele două secțiuni de setări
- `ProjectSettings.tsx` - Secțiunea "Setări Proiect (Default)"
- `ChunkSettings.tsx` - Secțiunea "Setări Chunk Selectat"
- API `/api/voices` - Proxy pentru ElevenLabs voices API
- API `/api/models` - Proxy pentru ElevenLabs models API
- API `/api/projects/[id]/voice` - Endpoint pentru salvare setări voce proiect
- API `/api/chunks/[id]/settings` - Endpoint pentru setări custom per chunk

### Faza 5 (Generare Audio - 5 Variante)

- API `/api/chunks/[id]/generate` - Endpoint pentru generare 5 variante audio simultan
- API `/api/audio/[variantId]` - Endpoint pentru streaming audio (playback)
- API `/api/variants/[id]` - Endpoint pentru ștergere variantă
- API `/api/variants/[id]/activate` - Endpoint pentru activare variantă
- Funcția `getSettingsForChunk()` - Determină setările de folosit (default vs custom)
- Player audio în footer fix cu Play/Pause și progress bar
- Buton "Generează Toate" pentru generare în batch
- UI lista variante cu radio buttons pentru selecție activă

### Faza 6 (Export Final MP3)

- API `/api/projects/[id]/export` - Endpoint pentru export MP3
  - GET: Verifică dacă exportul este posibil
  - POST: Concatenează variantele active și returnează fișierul MP3
- Buton "Export Final MP3" în Coloana 3
- Validare că toate chunk-urile au audio înainte de export
- Concatenare cu ffmpeg

---

## Funcționalități Faza 3

### Editor Text

| Funcționalitate | Status | Descriere |
|-----------------|--------|-----------|
| Editare text | ✅ | Textarea pentru fiecare chunk |
| Creare chunk (Enter) | ✅ | Apăsarea Enter creează un chunk nou |
| Unire chunk (Backspace) | ✅ | Backspace la început unește cu chunk-ul anterior |
| Unire chunk (Delete) | ✅ | Delete la final unește cu chunk-ul următor |
| Autosave | ✅ | Salvare automată la 2 secunde de inactivitate |
| Salvare manuală | ✅ | Ctrl+S / Cmd+S pentru salvare imediată |
| Indicator salvare | ✅ | "Salvat ✓", "Nesalvat", "Se salvează..." |
| Validare lungime | ✅ | Avertisment pentru chunk-uri > 5000 caractere |
| Selectare chunk | ✅ | Click pe chunk afișează opțiuni audio în panoul drept |
| Paste multi-linie | ✅ | Text paste-uit cu Enter-uri creează chunk-uri multiple |
| Icon setări custom | ✅ | ⚙️ pentru chunk-uri cu useCustomSettings = true |
| Navigare săgeți | ✅ | Săgeți sus/jos navighează între chunk-uri la început/sfârșit |
| Ctrl+A | ✅ | Selectează toate chunk-urile |

### Indicatori Vizuali Chunk

| Status | Culoare Border |
|--------|----------------|
| Fără audio | Gri (#9CA3AF) |
| În generare | Albastru (#3B82F6) + glow effect |
| Audio generat | Verde (#22C55E) |
| Setări custom | Icon ⚙️ în colțul dreapta-sus |

---

## Funcționalități Faza 4 (v4)

### Sistem Dual de Setări

| Funcționalitate | Status | Descriere |
|-----------------|--------|-----------|
| Secțiunea 1: Setări Proiect | ✅ | Setări default pentru toate chunk-urile |
| Secțiunea 2: Setări Chunk | ✅ | Apare doar când un chunk este selectat |
| Toggle ON/OFF | ✅ | Toggle între setările proiectului și custom |
| Collapse/Expand | ✅ | Când custom ON, default collapsed și invers |
| Salvare automată | ✅ | Setările se salvează imediat la schimbare |
| Resetare la default | ✅ | Buton pentru a reveni la setările proiectului |
| Icon ⚙️ pe chunk | ✅ | Indicator vizual pentru chunk-uri cu setări custom |

### Setări Voce (ambele secțiuni)

| Funcționalitate | Status | Descriere |
|-----------------|--------|-----------|
| Dropdown voce | ✅ | Lista vocilor din contul ElevenLabs |
| Dropdown model | ✅ | Lista modelelor TTS (eleven_multilingual_v2, etc.) |
| Slider Stability | ✅ | 0-100%, default 50% |
| Slider Similarity Boost | ✅ | 0-100%, default 75% |
| Slider Style | ✅ | 0-100%, default 0% |
| Slider Speed | ✅ | 0.5x-2.0x, default 1.0x |

### Schema Prisma (câmpuri noi v4)

**Model Chunk:**
- `useCustomSettings Boolean @default(false)`
- `customVoiceId String?`
- `customVoiceSettings Json?`

**Model AudioVariant:**
- `usedVoiceId String?`
- `usedVoiceSettings Json?`

---

## Funcționalități Faza 5

### Generare Audio (5 Variante)

| Funcționalitate | Status | Descriere |
|-----------------|--------|-----------|
| Endpoint generare | ✅ | POST /api/chunks/[id]/generate - generează 5 variante |
| Endpoint streaming | ✅ | GET /api/audio/[variantId] |
| Endpoint activare | ✅ | PUT /api/variants/[id]/activate |
| Endpoint ștergere | ✅ | DELETE /api/variants/[id] |
| getSettingsForChunk() | ✅ | Determină setările (default vs custom) |
| Salvare snapshot | ✅ | usedVoiceId și usedVoiceSettings în AudioVariant |
| Stocare audio | ✅ | Audio salvat ca Buffer în baza de date |
| Indicator generare | ✅ | "Se generează 5 variante audio..." cu animație |
| Player audio footer | ✅ | Player fix în footer, întotdeauna vizibil |
| Lista variante | ✅ | UI cu radio buttons pentru selecție activă |
| Buton Play per variantă | ✅ | ▶ pentru redare în player |
| Buton Șterge variantă | ✅ | 🗑 pentru ștergere |
| Generează Toate | ✅ | Generare în batch pentru toate chunk-urile |

### API-uri Faza 5

| Endpoint | Metodă | Descriere |
|----------|--------|-----------|
| `/api/chunks/[id]/generate` | POST | Generează 5 variante audio pentru un chunk |
| `/api/chunks/[id]/generate` | GET | Obține lista variantelor audio |
| `/api/audio/[variantId]` | GET | Streaming audio MP3 pentru playback |
| `/api/variants/[id]` | DELETE | Șterge o variantă audio |
| `/api/variants/[id]/activate` | PUT | Setează varianta ca activă |

### Logica getSettingsForChunk()

```
Dacă chunk.useCustomSettings === true && chunk.customVoiceId:
  → folosește chunk.customVoiceId + chunk.customVoiceSettings
Altfel:
  → folosește project.voiceId + project.voiceSettings
```

---

## Funcționalități Faza 6

### Export Final MP3

| Funcționalitate | Status | Descriere |
|-----------------|--------|-----------|
| Endpoint verificare | ✅ | GET /api/projects/[id]/export |
| Endpoint export | ✅ | POST /api/projects/[id]/export |
| Validare chunk-uri | ✅ | Verifică că toate au audio înainte de export |
| Concatenare ffmpeg | ✅ | Folosește ffmpeg pentru lipirea audio-urilor |
| Download fișier | ✅ | Returnează fișierul MP3 pentru descărcare |
| Nume fișier | ✅ | {nume_proiect}_audiobook.mp3 |
| Mesaj eroare | ✅ | Afișează chunk-urile fără audio |

### API-uri Faza 6

| Endpoint | Metodă | Descriere |
|----------|--------|-----------|
| `/api/projects/[id]/export` | GET | Verifică dacă exportul este posibil |
| `/api/projects/[id]/export` | POST | Concatenează și returnează MP3 |

---

## Modificări față de Specificații v1.0

1. **Pagina principală:** `/` redirect la `/projects` (nu dropdown în header)
2. **Management proiecte:** Pagină separată `/projects` cu listă
3. **Header editor:** Buton "← Înapoi" + nume proiect (nu dropdown)
4. **Creare proiect:** Modal cu input nume (nu creare directă cu nume default)
5. **Editor:** Textarea per chunk (nu contentEditable) - mai robust și mai simplu
6. **Footer statistici:** Eliminat (nu era necesar)
7. **Setări voce (v4):** Sistem dual cu setări default + custom per chunk
8. **Variante audio:** 5 variante per chunk cu selecție activă

---

## Probleme Rezolvate

| Problemă | Soluție |
|----------|---------|
| Prisma nu genera client pe Vercel | Adăugat `.npmrc` cu `public-hoist-pattern[]=*prisma*` |
| Warning Prisma build scripts | Nu afectează funcționalitatea, ignorat |
| Baza de date Turso goală | Creat script `scripts/setup-turso.py` pentru inițializare |
| Chunk-uri goale nu se salvau | Modificat API să păstreze chunk-uri goale |
| Coloana `order` lipsă în Turso | Recreat tabelele cu structura corectă |
| ElevenLabs models API 401 | API key nu are permisiunea models_read (funcționalitate opțională) |
| Buton Generează Toate dispare | Mutat în afara containerului scrollabil |
| Navigare săgeți între chunk-uri | Verificare poziție cursor la început/sfârșit text |

---

## Pași Următori (Faza 7)

1. Polish UI și UX
2. Optimizări performanță
3. Gestionare erori îmbunătățită
4. Posibilitate pauze între chunk-uri la export (opțional)
5. Afișare durată totală audiobook

---

## Documente Referință

- `Document Final de Specificații pentru Manus v4.md` - Specificații complete (versiunea curentă)
- `Workflow Deployment și Migrări.md` - Ghid deployment și backup

---

## Note pentru Chat Nou

La începutul unui chat nou în acest proiect:
1. Clonează repository-ul: `gh repo clone iorguletz-manus/11labs-generator`
2. Citește acest fișier `PROGRESS.md` pentru context
3. Citește specificațiile din Manus Files pentru detalii
4. Continuă de la faza curentă (marcată cu ⏳)

---

*Acest fișier trebuie actualizat la finalul fiecărei sesiuni de lucru.*
