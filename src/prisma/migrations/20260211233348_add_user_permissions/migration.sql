-- CreateTable
CREATE TABLE "asignaciones_permisos_usuarios" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "permisoId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asignaciones_permisos_usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "asignaciones_permisos_usuarios_usuarioId_permisoId_key" ON "asignaciones_permisos_usuarios"("usuarioId", "permisoId");

-- AddForeignKey
ALTER TABLE "asignaciones_permisos_usuarios" ADD CONSTRAINT "asignaciones_permisos_usuarios_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_permisos_usuarios" ADD CONSTRAINT "asignaciones_permisos_usuarios_permisoId_fkey" FOREIGN KEY ("permisoId") REFERENCES "permisos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
