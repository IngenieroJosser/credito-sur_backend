-- CreateTable
CREATE TABLE "sync_conflicts" (
    "id" TEXT NOT NULL,
    "entidad" VARCHAR(50) NOT NULL,
    "operacion" VARCHAR(20) NOT NULL,
    "datos" JSONB NOT NULL,
    "errorMotivo" TEXT NOT NULL,
    "statusCode" INTEGER,
    "endpoint" VARCHAR(255) NOT NULL,
    "estadoResolucion" VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    "creadoPorId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "resueltoPorId" TEXT,

    CONSTRAINT "sync_conflicts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sync_conflicts_entidad_idx" ON "sync_conflicts"("entidad");

-- CreateIndex
CREATE INDEX "sync_conflicts_estadoResolucion_idx" ON "sync_conflicts"("estadoResolucion");

-- CreateIndex
CREATE INDEX "sync_conflicts_creadoEn_idx" ON "sync_conflicts"("creadoEn");

-- AddForeignKey
ALTER TABLE "sync_conflicts" ADD CONSTRAINT "sync_conflicts_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_conflicts" ADD CONSTRAINT "sync_conflicts_resueltoPorId_fkey" FOREIGN KEY ("resueltoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
