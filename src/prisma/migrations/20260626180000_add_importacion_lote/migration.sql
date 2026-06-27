-- Migration: add_importacion_lote
-- Adds ImportacionLote table and its required enums.
-- Does NOT modify NivelRiesgo, Cliente or any existing table/enum.

-- 1. Create enums
CREATE TYPE "TipoImportacion" AS ENUM (
  'CLIENTES_CREDITOS',
  'INVENTARIO'
);

CREATE TYPE "EstadoImportacion" AS ENUM (
  'VALIDADO',
  'CONFIRMADO',
  'FALLIDO',
  'CANCELADO'
);

-- 2. Create table
CREATE TABLE "importaciones_lotes" (
  "id"            TEXT             NOT NULL,
  "tipo"          "TipoImportacion"  NOT NULL,
  "estado"        "EstadoImportacion" NOT NULL DEFAULT 'VALIDADO',
  "nombreArchivo" VARCHAR(255)     NOT NULL,
  "totalFilas"    INTEGER          NOT NULL DEFAULT 0,
  "filasValidas"  INTEGER          NOT NULL DEFAULT 0,
  "filasConError" INTEGER          NOT NULL DEFAULT 0,
  "advertencias"  INTEGER          NOT NULL DEFAULT 0,
  "resumen"       JSONB,
  "errores"       JSONB,
  "creadoPorId"   TEXT             NOT NULL,
  "creadoEn"      TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmadoEn"  TIMESTAMP(3),

  CONSTRAINT "importaciones_lotes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "importaciones_lotes_creadoPorId_fkey"
    FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 3. Indexes
CREATE INDEX "importaciones_lotes_tipo_idx"        ON "importaciones_lotes"("tipo");
CREATE INDEX "importaciones_lotes_estado_idx"       ON "importaciones_lotes"("estado");
CREATE INDEX "importaciones_lotes_creadoPorId_idx"  ON "importaciones_lotes"("creadoPorId");
CREATE INDEX "importaciones_lotes_creadoEn_idx"     ON "importaciones_lotes"("creadoEn");
