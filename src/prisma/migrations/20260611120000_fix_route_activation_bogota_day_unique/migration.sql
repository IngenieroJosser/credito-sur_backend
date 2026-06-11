DROP INDEX IF EXISTS "transaccion_one_route_activation_per_box_day_idx";
DROP INDEX IF EXISTS "transaccion_one_route_activation_per_box_bogota_day_idx";

WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY
        "cajaId",
        "referenciaId",
        (("fechaTransaccion" AT TIME ZONE 'America/Bogota')::date)
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

UPDATE "Transaccion"
SET "idempotencyKey" =
  CONCAT(
    'ACTIVACION_RUTA:',
    REPLACE(COALESCE("referenciaId", ''), 'RUTA:', ''),
    ':',
    (("fechaTransaccion" AT TIME ZONE 'America/Bogota')::date)::text
  )
WHERE "tipoReferencia" = 'ACTIVACION_RUTA'
  AND "idempotencyKey" IS NULL
  AND "referenciaId" LIKE 'RUTA:%';
