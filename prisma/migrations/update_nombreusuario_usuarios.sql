-- Actualizar nombreUsuario para usuarios específicos evitando duplicados

-- Superadministrador
UPDATE "Usuario" 
SET "nombreUsuario" = 'superadmin'
WHERE correo = 'superadmin@creditosur.com';

-- Administrador
UPDATE "Usuario" 
SET "nombreUsuario" = 'admin'
WHERE correo = 'admin@creditosur.com';

-- Coordinador
UPDATE "Usuario" 
SET "nombreUsuario" = 'coordinador'
WHERE correo = 'coordinador@credisur.com';

-- Supervisor
UPDATE "Usuario" 
SET "nombreUsuario" = 'supervisor'
WHERE correo = 'supervisor@credisur.com';

-- Cobrador
UPDATE "Usuario" 
SET "nombreUsuario" = 'cobrador'
WHERE correo = 'cobrador@credisur.com';

-- Contador
UPDATE "Usuario" 
SET "nombreUsuario" = 'contador'
WHERE correo = 'contador@credisur.com';

-- Punto de Venta
UPDATE "Usuario" 
SET "nombreUsuario" = 'ventas'
WHERE correo = 'ventas@credisur.com';

-- Verificar resultado
SELECT id, "nombreUsuario", correo, nombres, apellidos, rol 
FROM "Usuario" 
ORDER BY "creadoEn";
