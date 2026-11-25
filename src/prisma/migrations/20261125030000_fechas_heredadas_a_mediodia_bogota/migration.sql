-- Fechas heredadas que quedaron a MEDIANOCHE UTC, corregidas al mediodía de Bogotá.
--
-- ── Qué pasaba ──────────────────────────────────────────────────────────────
--
-- La convención del repo es anclar toda fecha de calendario al mediodía de
-- Bogotá (`T12:00:00-05:00`, o sea 17:00 UTC). El motivo está escrito en
-- `date-utils.ts` y en `amortizacion.utils.ts`: así la fecha nunca cae en el
-- borde del día y no se corre al leerla desde un servidor en UTC.
--
-- Un timestamp guardado a las `00:00:00` UTC, en Bogotá, son **las 19:00 del
-- día ANTERIOR**. Así que una cuota con `2026-03-10T00:00:00Z` el sistema la
-- trata como vencida el **9** de marzo: entra en mora un día antes y aparece
-- en la jornada del día equivocado.
--
-- Eso lo producía el importador antes del arreglo (`cell-value.util.ts`, que
-- ahora ancla sus tres ramas al mediodía). Las filas que entraron antes se
-- quedaron así.
--
-- ── Cuántas son ─────────────────────────────────────────────────────────────
--
-- Medido en la base de desarrollo el 2026-11-25:
--
--     cuotas.fechaVencimiento        88 a medianoche   ·   1.549 al mediodía
--     Prestamo.fechaInicio            7 a medianoche
--     Prestamo.fechaFin               7 a medianoche
--     cuotas.fechaPago                0   (es un instante real, no se toca)
--     Pago.fechaPago                  0   (ídem)
--
-- ── Qué hace y qué NO hace ──────────────────────────────────────────────────
--
-- Mueve la HORA al mediodía de Bogotá conservando el DÍA que traía el dato, que
-- es la fecha que el importador quiso escribir. No cambia ninguna otra fila: el
-- filtro es la hora exacta `00:00:00`, y el código actual nunca escribe esa
-- hora, así que correrla dos veces no hace nada la segunda.
--
-- No se tocan `cuotas.fechaPago` ni `Pago.fechaPago`: esos son instantes reales
-- —el momento en que alguien pagó—, no fechas de calendario, y ahí la hora es
-- un dato.

UPDATE cuotas
SET "fechaVencimiento" = date_trunc('day', "fechaVencimiento") + interval '17 hours'
WHERE "fechaVencimiento"::time = '00:00:00';

UPDATE cuotas
SET "fechaVencimientoProrroga" = date_trunc('day', "fechaVencimientoProrroga") + interval '17 hours'
WHERE "fechaVencimientoProrroga" IS NOT NULL
  AND "fechaVencimientoProrroga"::time = '00:00:00';

UPDATE "Prestamo"
SET "fechaInicio" = date_trunc('day', "fechaInicio") + interval '17 hours'
WHERE "fechaInicio"::time = '00:00:00';

UPDATE "Prestamo"
SET "fechaFin" = date_trunc('day', "fechaFin") + interval '17 hours'
WHERE "fechaFin"::time = '00:00:00';
