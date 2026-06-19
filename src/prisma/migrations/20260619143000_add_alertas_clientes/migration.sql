-- CreateTable
CREATE TABLE "alertas_clientes" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "rutaId" TEXT,
    "cobradorId" TEXT,
    "reportadoPorId" TEXT NOT NULL,
    "resueltoPorId" TEXT,
    "estado" VARCHAR(30) NOT NULL DEFAULT 'ACTIVA',
    "motivo" VARCHAR(80) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "ultimaUbicacionConocida" TEXT,
    "observacionesReportante" TEXT NOT NULL,
    "snapshotCliente" JSONB NOT NULL,
    "evidenciaIds" JSONB,
    "notificadosCount" INTEGER NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "resueltoEn" TIMESTAMP(3),
    "motivoResolucion" TEXT,

    CONSTRAINT "alertas_clientes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alertas_clientes_clienteId_idx" ON "alertas_clientes"("clienteId");

-- CreateIndex
CREATE INDEX "alertas_clientes_rutaId_idx" ON "alertas_clientes"("rutaId");

-- CreateIndex
CREATE INDEX "alertas_clientes_cobradorId_idx" ON "alertas_clientes"("cobradorId");

-- CreateIndex
CREATE INDEX "alertas_clientes_estado_idx" ON "alertas_clientes"("estado");

-- CreateIndex
CREATE INDEX "alertas_clientes_creadoEn_idx" ON "alertas_clientes"("creadoEn");

-- AddForeignKey
ALTER TABLE "alertas_clientes" ADD CONSTRAINT "alertas_clientes_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas_clientes" ADD CONSTRAINT "alertas_clientes_reportadoPorId_fkey" FOREIGN KEY ("reportadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas_clientes" ADD CONSTRAINT "alertas_clientes_resueltoPorId_fkey" FOREIGN KEY ("resueltoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
