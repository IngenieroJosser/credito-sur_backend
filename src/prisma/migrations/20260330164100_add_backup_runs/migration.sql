-- Create enums for backups
DO $$ BEGIN
  CREATE TYPE "BackupTipo" AS ENUM ('MANUAL', 'PROGRAMADO');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "BackupDestino" AS ENUM ('LOCAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "BackupEstado" AS ENUM ('EXITOSO', 'FALLIDO', 'EN_PROCESO');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create backup history table
CREATE TABLE IF NOT EXISTS "backup_runs" (
  "id" TEXT NOT NULL,
  "tipo" "BackupTipo" NOT NULL,
  "destino" "BackupDestino" NOT NULL DEFAULT 'LOCAL',
  "estado" "BackupEstado" NOT NULL DEFAULT 'EN_PROCESO',
  "filePath" VARCHAR(500),
  "fileSize" INTEGER,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "durationMs" INTEGER,
  "error" TEXT,
  "metadata" JSONB,

  CONSTRAINT "backup_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "backup_runs_startedAt_idx" ON "backup_runs"("startedAt");
CREATE INDEX IF NOT EXISTS "backup_runs_estado_idx" ON "backup_runs"("estado");
