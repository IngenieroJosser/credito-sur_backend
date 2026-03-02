-- Add missing column to align database with Prisma schema
ALTER TABLE "Prestamo" ADD COLUMN IF NOT EXISTS "cuotaInicial" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Create missing table for system configuration
CREATE TABLE IF NOT EXISTS "configuracion_sistema" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "autoAprobarClientes" BOOLEAN NOT NULL DEFAULT false,
    "autoAprobarCreditos" BOOLEAN NOT NULL DEFAULT false,
    "tasaInteresBase" DECIMAL(5,2) NOT NULL DEFAULT 20.00,
    "porcentajeMoraDiaria" DECIMAL(5,2) NOT NULL DEFAULT 2.50,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "actualizadoPorId" TEXT,

    CONSTRAINT "configuracion_sistema_pkey" PRIMARY KEY ("id")
);
