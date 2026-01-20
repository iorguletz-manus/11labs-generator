#!/usr/bin/env python3
"""
Script pentru a crea/actualiza tabelele în baza de date Turso.
Rulează acest script pentru a aplica migrările în producție.

Versiune: 2.0 - Actualizat pentru v4 (sistem de setări dual)
"""

import os
import libsql_experimental as libsql

# Citește credențialele din environment
TURSO_DATABASE_URL = os.environ.get("TURSO_DATABASE_URL")
TURSO_AUTH_TOKEN = os.environ.get("TURSO_AUTH_TOKEN")

if not TURSO_DATABASE_URL or not TURSO_AUTH_TOKEN:
    print("ERROR: TURSO_DATABASE_URL și TURSO_AUTH_TOKEN trebuie setate în environment")
    exit(1)

print(f"Conectare la: {TURSO_DATABASE_URL}")

# Conectare la Turso
conn = libsql.connect(
    TURSO_DATABASE_URL,
    auth_token=TURSO_AUTH_TOKEN
)

# SQL statements pentru crearea tabelelor (bazat pe schema Prisma v4)
create_statements = [
    # Tabel Project
    """CREATE TABLE IF NOT EXISTS Project (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        voiceId TEXT,
        voiceSettings TEXT,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )""",
    
    # Tabel Chunk (cu câmpuri noi v4)
    """CREATE TABLE IF NOT EXISTS Chunk (
        id TEXT PRIMARY KEY NOT NULL,
        projectId TEXT NOT NULL,
        text TEXT NOT NULL,
        "order" INTEGER NOT NULL,
        useCustomSettings INTEGER NOT NULL DEFAULT 0,
        customVoiceId TEXT,
        customVoiceSettings TEXT,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (projectId) REFERENCES Project(id) ON DELETE CASCADE ON UPDATE CASCADE
    )""",
    
    # Tabel AudioVariant (cu câmpuri noi v4)
    """CREATE TABLE IF NOT EXISTS AudioVariant (
        id TEXT PRIMARY KEY NOT NULL,
        chunkId TEXT NOT NULL,
        variantNumber INTEGER NOT NULL,
        audioUrl TEXT,
        audioData BLOB,
        isActive INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'queued',
        progress INTEGER NOT NULL DEFAULT 0,
        errorMessage TEXT,
        usedVoiceId TEXT,
        usedVoiceSettings TEXT,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chunkId) REFERENCES Chunk(id) ON DELETE CASCADE ON UPDATE CASCADE
    )""",
    
    # Indexuri
    "CREATE INDEX IF NOT EXISTS Chunk_projectId_order_idx ON Chunk(projectId, \"order\")",
    "CREATE INDEX IF NOT EXISTS AudioVariant_chunkId_idx ON AudioVariant(chunkId)",
]

# Migrări pentru adăugarea coloanelor noi (v4) la tabele existente
migration_statements = [
    # Adaugă câmpuri noi la Chunk (dacă nu există)
    "ALTER TABLE Chunk ADD COLUMN useCustomSettings INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE Chunk ADD COLUMN customVoiceId TEXT",
    "ALTER TABLE Chunk ADD COLUMN customVoiceSettings TEXT",
    
    # Adaugă câmpuri noi la AudioVariant (dacă nu există)
    "ALTER TABLE AudioVariant ADD COLUMN usedVoiceId TEXT",
    "ALTER TABLE AudioVariant ADD COLUMN usedVoiceSettings TEXT",
]

print("Creez tabelele (dacă nu există)...")

for statement in create_statements:
    try:
        conn.execute(statement)
        print(f"✓ Executat: {statement[:60].replace(chr(10), ' ')}...")
    except Exception as e:
        print(f"✗ Eroare (posibil tabel existent): {str(e)[:80]}")

print("\nAplic migrările v4...")

for statement in migration_statements:
    try:
        conn.execute(statement)
        print(f"✓ Migrat: {statement[:60]}...")
    except Exception as e:
        # Ignorăm erorile de tip "duplicate column" - coloana există deja
        if "duplicate column" in str(e).lower():
            print(f"⏭ Coloană existentă, skip: {statement[:40]}...")
        else:
            print(f"✗ Eroare: {str(e)[:80]}")

conn.commit()

# Verifică tabelele create
print("\nVerificare tabele create:")
result = conn.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
tables = result.fetchall()
if tables:
    for table in tables:
        print(f"  - {table[0]}")
else:
    print("  (nicio tabelă găsită)")

# Verifică structura tabelei Chunk
print("\nStructura tabelei Chunk:")
result = conn.execute("PRAGMA table_info(Chunk);")
columns = result.fetchall()
for col in columns:
    print(f"  - {col[1]} ({col[2]})")

# Verifică structura tabelei AudioVariant
print("\nStructura tabelei AudioVariant:")
result = conn.execute("PRAGMA table_info(AudioVariant);")
columns = result.fetchall()
for col in columns:
    print(f"  - {col[1]} ({col[2]})")

print("\n✓ Setup/Migrare Turso complet!")
