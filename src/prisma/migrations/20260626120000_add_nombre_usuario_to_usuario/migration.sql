ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "nombreUsuario" VARCHAR(50);

CREATE UNIQUE INDEX IF NOT EXISTS "Usuario_nombreUsuario_key"
ON "Usuario"("nombreUsuario");

DROP INDEX IF EXISTS "Usuario_nombreUsuario_idx";
