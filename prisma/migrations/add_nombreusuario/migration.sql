-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN "nombreUsuario" VARCHAR(50);

-- Generar nombreUsuario automáticamente desde nombres y apellidos
-- Formato: primera letra del primer nombre + primera letra del segundo nombre (si existe) + primer apellido en minúsculas
UPDATE "Usuario" 
SET "nombreUsuario" = LOWER(
  CONCAT(
    SUBSTRING(SPLIT_PART(nombres, ' ', 1), 1, 1),
    CASE 
      WHEN SPLIT_PART(nombres, ' ', 2) != '' 
      THEN SUBSTRING(SPLIT_PART(nombres, ' ', 2), 1, 1)
      ELSE ''
    END,
    SPLIT_PART(apellidos, ' ', 1)
  )
)
WHERE "nombreUsuario" IS NULL;

-- Manejar duplicados agregando números secuenciales
WITH duplicates AS (
  SELECT "nombreUsuario", COUNT(*) as cnt
  FROM "Usuario"
  GROUP BY "nombreUsuario"
  HAVING COUNT(*) > 1
)
UPDATE "Usuario" u
SET "nombreUsuario" = u."nombreUsuario" || (
  SELECT ROW_NUMBER() OVER (PARTITION BY u2."nombreUsuario" ORDER BY u2."creadoEn")
  FROM "Usuario" u2
  WHERE u2."nombreUsuario" = u."nombreUsuario" AND u2.id = u.id
)::text
WHERE u."nombreUsuario" IN (SELECT "nombreUsuario" FROM duplicates);

-- Hacer el campo obligatorio y único
ALTER TABLE "Usuario" ALTER COLUMN "nombreUsuario" SET NOT NULL;
CREATE UNIQUE INDEX "Usuario_nombreUsuario_key" ON "Usuario"("nombreUsuario");
CREATE INDEX "Usuario_nombreUsuario_idx" ON "Usuario"("nombreUsuario");
