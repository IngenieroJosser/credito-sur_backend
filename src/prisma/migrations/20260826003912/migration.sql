/*
  Warnings:

  - You are about to alter the column `fechaOperativa` on the `arqueos_caja` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(10)`.
  - You are about to alter the column `numeroComprobanteTraslado` on the `arqueos_caja` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.

*/
-- AlterEnum
ALTER TYPE "TipoAmortizacion" ADD VALUE 'INTERES_PLANO';

-- DropIndex
DROP INDEX "asignaciones_rutas_one_active_client_route_idx";

-- DropIndex
DROP INDEX "asignaciones_rutas_one_active_route_per_client_idx";

-- DropIndex
DROP INDEX "cajas_one_active_route_box_per_route_idx";

-- AlterTable
ALTER TABLE "Prestamo" ALTER COLUMN "tipoAmortizacion" SET DEFAULT 'INTERES_PLANO';

-- AlterTable
ALTER TABLE "Transaccion" ADD COLUMN     "clienteId" TEXT;

-- AlterTable
ALTER TABLE "arqueos_caja" ALTER COLUMN "fechaOperativa" SET DATA TYPE VARCHAR(10),
ALTER COLUMN "numeroComprobanteTraslado" SET DATA TYPE VARCHAR(50);

-- CreateIndex
CREATE INDEX "Transaccion_clienteId_idx" ON "Transaccion"("clienteId");

-- CreateIndex
CREATE INDEX "Transaccion_tipoReferencia_clienteId_idx" ON "Transaccion"("tipoReferencia", "clienteId");

-- AddForeignKey
ALTER TABLE "Transaccion" ADD CONSTRAINT "Transaccion_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rutas_jornadas" ADD CONSTRAINT "rutas_jornadas_activacionTransaccionId_fkey" FOREIGN KEY ("activacionTransaccionId") REFERENCES "Transaccion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rutas_jornadas" ADD CONSTRAINT "rutas_jornadas_cierreTransaccionId_fkey" FOREIGN KEY ("cierreTransaccionId") REFERENCES "Transaccion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
