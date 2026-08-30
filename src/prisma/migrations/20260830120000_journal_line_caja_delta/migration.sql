-- Guarda lo que cada linea del libro movio en su caja.
--
-- `cajaDelta` existia solo en memoria: el servicio lo calculaba, ajustaba
-- `cajas.saldoActual` y lo tiraba. Sin esa columna no hay forma de reconciliar
-- el saldo de una caja contra el libro ni de saber que asiento la movio.
--
-- Queda NULL en todo lo anterior: no se rellena hacia atras porque el valor
-- historico no se puede deducir con certeza (no siempre coincide con
-- debito - credito) y rellenarlo a ojo daria una reconciliacion falsa.

ALTER TABLE "asientos_lineas" ADD COLUMN "cajaDelta" DECIMAL(15,2);
