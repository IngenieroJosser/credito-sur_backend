-- AlterTable
ALTER TABLE "permisos" ADD COLUMN     "esNavegable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "icono" VARCHAR(50),
ADD COLUMN     "orden" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ruta" VARCHAR(200);

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "rutaDefault" VARCHAR(100);
