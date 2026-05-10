-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESOS', 'GASTOS');

-- CreateEnum
CREATE TYPE "Nature" AS ENUM ('DEBITORA', 'ACREEDORA');

-- CreateEnum
CREATE TYPE "ReferenceTypeContable" AS ENUM ('PAGO', 'DESEMBOLSO', 'GASTO', 'BASE', 'CONSOLIDACION', 'ARQUEO', 'ABONO_DEUDA', 'APERTURA', 'AJUSTE');

-- CreateTable
CREATE TABLE "cuentas_contables" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "nature" "Nature" NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cuentas_contables_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "asientos_contables" (
    "id" TEXT NOT NULL,
    "referenceType" "ReferenceTypeContable" NOT NULL,
    "referenceId" TEXT NOT NULL,
    "description" TEXT,
    "isOpening" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "asientos_contables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asientos_lineas" (
    "id" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "debitAmount" DECIMAL(15,2),
    "creditAmount" DECIMAL(15,2),
    "cajaId" TEXT,

    CONSTRAINT "asientos_lineas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "asientos_contables_referenceType_referenceId_idx" ON "asientos_contables"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "asientos_contables_createdAt_idx" ON "asientos_contables"("createdAt");

-- CreateIndex
CREATE INDEX "asientos_lineas_journalEntryId_idx" ON "asientos_lineas"("journalEntryId");

-- CreateIndex
CREATE INDEX "asientos_lineas_accountCode_idx" ON "asientos_lineas"("accountCode");

-- CreateIndex
CREATE INDEX "asientos_lineas_cajaId_idx" ON "asientos_lineas"("cajaId");

-- AddForeignKey
ALTER TABLE "asientos_lineas" ADD CONSTRAINT "asientos_lineas_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "asientos_contables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asientos_lineas" ADD CONSTRAINT "asientos_lineas_accountCode_fkey" FOREIGN KEY ("accountCode") REFERENCES "cuentas_contables"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
