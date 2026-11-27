CREATE TYPE "EstadoExpedienteHistorico" AS ENUM ('EN_REVISION', 'IMPORTADO', 'REVERTIDO');

CREATE TABLE "expedientes_historicos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "huellaCartera" CHAR(64) NOT NULL,
    "huellaInventario" CHAR(64) NOT NULL,
    "preparador" VARCHAR(30) NOT NULL,
    "esquema" INTEGER NOT NULL,
    "reglas" VARCHAR(50) NOT NULL,
    "estado" "EstadoExpedienteHistorico" NOT NULL DEFAULT 'EN_REVISION',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "creadoPorId" TEXT NOT NULL REFERENCES "Usuario"("id") ON UPDATE CASCADE,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX "expedientes_historicos_fuentes_version_key"
ON "expedientes_historicos"("huellaCartera", "huellaInventario", "preparador", "esquema", "reglas");
CREATE INDEX "expedientes_historicos_actualizadoEn_idx" ON "expedientes_historicos"("actualizadoEn");

CREATE TABLE "revisiones_expedientes_historicos" (
    "expedienteId" TEXT NOT NULL REFERENCES "expedientes_historicos"("id") ON UPDATE CASCADE,
    "numero" INTEGER NOT NULL,
    "huella" CHAR(64) NOT NULL,
    "resultado" JSONB NOT NULL,
    "usuarioId" TEXT NOT NULL REFERENCES "Usuario"("id") ON UPDATE CASCADE,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("expedienteId", "numero")
);
CREATE INDEX "revisiones_expedientes_historicos_usuarioId_idx" ON "revisiones_expedientes_historicos"("usuarioId");

CREATE TABLE "articulos_historicos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "expedienteId" TEXT NOT NULL REFERENCES "expedientes_historicos"("id") ON UPDATE CASCADE,
    "referencia" VARCHAR(80) NOT NULL,
    "codigoOrigen" VARCHAR(80),
    "descripcion" VARCHAR(255),
    "evidencia" JSONB NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "articulos_historicos_expedienteId_referencia_key" ON "articulos_historicos"("expedienteId", "referencia");

CREATE TABLE "referencias_expedientes_historicos" (
    "expedienteId" TEXT NOT NULL REFERENCES "expedientes_historicos"("id") ON UPDATE CASCADE,
    "referencia" VARCHAR(80) NOT NULL,
    "entidad" VARCHAR(30) NOT NULL,
    "entidadId" TEXT NOT NULL,
    "evidencia" JSONB NOT NULL,
    PRIMARY KEY ("expedienteId", "referencia")
);
CREATE INDEX "referencias_expedientes_entidad_id_idx" ON "referencias_expedientes_historicos"("entidad", "entidadId");

CREATE TABLE "cargas_expedientes_historicos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "expedienteId" TEXT NOT NULL REFERENCES "expedientes_historicos"("id") ON UPDATE CASCADE,
    "revision" INTEGER NOT NULL,
    "huella" CHAR(64) NOT NULL,
    "loteId" TEXT NOT NULL REFERENCES "importaciones_lotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "resultado" JSONB NOT NULL,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revertidaEn" TIMESTAMP(3),
    "revertidaPorId" TEXT
);
CREATE UNIQUE INDEX "cargas_expedientes_historicos_loteId_key" ON "cargas_expedientes_historicos"("loteId");
CREATE UNIQUE INDEX "cargas_expedientes_historicos_expedienteId_huella_key" ON "cargas_expedientes_historicos"("expedienteId", "huella");

ALTER TABLE "Prestamo" ADD COLUMN "articuloHistoricoId" TEXT REFERENCES "articulos_historicos"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Prestamo_articuloHistoricoId_idx" ON "Prestamo"("articuloHistoricoId");

ALTER TABLE "Cliente" ALTER COLUMN "dni" DROP NOT NULL;

ALTER TABLE "Prestamo" ADD COLUMN "soloPruebaHistorica" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Prestamo" ADD CONSTRAINT "prestamo_prueba_historica_sin_cobranza" CHECK (
    NOT "soloPruebaHistorica" OR ("estado" = 'BORRADOR' AND "estadoAprobacion" = 'PENDIENTE' AND "cargaHistoricaEn" IS NOT NULL)
);
