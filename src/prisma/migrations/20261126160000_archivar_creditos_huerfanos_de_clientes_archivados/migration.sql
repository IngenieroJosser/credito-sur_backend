-- Sanea créditos huérfanos que quedaron activos/en mora en producción cuando su
-- cliente ya había sido archivado antes del archivado en cascada.
--
-- Al compartir la misma marca de tiempo (`c."eliminadoEn"`), si alguien restaura
-- el cliente más adelante, `ClientsService.restore` también recuperará estos
-- créditos sin tocar créditos archivados aparte.
--
-- También rechaza aprobaciones pendientes de esos créditos para que aprobarlas
-- después no reviva un crédito archivado.

UPDATE "Prestamo" p
SET
  "eliminadoEn" = c."eliminadoEn",
  "estadoSincronizacion" = 'PENDIENTE'
FROM "Cliente" c
WHERE p."clienteId" = c."id"
  AND c."eliminadoEn" IS NOT NULL
  AND p."eliminadoEn" IS NULL;

UPDATE "aprobaciones" a
SET
  "estado" = 'RECHAZADO',
  "comentarios" = COALESCE(NULLIF(a."comentarios", ''), 'Crédito archivado junto con su cliente (saneamiento)'),
  "revisadoEn" = COALESCE(a."revisadoEn", NOW())
FROM "Prestamo" p
WHERE a."referenciaId" = p."id"
  AND p."eliminadoEn" IS NOT NULL
  AND a."estado" = 'PENDIENTE';
