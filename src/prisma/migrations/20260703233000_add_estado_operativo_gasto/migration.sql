ALTER TABLE "Gasto"
ADD COLUMN IF NOT EXISTS "esProvisional" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "aplicadoEnCaja" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "Gasto_esProvisional_idx"
ON "Gasto"("esProvisional");
