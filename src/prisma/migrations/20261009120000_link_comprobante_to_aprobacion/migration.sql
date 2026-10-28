ALTER TABLE "multimedia"
ADD COLUMN IF NOT EXISTS "aprobacionId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "multimedia_aprobacionId_key"
ON "multimedia"("aprobacionId");

DO $$ BEGIN
  ALTER TABLE "multimedia"
  ADD CONSTRAINT "multimedia_aprobacionId_fkey"
  FOREIGN KEY ("aprobacionId")
  REFERENCES "aprobaciones"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
