-- Si un pago fue PAGO o ABONO.
--
-- El DTO de crear pago recibe `tipoRegistro` desde siempre y lo usa para decidir
-- comportamiento (el minimo del abono, el estado que queda en la visita, la nota de
-- gestion), pero NO lo guardaba. El export de pagos tiene una columna `esAbono` que por
-- eso salia SIEMPRE en false: no habia de donde sacarla. El unico rastro que quedaba era
-- la prosa de las notas de la visita ("...por registro de abono"), que no es un dato con
-- el que se pueda contar.
--
-- La columna va NULLABLE y sin valor por omision a proposito. Los pagos anteriores no se
-- sabe cual fueron, y poner PAGO por omision etiquetaria como pago a todos los abonos
-- historicos, que es peor que no saber.

CREATE TYPE "TipoRegistroPago" AS ENUM ('PAGO', 'ABONO');

ALTER TABLE "Pago" ADD COLUMN "tipoRegistro" "TipoRegistroPago";
