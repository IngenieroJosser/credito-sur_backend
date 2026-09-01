-- Migración de DATOS (no de esquema), idempotente:
-- Crea el permiso 'importaciones' y lo concede a los roles ADMIN y
-- SUPER_ADMINISTRADOR. Necesaria porque el módulo de importaciones pasó a
-- gatearse por la matriz de permisos (@Permisos('importaciones')). Al correr
-- en el deploy (prisma migrate deploy), no requiere acceso a shell.
-- Segura de re-ejecutar: usa ON CONFLICT DO NOTHING.

-- 1) El permiso
INSERT INTO "permisos" (id, modulo, accion, nombre, descripcion, icono, ruta, orden, "esNavegable")
VALUES (
  gen_random_uuid(),
  'Sistema',
  'importaciones',
  'Importaciones',
  'Carga masiva de clientes, créditos e inventario',
  'Upload',
  '/admin/sistema/importaciones',
  53,
  true
)
ON CONFLICT (modulo, accion) DO NOTHING;

-- 2) Concederlo a ADMIN y SUPER_ADMINISTRADOR (idempotente)
INSERT INTO "roles_permisos" (id, "rolId", "permisoId")
SELECT gen_random_uuid(), r.id, p.id
FROM "roles" r
CROSS JOIN "permisos" p
WHERE r.nombre IN ('ADMIN', 'SUPER_ADMINISTRADOR')
  AND p.modulo = 'Sistema'
  AND p.accion = 'importaciones'
ON CONFLICT ("rolId", "permisoId") DO NOTHING;
