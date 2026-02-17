-- ============================================================================
-- SCRIPT DE MIGRACIÓN PARA PRODUCCIÓN
-- Asignar nombreUsuario a usuarios existentes que no lo tienen
-- ============================================================================
-- 
-- IMPORTANTE: Este script debe ejecutarse en producción para asignar
-- automáticamente un nombreUsuario a todos los usuarios que no lo tienen.
--
-- El nombreUsuario se genera con el formato:
-- - Primera letra del primer nombre
-- - Primera letra del segundo nombre (si existe)
-- - Primer apellido
-- - Todo en minúsculas, sin espacios ni caracteres especiales
--
-- Ejemplo: Juan Diego Ramirez → jdramirez
--
-- ============================================================================

-- Función para generar nombreUsuario desde nombres y apellidos
CREATE OR REPLACE FUNCTION generar_nombre_usuario(nombres TEXT, apellidos TEXT) 
RETURNS TEXT AS $$
DECLARE
    nombre_parts TEXT[];
    apellido_parts TEXT[];
    resultado TEXT;
BEGIN
    -- Dividir nombres y apellidos
    nombre_parts := string_to_array(nombres, ' ');
    apellido_parts := string_to_array(apellidos, ' ');
    
    -- Construir nombreUsuario
    resultado := lower(
        substring(nombre_parts[1] from 1 for 1) || 
        COALESCE(substring(nombre_parts[2] from 1 for 1), '') || 
        apellido_parts[1]
    );
    
    -- Remover caracteres especiales
    resultado := regexp_replace(resultado, '[^a-z0-9]', '', 'g');
    
    RETURN resultado;
END;
$$ LANGUAGE plpgsql;

-- Actualizar usuarios que no tienen nombreUsuario o tienen valor NULL/vacío
UPDATE "Usuario" u
SET "nombreUsuario" = (
    SELECT CASE 
        WHEN EXISTS (
            SELECT 1 FROM "Usuario" u2 
            WHERE u2."nombreUsuario" = generar_nombre_usuario(u.nombres, u.apellidos)
            AND u2.id != u.id
        ) THEN
            -- Si ya existe, agregar un número secuencial
            generar_nombre_usuario(u.nombres, u.apellidos) || 
            (SELECT COUNT(*) + 1 
             FROM "Usuario" u3 
             WHERE u3."nombreUsuario" LIKE generar_nombre_usuario(u.nombres, u.apellidos) || '%'
             AND u3.id != u.id
            )::TEXT
        ELSE
            -- Si no existe, usar el generado
            generar_nombre_usuario(u.nombres, u.apellidos)
    END
)
WHERE "nombreUsuario" IS NULL 
   OR "nombreUsuario" = ''
   OR LENGTH("nombreUsuario") < 3;

-- Verificar resultados
SELECT 
    id,
    "nombreUsuario",
    nombres,
    apellidos,
    correo,
    rol
FROM "Usuario"
WHERE "eliminadoEn" IS NULL
ORDER BY "creadoEn";

-- Limpiar función temporal
DROP FUNCTION IF EXISTS generar_nombre_usuario(TEXT, TEXT);

-- ============================================================================
-- INSTRUCCIONES DE EJECUCIÓN EN PRODUCCIÓN:
-- ============================================================================
--
-- 1. Hacer backup de la base de datos:
--    pg_dump -U postgres -d credisur_prod > backup_antes_nombreusuario.sql
--
-- 2. Ejecutar este script:
--    psql -U postgres -d credisur_prod -f asignar_nombreusuario_produccion.sql
--
-- 3. Verificar que todos los usuarios tienen nombreUsuario:
--    SELECT COUNT(*) FROM "Usuario" WHERE "nombreUsuario" IS NULL;
--    (Debe retornar 0)
--
-- 4. Reiniciar el servidor backend para que cargue los cambios
--
-- ============================================================================
