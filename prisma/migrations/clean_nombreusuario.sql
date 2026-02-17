-- Paso 1: Eliminar restricciones y columna existente
DO $$ 
BEGIN
    -- Eliminar índice único si existe
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Usuario_nombreUsuario_key') THEN
        DROP INDEX "Usuario_nombreUsuario_key";
    END IF;
    
    -- Eliminar índice regular si existe
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Usuario_nombreUsuario_idx') THEN
        DROP INDEX "Usuario_nombreUsuario_idx";
    END IF;
    
    -- Eliminar columna si existe
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Usuario' AND column_name = 'nombreUsuario') THEN
        ALTER TABLE "Usuario" DROP COLUMN "nombreUsuario";
    END IF;
END $$;

-- Paso 2: Crear columna nueva
ALTER TABLE "Usuario" ADD COLUMN "nombreUsuario" VARCHAR(50);

-- Paso 3: Generar valores únicos para cada usuario
WITH usuarios_numerados AS (
  SELECT 
    id,
    LOWER(
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
    ) as base_nombre,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(
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
      ORDER BY "creadoEn"
    ) - 1 as numero
  FROM "Usuario"
)
UPDATE "Usuario" u
SET "nombreUsuario" = CASE 
  WHEN un.numero = 0 THEN un.base_nombre
  ELSE un.base_nombre || un.numero::text
END
FROM usuarios_numerados un
WHERE u.id = un.id;

-- Paso 4: Hacer obligatorio y crear índices
ALTER TABLE "Usuario" ALTER COLUMN "nombreUsuario" SET NOT NULL;
CREATE UNIQUE INDEX "Usuario_nombreUsuario_key" ON "Usuario"("nombreUsuario");
CREATE INDEX "Usuario_nombreUsuario_idx" ON "Usuario"("nombreUsuario");

-- Paso 5: Verificar resultado
SELECT id, nombres, apellidos, "nombreUsuario", correo FROM "Usuario" ORDER BY "creadoEn";
