-- CreateEnum
CREATE TYPE "TipoContenidoMultimedia" AS ENUM ('FOTO_PERFIL', 'DOCUMENTO_IDENTIDAD_FRENTE', 'DOCUMENTO_IDENTIDAD_REVERSO', 'COMPROBANTE_DOMICILIO', 'FIRMA_DIGITAL', 'FOTO_PRODUCTO', 'RECIBO_PAGO', 'EVIDENCIA_GASTO', 'CONTRATO_PRESTAMO', 'OTRO_DOCUMENTO');

-- CreateEnum
CREATE TYPE "EstadoMultimedia" AS ENUM ('TEMPORAL', 'ACTIVO', 'ELIMINADO');

-- CreateTable
CREATE TABLE "multimedia" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT,
    "prestamoId" TEXT,
    "pagoId" TEXT,
    "gastoId" TEXT,
    "usuarioId" TEXT,
    "productoId" TEXT,
    "reciboId" TEXT,
    "entidad" VARCHAR(50),
    "tipoContenido" "TipoContenidoMultimedia" NOT NULL,
    "tipoArchivo" VARCHAR(50) NOT NULL,
    "formato" VARCHAR(10) NOT NULL,
    "nombreOriginal" VARCHAR(255) NOT NULL,
    "nombreAlmacenamiento" VARCHAR(255) NOT NULL,
    "ruta" VARCHAR(500) NOT NULL,
    "url" VARCHAR(500),
    "tamanoBytes" INTEGER NOT NULL DEFAULT 0,
    "ancho" INTEGER,
    "alto" INTEGER,
    "duracion" INTEGER,
    "descripcion" TEXT,
    "etiquetas" VARCHAR(255),
    "esPublico" BOOLEAN NOT NULL DEFAULT false,
    "esPrincipal" BOOLEAN NOT NULL DEFAULT false,
    "estado" "EstadoMultimedia" NOT NULL DEFAULT 'ACTIVO',
    "subidoPorId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "eliminadoEn" TIMESTAMP(3),
    "estadoSincronizacion" "EstadoSincronizacion" NOT NULL DEFAULT 'PENDIENTE',
    "ultimaSincronizacion" TIMESTAMP(3),
    "hashArchivo" VARCHAR(64),

    CONSTRAINT "multimedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "multimedia_clienteId_idx" ON "multimedia"("clienteId");

-- CreateIndex
CREATE INDEX "multimedia_prestamoId_idx" ON "multimedia"("prestamoId");

-- CreateIndex
CREATE INDEX "multimedia_pagoId_idx" ON "multimedia"("pagoId");

-- CreateIndex
CREATE INDEX "multimedia_gastoId_idx" ON "multimedia"("gastoId");

-- CreateIndex
CREATE INDEX "multimedia_usuarioId_idx" ON "multimedia"("usuarioId");

-- CreateIndex
CREATE INDEX "multimedia_productoId_idx" ON "multimedia"("productoId");

-- CreateIndex
CREATE INDEX "multimedia_reciboId_idx" ON "multimedia"("reciboId");

-- CreateIndex
CREATE INDEX "multimedia_tipoContenido_idx" ON "multimedia"("tipoContenido");

-- CreateIndex
CREATE INDEX "multimedia_subidoPorId_idx" ON "multimedia"("subidoPorId");

-- CreateIndex
CREATE INDEX "multimedia_esPrincipal_idx" ON "multimedia"("esPrincipal");

-- CreateIndex
CREATE INDEX "multimedia_estado_idx" ON "multimedia"("estado");

-- CreateIndex
CREATE INDEX "multimedia_creadoEn_idx" ON "multimedia"("creadoEn");

-- CreateIndex
CREATE INDEX "multimedia_estadoSincronizacion_idx" ON "multimedia"("estadoSincronizacion");

-- AddForeignKey
ALTER TABLE "multimedia" ADD CONSTRAINT "multimedia_subidoPorId_fkey" FOREIGN KEY ("subidoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "multimedia" ADD CONSTRAINT "multimedia_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "multimedia" ADD CONSTRAINT "multimedia_prestamoId_fkey" FOREIGN KEY ("prestamoId") REFERENCES "Prestamo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "multimedia" ADD CONSTRAINT "multimedia_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "Pago"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "multimedia" ADD CONSTRAINT "multimedia_gastoId_fkey" FOREIGN KEY ("gastoId") REFERENCES "Gasto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "multimedia" ADD CONSTRAINT "multimedia_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "multimedia" ADD CONSTRAINT "multimedia_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "multimedia" ADD CONSTRAINT "multimedia_reciboId_fkey" FOREIGN KEY ("reciboId") REFERENCES "recibos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
