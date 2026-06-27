UPDATE "Cliente"
SET
  "estadoAprobacion" = 'APROBADO',
  "aprobadoPorId" = COALESCE("aprobadoPorId", "creadoPorId")
WHERE
  "estadoAprobacion" = 'PENDIENTE'
  AND "eliminadoEn" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "Prestamo"
    WHERE
      "Prestamo"."clienteId" = "Cliente"."id"
      AND "Prestamo"."eliminadoEn" IS NULL
      AND "Prestamo"."estadoAprobacion" = 'APROBADO'
      AND "Prestamo"."estado" NOT IN ('BORRADOR', 'PENDIENTE_APROBACION')
  );
