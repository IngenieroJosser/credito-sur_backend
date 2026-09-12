-- Ultimo nivel interno de mora (1-5) con el que se evaluo al cliente.
--
-- Antes vivia en un Map en memoria de MoraService: se perdia en cada reinicio
-- y el proceso volvia a notificar a todos los clientes en mora aunque no
-- hubieran cambiado de nivel.
--
-- Se agrega SIN default y despues se fija el default, a proposito: en Postgres
-- un ADD COLUMN con DEFAULT rellena las filas existentes con ese valor. Asi las
-- filas que ya existen quedan en NULL (el proceso las siembra sin notificar,
-- para que el primer arranque tras el despliegue no avise a todos otra vez) y
-- los clientes nuevos arrancan en 1 (su primera entrada en mora si se avisa).
ALTER TABLE "Cliente" ADD COLUMN "nivelMoraNotificado" INTEGER;
ALTER TABLE "Cliente" ALTER COLUMN "nivelMoraNotificado" SET DEFAULT 1;
