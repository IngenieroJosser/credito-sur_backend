-- AlterTable: Agregar campo nombreUsuario
ALTER TABLE "Usuario" ADD COLUMN "nombreUsuario" VARCHAR(50);

-- Generar nombreUsuario automáticamente desde nombres y apellidos
-- Formato: primera letra nombre + primera letra segundo nombre (si existe) + primer apellido en minúsculas
UPDATE "Usuario" 
SET "nombreUsuario" = LOWER(
  REGEXP_REPLACE(
    CONCAT(
      SUBSTRING(SPLIT_PART(nombres, ' ', 1), 1, 1),
      CASE 
        WHEN ARRAY_LENGTH(STRING_TO_ARRAY(nombres, ' '), 1) > 1 
        THEN SUBSTRING(SPLIT_PART(nombres, ' ', 2), 1, 1)
        ELSE ''
      END,
      SPLIT_PART(apellidos, ' ', 1)
    ),
    '[^a-z0-9]', '', 'g'
  )
)
WHERE "nombreUsuario" IS NULL;

-- Manejar duplicados agregando números secuenciales
DO $$
DECLARE
  usuario_record RECORD;
  contador INT;
BEGIN
  FOR usuario_record IN 
    SELECT id, "nombreUsuario"
    FROM "Usuario"
    WHERE "nombreUsuario" IN (
      SELECT "nombreUsuario"
      FROM "Usuario"
      GROUP BY "nombreUsuario"
      HAVING COUNT(*) > 1
    )
    ORDER BY "creadoEn"
  LOOP
    SELECT COUNT(*) INTO contador
    FROM "Usuario"
    WHERE "nombreUsuario" = usuario_record."nombreUsuario"
    AND "creadoEn" < (SELECT "creadoEn" FROM "Usuario" WHERE id = usuario_record.id);
    
    IF contador > 0 THEN
      UPDATE "Usuario"
      SET "nombreUsuario" = usuario_record."nombreUsuario" || contador::text
      WHERE id = usuario_record.id;
    END IF;
  END LOOP;
END $$;

-- Hacer el campo obligatorio y único
ALTER TABLE "Usuario" ALTER COLUMN "nombreUsuario" SET NOT NULL;
CREATE UNIQUE INDEX "Usuario_nombreUsuario_key" ON "Usuario"("nombreUsuario");
CREATE INDEX "Usuario_nombreUsuario_idx" ON "Usuario"("nombreUsuario");
