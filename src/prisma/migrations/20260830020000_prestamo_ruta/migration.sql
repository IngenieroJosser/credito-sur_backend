-- La ruta pasa a llevar creditos, no clientes.
--
-- Hasta ahora la ruta de un credito se deducia del cliente
-- (Prestamo -> Cliente -> AsignacionRuta), asi que todos los creditos de un
-- cliente caian a la fuerza en la misma ruta. Con "rutaId" en el credito, dos
-- creditos del mismo cliente pueden estar en rutas distintas, y varios creditos
-- suyos pueden seguir estando en la misma.

ALTER TABLE "Prestamo" ADD COLUMN "rutaId" TEXT;

-- Relleno: hoy cada cliente tiene como mucho una asignacion activa, asi que la
-- ruta de cada credito sale sin ambiguedad. Se toma la mas antigua por si acaso.
UPDATE "Prestamo" p
SET "rutaId" = elegida."rutaId"
FROM (
  SELECT DISTINCT ON ("clienteId") "clienteId", "rutaId"
  FROM "asignaciones_rutas"
  WHERE activa = true
  ORDER BY "clienteId", "creadoEn" ASC, "id" ASC
) elegida
WHERE elegida."clienteId" = p."clienteId"
  AND p."rutaId" IS NULL;

CREATE INDEX "Prestamo_rutaId_idx" ON "Prestamo"("rutaId");

ALTER TABLE "Prestamo"
  ADD CONSTRAINT "Prestamo_rutaId_fkey"
  FOREIGN KEY ("rutaId") REFERENCES "rutas"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
