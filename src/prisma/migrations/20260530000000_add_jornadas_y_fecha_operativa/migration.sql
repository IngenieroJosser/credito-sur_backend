-- Add fechaOperativaRuta and origenGestion to Pago table
ALTER TABLE "Pago" ADD COLUMN IF NOT EXISTS "fechaOperativaRuta" VARCHAR(10);
ALTER TABLE "Pago" ADD COLUMN IF NOT EXISTS "origenGestion" VARCHAR(50);

-- Create indexes for the new columns (if they don't exist)
CREATE INDEX IF NOT EXISTS "Pago_fechaOperativaRuta_idx" ON "Pago"("fechaOperativaRuta");
CREATE INDEX IF NOT EXISTS "Pago_origenGestion_idx" ON "Pago"("origenGestion");

-- Create enum RutaJornadaEstado (if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RutaJornadaEstado') THEN
        CREATE TYPE "RutaJornadaEstado" AS ENUM ('ABIERTA', 'PENDIENTE_CIERRE', 'CERRADA', 'REGULARIZADA', 'ANULADA');
    END IF;
END
$$;

-- Create table rutas_jornadas (if it doesn't exist)
CREATE TABLE IF NOT EXISTS "rutas_jornadas" (
    "id" TEXT NOT NULL,
    "rutaId" TEXT NOT NULL,
    "cajaId" TEXT NOT NULL,
    "fechaOperativa" VARCHAR(10) NOT NULL,
    "estado" "RutaJornadaEstado" NOT NULL DEFAULT 'ABIERTA',
    "activacionTransaccionId" TEXT,
    "cierreTransaccionId" TEXT,
    "activadaEn" TIMESTAMP(3) NOT NULL,
    "cerradaEn" TIMESTAMP(3),
    "regularizadaEn" TIMESTAMP(3),
    "regularizadaPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rutas_jornadas_pkey" PRIMARY KEY ("id")
);

-- Create indexes for rutas_jornadas (if they don't exist)
CREATE INDEX IF NOT EXISTS "rutas_jornadas_rutaId_idx" ON "rutas_jornadas"("rutaId");
CREATE INDEX IF NOT EXISTS "rutas_jornadas_estado_idx" ON "rutas_jornadas"("estado");
CREATE INDEX IF NOT EXISTS "rutas_jornadas_fechaOperativa_idx" ON "rutas_jornadas"("fechaOperativa");

-- Create unique constraint on rutaId and fechaOperativa (if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'rutas_jornadas_rutaId_fechaOperativa_key'
    ) THEN
        ALTER TABLE "rutas_jornadas" 
        ADD CONSTRAINT "rutas_jornadas_rutaId_fechaOperativa_key" 
        UNIQUE ("rutaId", "fechaOperativa");
    END IF;
END
$$;

-- Add foreign key constraints (if they don't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'rutas_jornadas_rutaId_fkey'
    ) THEN
        ALTER TABLE "rutas_jornadas" 
        ADD CONSTRAINT "rutas_jornadas_rutaId_fkey" 
        FOREIGN KEY ("rutaId") REFERENCES "rutas"("id") 
        ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'rutas_jornadas_cajaId_fkey'
    ) THEN
        ALTER TABLE "rutas_jornadas" 
        ADD CONSTRAINT "rutas_jornadas_cajaId_fkey" 
        FOREIGN KEY ("cajaId") REFERENCES "cajas"("id") 
        ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END
$$;
