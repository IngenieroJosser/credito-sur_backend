-- AlterTable
ALTER TABLE "Prestamo" ADD COLUMN     "fechaPrimerCobro" TIMESTAMP(3),
ADD COLUMN     "garantia" TEXT,
ADD COLUMN     "notas" TEXT;
