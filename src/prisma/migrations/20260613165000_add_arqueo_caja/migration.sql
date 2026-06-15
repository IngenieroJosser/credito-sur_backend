-- CreateEnum (only if not exists)
DO $$ BEGIN
    CREATE TYPE "TipoDiferenciaArqueo" AS ENUM ('SIN_DIFERENCIA', 'FALTANTE', 'SOBRANTE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum (only if not exists)
DO $$ BEGIN
    CREATE TYPE "EstadoArqueoCaja" AS ENUM ('BORRADOR', 'CONFIRMADO', 'ANULADO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable (only if not exists)
CREATE TABLE IF NOT EXISTS "arqueos_caja" (
    "id" TEXT NOT NULL,
    "cajaId" TEXT NOT NULL,
    "rutaId" TEXT,
    "rutaJornadaId" TEXT,
    "fechaOperativa" TEXT NOT NULL,
    "responsableId" TEXT NOT NULL,
    "creadoPorId" TEXT NOT NULL,
    "recibidoPorId" TEXT,
    "saldoEsperado" DECIMAL(12,2) NOT NULL,
    "efectivoContado" DECIMAL(12,2) NOT NULL,
    "diferencia" DECIMAL(12,2) NOT NULL,
    "montoTransferido" DECIMAL(12,2),
    "tipoDiferencia" "TipoDiferenciaArqueo" NOT NULL,
    "estado" "EstadoArqueoCaja" NOT NULL DEFAULT 'CONFIRMADO',
    "numeroComprobanteTraslado" TEXT,
    "denominaciones" JSONB,
    "observaciones" TEXT,
    "transaccionSalidaId" TEXT,
    "transaccionEntradaId" TEXT,
    "journalEntryId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recibidoEn" TIMESTAMP(3),
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "arqueos_caja_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (only if not exists)
CREATE UNIQUE INDEX IF NOT EXISTS "arqueos_caja_cajaId_fechaOperativa_key" ON "arqueos_caja"("cajaId", "fechaOperativa");

-- CreateIndex (only if not exists)
CREATE UNIQUE INDEX IF NOT EXISTS "arqueos_caja_numeroComprobanteTraslado_key" ON "arqueos_caja"("numeroComprobanteTraslado");

-- CreateIndex (only if not exists)
CREATE INDEX IF NOT EXISTS "arqueos_caja_fechaOperativa_idx" ON "arqueos_caja"("fechaOperativa");

-- CreateIndex (only if not exists)
CREATE INDEX IF NOT EXISTS "arqueos_caja_responsableId_idx" ON "arqueos_caja"("responsableId");

-- AddForeignKey (only if not exists)
DO $$ BEGIN
    ALTER TABLE "arqueos_caja" ADD CONSTRAINT "arqueos_caja_cajaId_fkey" FOREIGN KEY ("cajaId") REFERENCES "cajas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey (only if not exists)
DO $$ BEGIN
    ALTER TABLE "arqueos_caja" ADD CONSTRAINT "arqueos_caja_rutaId_fkey" FOREIGN KEY ("rutaId") REFERENCES "rutas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey (only if not exists)
DO $$ BEGIN
    ALTER TABLE "arqueos_caja" ADD CONSTRAINT "arqueos_caja_rutaJornadaId_fkey" FOREIGN KEY ("rutaJornadaId") REFERENCES "rutas_jornadas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey (only if not exists)
DO $$ BEGIN
    ALTER TABLE "arqueos_caja" ADD CONSTRAINT "arqueos_caja_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey (only if not exists)
DO $$ BEGIN
    ALTER TABLE "arqueos_caja" ADD CONSTRAINT "arqueos_caja_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey (only if not exists)
DO $$ BEGIN
    ALTER TABLE "arqueos_caja" ADD CONSTRAINT "arqueos_caja_recibidoPorId_fkey" FOREIGN KEY ("recibidoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
