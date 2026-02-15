-- CreateEnum
CREATE TYPE "TipoAmortizacion" AS ENUM ('INTERES_SIMPLE', 'FRANCESA');

-- AlterTable
ALTER TABLE "Prestamo" ADD COLUMN     "tipoAmortizacion" "TipoAmortizacion" NOT NULL DEFAULT 'INTERES_SIMPLE';
