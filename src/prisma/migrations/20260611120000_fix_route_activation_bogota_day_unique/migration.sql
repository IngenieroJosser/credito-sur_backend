DROP INDEX IF EXISTS "transaccion_one_route_activation_per_box_day_idx";

WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "cajaId", (("fechaTransaccion" AT TIME ZONE 'America/Bogota')::date)
      ORDER BY "fechaTransaccion" ASC, "id" ASC
    ) AS rn
  FROM "Transaccion"
  WHERE "tipoReferencia" = 'ACTIVACION_RUTA'
)
UPDATE "Transaccion" t
SET "tipoReferencia" = 'ACTIVACION_RUTA_DUPLICADA'
FROM ranked r
WHERE t."id" = r."id"
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "transaccion_one_route_activation_per_box_bogota_day_idx"
  ON "Transaccion"("cajaId", (("fechaTransaccion" AT TIME ZONE 'America/Bogota')::date))
  WHERE "tipoReferencia" = 'ACTIVACION_RUTA';
