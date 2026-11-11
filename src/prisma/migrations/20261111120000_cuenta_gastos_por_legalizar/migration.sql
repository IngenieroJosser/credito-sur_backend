-- Las cuentas que faltaban para que un cobrador pueda registrar un gasto.
--
-- Sin ellas, `POST /accounting/gastos` responde:
--
--   [GASTO_PROVISIONAL] Faltan cuentas contables requeridas para registrar
--   gasto provisional: 1.6.1
--
-- O sea que un cobrador que echa gasolina a la moto no puede anotarlo, y con
-- eso se bloquea el ciclo entero del gasto: `approvals.service.ts` usa la misma
-- cuenta 1.6.1 para reclasificar el gasto cuando se aprueba (a 1.2.1) o cuando
-- se le carga al cobrador (a 1.4.1).
--
-- Por que faltaban: 1.6 y 1.6.1 estan definidas en `seed-accounting.ts`, pero
-- ese archivo no lo ejecuta nada —ni package.json, ni el arranque, ni otra
-- semilla— y la migracion que siembra el plan de cuentas
-- (20260518103000_seed_required_accounting_accounts) no las incluye. Comprobado
-- buscando '1.6' en todas las migraciones: no aparece en ninguna. El despliegue
-- corre migraciones, asi que esto faltaba tambien en produccion.
--
-- Se encontro simulando una jornada de cobro completa —abrir la ruta, cobrar a
-- tres clientes, registrar un gasto, arquear la caja—, no leyendo el codigo.
--
-- Los valores son los mismos que declara `seed-accounting.ts`, para que las dos
-- fuentes no se separen. `ON CONFLICT` igual que en la migracion del plan de
-- cuentas: si alguien ya las creo a mano, esto no la pisa con algo distinto, y
-- la migracion se puede volver a correr sin dano.

INSERT INTO "cuentas_contables" ("code", "name", "type", "nature", "description", "isActive")
VALUES
  ('1.6', 'Gastos por Legalizar', 'ACTIVO', 'DEBITORA', 'Cuenta puente para gastos de ruta pendientes de revision', true),
  ('1.6.1', 'Gastos por Legalizar', 'ACTIVO', 'DEBITORA', 'Gastos de ruta pendientes de aprobacion', true)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "type" = EXCLUDED."type",
  "nature" = EXCLUDED."nature",
  "description" = EXCLUDED."description",
  "isActive" = true;
