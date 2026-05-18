WITH ranked AS (
  SELECT
    a."id",
    a."clienteId",
    r."cobradorId",
    ROW_NUMBER() OVER (
      PARTITION BY a."clienteId"
      ORDER BY a."actualizadoEn" DESC, a."creadoEn" DESC, a."id" DESC
    ) AS rn
  FROM "asignaciones_rutas" a
  JOIN "rutas" r ON r."id" = a."rutaId"
  WHERE a."activa" = true
)
UPDATE "asignaciones_rutas" a
SET "activa" = false
FROM ranked r
WHERE a."id" = r."id"
  AND r.rn > 1;

WITH chosen AS (
  SELECT
    a."id",
    r."cobradorId"
  FROM "asignaciones_rutas" a
  JOIN "rutas" r ON r."id" = a."rutaId"
  WHERE a."activa" = true
)
UPDATE "asignaciones_rutas" a
SET "cobradorId" = chosen."cobradorId"
FROM chosen
WHERE a."id" = chosen."id"
  AND a."cobradorId" <> chosen."cobradorId";

CREATE UNIQUE INDEX IF NOT EXISTS "asignaciones_rutas_one_active_route_per_client_idx"
  ON "asignaciones_rutas"("clienteId")
  WHERE "activa" = true;
