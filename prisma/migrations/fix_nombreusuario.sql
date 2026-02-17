-- Verificar si el campo existe y agregarlo si no
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Usuario' AND column_name = 'nombreUsuario'
    ) THEN
        ALTER TABLE "Usuario" ADD COLUMN "nombreUsuario" VARCHAR(50);
    END IF;
END $$;

-- Limpiar valores existentes para regenerar
UPDATE "Usuario" SET "nombreUsuario" = NULL WHERE "nombreUsuario" IS NOT NULL;

-- Eliminar índices si existen
DROP INDEX IF EXISTS "Usuario_nombreUsuario_key";
DROP INDEX IF EXISTS "Usuario_nombreUsuario_idx";

-- Generar nombreUsuario automáticamente desde nombres y apellidos
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
  nuevo_nombre VARCHAR(50);
BEGIN
  FOR usuario_record IN 
    SELECT id, "nombreUsuario", "creadoEn"
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
    AND "creadoEn" < usuario_record."creadoEn";
    
    IF contador > 0 THEN
      nuevo_nombre := usuario_record."nombreUsuario" || contador::text;
      UPDATE "Usuario"
      SET "nombreUsuario" = nuevo_nombre
      WHERE id = usuario_record.id;
      RAISE NOTICE 'Usuario % actualizado a %', usuario_record.id, nuevo_nombre;
    END IF;
  END LOOP;
END $$;

-- Hacer el campo obligatorio si no lo es
DO $$
BEGIN
    ALTER TABLE "Usuario" ALTER COLUMN "nombreUsuario" SET NOT NULL;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Column nombreUsuario already NOT NULL';
END $$;

-- Crear índices
CREATE UNIQUE INDEX IF NOT EXISTS "Usuario_nombreUsuario_key" ON "Usuario"("nombreUsuario");
CREATE INDEX IF NOT EXISTS "Usuario_nombreUsuario_idx" ON "Usuario"("nombreUsuario");

-- Mostrar resultado
SELECT id, nombres, apellidos, "nombreUsuario" FROM "Usuario" ORDER BY "creadoEn";
