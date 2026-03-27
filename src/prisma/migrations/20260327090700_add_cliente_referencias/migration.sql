-- Add missing reference fields to Cliente
ALTER TABLE "Cliente" ADD COLUMN IF NOT EXISTS "referencia1Nombre" TEXT;
ALTER TABLE "Cliente" ADD COLUMN IF NOT EXISTS "referencia1Telefono" TEXT;
ALTER TABLE "Cliente" ADD COLUMN IF NOT EXISTS "referencia2Nombre" TEXT;
ALTER TABLE "Cliente" ADD COLUMN IF NOT EXISTS "referencia2Telefono" TEXT;
