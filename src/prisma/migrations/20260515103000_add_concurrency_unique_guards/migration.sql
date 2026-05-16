WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "rutaId"
      ORDER BY "creadoEn" ASC, "id" ASC
    ) AS rn
  FROM "cajas"
  WHERE "activa" = true
    AND "tipo" = 'RUTA'
    AND "rutaId" IS NOT NULL
)
UPDATE "cajas" c
SET "activa" = false
FROM ranked r
WHERE c."id" = r."id"
  AND r.rn > 1;

WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "rutaId", "clienteId"
      ORDER BY "creadoEn" ASC, "ordenVisita" ASC, "id" ASC
    ) AS rn
  FROM "asignaciones_rutas"
  WHERE "activa" = true
)
UPDATE "asignaciones_rutas" a
SET "activa" = false
FROM ranked r
WHERE a."id" = r."id"
  AND r.rn > 1;

WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "cajaId", ("fechaTransaccion"::date)
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

CREATE UNIQUE INDEX IF NOT EXISTS "cajas_one_active_route_box_per_route_idx"
  ON "cajas"("rutaId")
  WHERE "activa" = true
    AND "tipo" = 'RUTA'
    AND "rutaId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "asignaciones_rutas_one_active_client_route_idx"
  ON "asignaciones_rutas"("rutaId", "clienteId")
  WHERE "activa" = true;

CREATE UNIQUE INDEX IF NOT EXISTS "transaccion_one_route_activation_per_box_day_idx"
  ON "Transaccion"("cajaId", ("fechaTransaccion"::date))
  WHERE "tipoReferencia" = 'ACTIVACION_RUTA';
