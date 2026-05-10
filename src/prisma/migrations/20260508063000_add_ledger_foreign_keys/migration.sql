-- AddForeignKey
-- NOT VALID keeps deployment safe if legacy ledger rows contain orphan IDs.
-- PostgreSQL still enforces these constraints for new and updated rows.
ALTER TABLE "asientos_contables"
  ADD CONSTRAINT "asientos_contables_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "Usuario"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE
  NOT VALID;

ALTER TABLE "asientos_lineas"
  ADD CONSTRAINT "asientos_lineas_cajaId_fkey"
  FOREIGN KEY ("cajaId") REFERENCES "cajas"("id")
  ON DELETE SET NULL ON UPDATE CASCADE
  NOT VALID;
