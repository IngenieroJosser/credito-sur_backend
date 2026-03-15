-- AlterTable
ALTER TABLE "Producto" ADD COLUMN "ocultoArchivadosEn" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Producto_eliminadoEn_idx" ON "Producto"("eliminadoEn");

-- CreateIndex
CREATE INDEX "Producto_ocultoArchivadosEn_idx" ON "Producto"("ocultoArchivadosEn");

-- CreateTable
CREATE TABLE "archivados_ocultos" (
    "id" TEXT NOT NULL,
    "entidad" VARCHAR(50) NOT NULL,
    "entidadId" VARCHAR(100) NOT NULL,
    "ocultoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "archivados_ocultos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "archivados_ocultos_entidad_entidadId_key" ON "archivados_ocultos"("entidad", "entidadId");

-- CreateIndex
CREATE INDEX "archivados_ocultos_entidad_idx" ON "archivados_ocultos"("entidad");

-- CreateIndex
CREATE INDEX "archivados_ocultos_ocultoEn_idx" ON "archivados_ocultos"("ocultoEn");
