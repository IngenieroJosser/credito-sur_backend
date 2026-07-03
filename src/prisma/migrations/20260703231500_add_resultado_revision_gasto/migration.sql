DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'ResultadoRevisionGasto'
  ) THEN
    CREATE TYPE "ResultadoRevisionGasto" AS ENUM (
      'APROBADO_OPERATIVO',
      'RECHAZADO_CON_DEUDA',
      'RECHAZADO_CON_REINTEGRO'
    );
  END IF;
END $$;

ALTER TABLE "Gasto"
ADD COLUMN IF NOT EXISTS "resultadoRevisionGasto" "ResultadoRevisionGasto";

CREATE INDEX IF NOT EXISTS "Gasto_resultadoRevisionGasto_idx"
ON "Gasto"("resultadoRevisionGasto");
