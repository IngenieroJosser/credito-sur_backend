ALTER TABLE "Cliente"
  ADD COLUMN IF NOT EXISTS "idempotencyKey" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS "Cliente_idempotencyKey_key"
  ON "Cliente"("idempotencyKey");

ALTER TABLE "Prestamo"
  ADD COLUMN IF NOT EXISTS "idempotencyKey" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS "Prestamo_idempotencyKey_key"
  ON "Prestamo"("idempotencyKey");
