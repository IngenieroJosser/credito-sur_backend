-- Trazabilidad del origen: que registros creo cada importacion.
--
-- Hasta ahora ImportacionLote no tenia ninguna relacion con los clientes y
-- prestamos que creaba, asi que mirando un credito era imposible saber que
-- venia de una carga masiva. Con esta columna se puede decir de forma
-- explicita de que lote proviene, y deshacer un lote pasa a ser exacto.
--
-- La columna es opcional: todo lo creado a mano la deja en NULL, y los
-- registros que ya existen no se tocan.

ALTER TABLE "Cliente" ADD COLUMN IF NOT EXISTS "loteImportacionId" TEXT;
ALTER TABLE "Prestamo" ADD COLUMN IF NOT EXISTS "loteImportacionId" TEXT;

CREATE INDEX IF NOT EXISTS "Cliente_loteImportacionId_idx" ON "Cliente"("loteImportacionId");
CREATE INDEX IF NOT EXISTS "Prestamo_loteImportacionId_idx" ON "Prestamo"("loteImportacionId");

-- ON DELETE SET NULL: borrar el historial de un lote no debe arrastrarse a los
-- clientes ni a los creditos, que siguen siendo validos por si mismos.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Cliente_loteImportacionId_fkey') THEN
    ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_loteImportacionId_fkey"
      FOREIGN KEY ("loteImportacionId") REFERENCES "importaciones_lotes"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Prestamo_loteImportacionId_fkey') THEN
    ALTER TABLE "Prestamo" ADD CONSTRAINT "Prestamo_loteImportacionId_fkey"
      FOREIGN KEY ("loteImportacionId") REFERENCES "importaciones_lotes"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
