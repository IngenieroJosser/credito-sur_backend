/*
  Warnings:

  - You are about to drop the column `nombreUsuario` on the `Usuario` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Usuario_nombreUsuario_idx";

-- DropIndex
DROP INDEX "Usuario_nombreUsuario_key";

-- AlterTable
ALTER TABLE "Usuario" DROP COLUMN "nombreUsuario";
