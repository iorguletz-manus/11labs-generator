#!/usr/bin/env python3
"""
Script pentru a crea tabelele în baza de date Turso.
Rulează acest script o singură dată pentru a inițializa baza de date în cloud.
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

# SQL statements pentru crearea tabelelor (bazat pe schema Prisma)
statements = [
    # Tabel Project
    """CREATE TABLE IF NOT EXISTS Project (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        voiceId TEXT,
        voiceSettings TEXT,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )""",
    
    # Tabel Chunk
    """CREATE TABLE IF NOT EXISTS Chunk (
        id TEXT PRIMARY KEY NOT NULL,
        projectId TEXT NOT NULL,
        orderIndex INTEGER NOT NULL,
        text TEXT NOT NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (projectId) REFERENCES Project(id) ON DELETE CASCADE ON UPDATE CASCADE
    )""",
    
    # Tabel AudioVariant
    """CREATE TABLE IF NOT EXISTS AudioVariant (
        id TEXT PRIMARY KEY NOT NULL,
        chunkId TEXT NOT NULL,
        audioUrl TEXT NOT NULL,
        isSelected INTEGER NOT NULL DEFAULT 0,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chunkId) REFERENCES Chunk(id) ON DELETE CASCADE ON UPDATE CASCADE
    )""",
    
    # Indexuri
    "CREATE INDEX IF NOT EXISTS Chunk_projectId_idx ON Chunk(projectId)",
    "CREATE INDEX IF NOT EXISTS AudioVariant_chunkId_idx ON AudioVariant(chunkId)",
]

print("Creez tabelele...")

for statement in statements:
    try:
        conn.execute(statement)
        print(f"✓ Executat: {statement[:60].replace(chr(10), ' ')}...")
    except Exception as e:
        print(f"✗ Eroare: {e}")

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

print("\n✓ Setup Turso complet!")
