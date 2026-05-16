DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "cajas"
    WHERE "activa" = true
      AND "tipo" = 'RUTA'
      AND "rutaId" IS NOT NULL
    GROUP BY "rutaId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'No se puede crear el índice: existen rutas con más de una caja RUTA activa';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "asignaciones_rutas"
    WHERE "activa" = true
    GROUP BY "rutaId", "clienteId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'No se puede crear el índice: existen clientes duplicados activos en la misma ruta';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Transaccion"
    WHERE "tipoReferencia" = 'ACTIVACION_RUTA'
    GROUP BY "cajaId", ("fechaTransaccion"::date)
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'No se puede crear el índice: existen activaciones de ruta duplicadas para la misma caja y día';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "cajas_one_active_route_box_per_route_idx"
  ON "cajas"("rutaId")
  WHERE "activa" = true
    AND "tipo" = 'RUTA'
    AND "rutaId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "asignaciones_rutas_one_active_client_route_idx"
  ON "asignaciones_rutas"("rutaId", "clienteId")
  WHERE "activa" = true;

CREATE UNIQUE INDEX IF NOT EXISTS "transaccion_one_route_activation_per_box_day_idx"
  ON "Transaccion"("cajaId", ("fechaTransaccion"::date))
  WHERE "tipoReferencia" = 'ACTIVACION_RUTA';
