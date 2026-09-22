-- Coordinador de la ruta.
--
-- La ruta ya tenia cobrador y supervisor; el coordinador se deducia por rol
-- (un coordinador veia TODAS las rutas) y no quedaba registrado quien responde
-- por cada una. Se agrega igual que supervisorId: opcional y con SET NULL, para
-- que borrar al usuario no arrastre la ruta.
ALTER TABLE "rutas" ADD COLUMN "coordinadorId" TEXT;

CREATE INDEX "rutas_coordinadorId_idx" ON "rutas"("coordinadorId");

ALTER TABLE "rutas" ADD CONSTRAINT "rutas_coordinadorId_fkey"
  FOREIGN KEY ("coordinadorId") REFERENCES "Usuario"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
