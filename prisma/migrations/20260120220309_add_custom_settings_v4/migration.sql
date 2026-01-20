/*
  Warnings:

  - A unique constraint covering the columns `[chunkId,variantNumber]` on the table `AudioVariant` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "AudioVariant" ADD COLUMN "usedVoiceId" TEXT;
ALTER TABLE "AudioVariant" ADD COLUMN "usedVoiceSettings" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Chunk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "useCustomSettings" BOOLEAN NOT NULL DEFAULT false,
    "customVoiceId" TEXT,
    "customVoiceSettings" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Chunk_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Chunk" ("createdAt", "id", "order", "projectId", "text", "updatedAt") SELECT "createdAt", "id", "order", "projectId", "text", "updatedAt" FROM "Chunk";
DROP TABLE "Chunk";
ALTER TABLE "new_Chunk" RENAME TO "Chunk";
CREATE INDEX "Chunk_projectId_order_idx" ON "Chunk"("projectId", "order");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AudioVariant_chunkId_idx" ON "AudioVariant"("chunkId");

-- CreateIndex
CREATE UNIQUE INDEX "AudioVariant_chunkId_variantNumber_key" ON "AudioVariant"("chunkId", "variantNumber");
