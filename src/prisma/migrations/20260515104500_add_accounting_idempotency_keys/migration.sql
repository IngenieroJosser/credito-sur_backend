ALTER TABLE "Gasto"
  ADD COLUMN IF NOT EXISTS "idempotencyKey" VARCHAR(100);

CREATE UNIQUE INDEX IF NOT EXISTS "Gasto_idempotencyKey_key"
  ON "Gasto"("idempotencyKey");

ALTER TABLE "Transaccion"
  ADD COLUMN IF NOT EXISTS "idempotencyKey" VARCHAR(100);

CREATE UNIQUE INDEX IF NOT EXISTS "Transaccion_idempotencyKey_key"
  ON "Transaccion"("idempotencyKey");
