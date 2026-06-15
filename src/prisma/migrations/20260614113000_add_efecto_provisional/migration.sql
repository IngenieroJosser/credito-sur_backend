-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "EstadoEfectoProvisional" AS ENUM (
  'PENDIENTE_REVISION',
  'CONFIRMADO',
  'REVERTIDO',
  'REVERSA_FALLIDA'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "EfectoProvisional" (
  "id" TEXT NOT NULL,
  "aprobacionId" TEXT NOT NULL,
  "tipoAccion" TEXT NOT NULL,
  "tipoEntidad" TEXT,
  "entidadId" TEXT,
  "estado" "EstadoEfectoProvisional" NOT NULL DEFAULT 'PENDIENTE_REVISION',
  "snapshotAntes" JSONB,
  "snapshotDespues" JSONB,
  "rollbackData" JSONB,
  "entidadesAfectadas" JSONB,
  "aplicadoPorId" TEXT NOT NULL,
  "aplicadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmadoEn" TIMESTAMP(3),
  "revertidoEn" TIMESTAMP(3),
  "motivoReversion" TEXT,
  "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EfectoProvisional_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EfectoProvisional_aprobacionId_idx" ON "EfectoProvisional"("aprobacionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EfectoProvisional_tipoAccion_idx" ON "EfectoProvisional"("tipoAccion");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EfectoProvisional_estado_idx" ON "EfectoProvisional"("estado");

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "EfectoProvisional"
    ADD CONSTRAINT "EfectoProvisional_aprobacionId_fkey"
    FOREIGN KEY ("aprobacionId") REFERENCES "aprobaciones"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
