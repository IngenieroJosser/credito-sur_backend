ALTER TABLE "Pago"
  ADD COLUMN IF NOT EXISTS "idempotencyKey" VARCHAR(100);

CREATE UNIQUE INDEX IF NOT EXISTS "Pago_idempotencyKey_key"
  ON "Pago"("idempotencyKey");

ALTER TABLE "aprobaciones"
  ADD COLUMN IF NOT EXISTS "idempotencyKey" VARCHAR(100);

CREATE UNIQUE INDEX IF NOT EXISTS "aprobaciones_idempotencyKey_key"
  ON "aprobaciones"("idempotencyKey");
