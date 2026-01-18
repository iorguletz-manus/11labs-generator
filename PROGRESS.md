# 11Labs Audiobook Generator - Progres și Decizii

**Ultima actualizare:** 18 Ianuarie 2026

---

## Stadiu Faze

| Fază | Descriere | Status | Data |
|------|-----------|--------|------|
| 1 | Setup și Fundație | ✅ Completă | 18 Ian 2026 |
| 2 | Proiecte CRUD | ✅ Completă | 18 Ian 2026 |
| 3 | Editor Text și Chunk-uri | ⏳ În așteptare | - |
| 4 | Setări Voce | ⏳ În așteptare | - |
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
```

---

## Componente Create

### Faza 2

- `ProjectList.tsx` - Lista proiecte cu redenumire inline și ștergere
- `CreateProjectModal.tsx` - Modal pentru creare proiect cu validare
- `ConfirmDialog.tsx` - Dialog generic de confirmare

---

## Modificări față de Specificații v1.0

1. **Pagina principală:** `/` redirect la `/projects` (nu dropdown în header)
2. **Management proiecte:** Pagină separată `/projects` cu listă
3. **Header editor:** Buton "← Înapoi" + nume proiect (nu dropdown)
4. **Creare proiect:** Modal cu input nume (nu creare directă cu nume default)

---

## Probleme Rezolvate

| Problemă | Soluție |
|----------|---------|
| Prisma nu genera client pe Vercel | Adăugat `.npmrc` cu `public-hoist-pattern[]=*prisma*` |
| Warning Prisma build scripts | Nu afectează funcționalitatea, ignorat |
| Baza de date Turso goală | Creat script `scripts/setup-turso.py` pentru inițializare |

---

## Pași Următori (Faza 3)

1. Implementare editor text în coloana centrală
2. Împărțire text în chunk-uri (paragrafe)
3. CRUD pentru chunk-uri
4. Reordonare chunk-uri (drag & drop sau butoane)

---

## Documente Referință

- `Document Final de Specificații pentru Manus v2.md` - Specificații complete
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
