-- Recupera dos de los tres indices que borro la migracion 20260826003912.
--
-- Se dejan fuera a proposito: "asignaciones_rutas_one_active_route_per_client_idx"
-- (UNIQUE(clienteId) WHERE activa), que imponia un cliente en una sola ruta.
-- Esa regla ya no aplica: un cliente puede tener creditos en varias rutas.
--
-- Los dos que si vuelven no tienen nada que ver con esa regla:
--   1. una sola caja de ruta activa por ruta
--   2. el mismo cliente no puede estar repetido dentro de la misma ruta

-- 1. Deja activa solo la caja de ruta mas antigua de cada ruta.
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

CREATE UNIQUE INDEX IF NOT EXISTS "cajas_one_active_route_box_per_route_idx"
  ON "cajas"("rutaId")
  WHERE "activa" = true
    AND "tipo" = 'RUTA'
    AND "rutaId" IS NOT NULL;

-- 2. Deja activa solo la asignacion mas antigua de cada par ruta+cliente.
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

CREATE UNIQUE INDEX IF NOT EXISTS "asignaciones_rutas_one_active_client_route_idx"
  ON "asignaciones_rutas"("rutaId", "clienteId")
  WHERE "activa" = true;
