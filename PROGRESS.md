# 11Labs Audiobook Generator - Progres și Decizii

**Ultima actualizare:** 21 Ianuarie 2026

---

## Stadiu Faze

| Fază | Descriere | Status | Data |
|------|-----------|--------|------|
| 1 | Setup și Fundație | ✅ Completă | 18 Ian 2026 |
| 2 | Proiecte CRUD | ✅ Completă | 18 Ian 2026 |
| 3 | Editor Text și Chunk-uri | ✅ Completă | 18 Ian 2026 |
| 4 | Setări Voce (v4 - Dual) | ✅ Completă | 21 Ian 2026 |
| 5 | Generare Audio (ElevenLabs) | ⏳ În așteptare | - |
| 6 | Audio Queue și Player | ⏳ În așteptare | - |
| 7 | Export și Concatenare | ⏳ În așteptare | - |
| 8 | Polish și Optimizări | ⏳ În așteptare | - |

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

### UI/UX

| Decizie | Alegere | Motiv |
|---------|---------|-------|
| Lista proiecte | Listă (nu carduri) | Cerință utilizator |
| Creare proiect | Modal cu input nume | Cerință utilizator (nu navigare directă) |
| Navigare | /projects → /projects/[id] | Conform specificații v1.1 |
| Header editor | "← Înapoi" + Nume proiect | Conform specificații v1.1 |
| Editor text | Textarea per chunk | Simplu și robust |
| Setări voce | Dual (Default + Custom per Chunk) | Conform specificații v4 |

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
/api/chunks/[id]/settings → GET, PUT, DELETE (setări custom per chunk)
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

### Indicatori Vizuali Chunk

| Status | Culoare Border |
|--------|----------------|
| Fără audio | Gri (#9CA3AF) |
| În generare | Albastru (#3B82F6) + animație pulse |
| Audio generat | Verde (#22C55E) |
| Setări custom | Icon ⚙️ în colțul dreapta-sus |

---

## Funcționalități Faza 4 (v4)

### Sistem Dual de Setări

| Funcționalitate | Status | Descriere |
|-----------------|--------|-----------|
| Secțiunea 1: Setări Proiect | ✅ | Setări default pentru toate chunk-urile |
| Secțiunea 2: Setări Chunk | ✅ | Apare doar când un chunk este selectat |
| Radio Default/Custom | ✅ | Toggle între setările proiectului și custom |
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

### API-uri Noi/Actualizate

| Endpoint | Metodă | Descriere |
|----------|--------|-----------|
| `/api/voices` | GET | Proxy pentru ElevenLabs voices API |
| `/api/models` | GET | Proxy pentru ElevenLabs models API |
| `/api/projects/[id]/voice` | GET | Obține setările vocii pentru proiect |
| `/api/projects/[id]/voice` | PUT | Salvează setările vocii pentru proiect |
| `/api/chunks/[id]/settings` | GET | Obține setările custom ale unui chunk |
| `/api/chunks/[id]/settings` | PUT | Salvează setările custom ale unui chunk |
| `/api/chunks/[id]/settings` | DELETE | Resetează chunk-ul la setările default |

---

## Modificări față de Specificații v1.0

1. **Pagina principală:** `/` redirect la `/projects` (nu dropdown în header)
2. **Management proiecte:** Pagină separată `/projects` cu listă
3. **Header editor:** Buton "← Înapoi" + nume proiect (nu dropdown)
4. **Creare proiect:** Modal cu input nume (nu creare directă cu nume default)
5. **Editor:** Textarea per chunk (nu contentEditable) - mai robust și mai simplu
6. **Footer statistici:** Eliminat (nu era necesar)
7. **Setări voce (v4):** Sistem dual cu setări default + custom per chunk

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

---

## Pași Următori (Faza 5)

1. Integrare ElevenLabs TTS API pentru generare audio
2. Funcția `getSettingsForChunk()` pentru a determina setările la generare
3. Salvare snapshot setări în AudioVariant (`usedVoiceId`, `usedVoiceSettings`)
4. Generare și stocare audio pentru chunk-uri
5. Border pulsează în timpul generării
6. Border devine verde la finalizare
7. Playback în browser

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
