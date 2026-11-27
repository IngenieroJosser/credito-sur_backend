ALTER TABLE "cargas_expedientes_historicos" ADD COLUMN "loteInventarioId" TEXT
    REFERENCES "importaciones_lotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "cargas_expedientes_historicos_loteInventarioId_key"
    ON "cargas_expedientes_historicos"("loteInventarioId");
