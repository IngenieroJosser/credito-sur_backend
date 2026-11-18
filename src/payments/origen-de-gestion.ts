import { RolUsuario } from '@prisma/client';

/**
 * De donde viene un pago: de la calle o de la oficina.
 *
 * ── El problema que resuelve ────────────────────────────────────────────────
 *
 * El cliente que no quiere esperar al cobrador va a pagar a la sede, y ahi lo
 * recibe el coordinador. Ese pago entra a CAJA-OFICINA —lo decide
 * `resolveCajaIngresoPago`, por el rol de quien registra— pero el `cobradorId`
 * del `Pago` se fuerza al cobrador de la RUTA (`payments.service.ts`, en la
 * rama `!isCollector(actor)`), porque el recaudo y la meta de la ruta tienen
 * que contarlo: el cliente pago su cuota.
 *
 * La consecuencia era que no quedaba rastro de quien lo habia recibido. En la
 * ruta, `CobradorElements` solo dice «lo cobro X» cuando el acreditado difiere
 * del cobrador de la ruta, y aqui coinciden: el cobrador veia al cliente ya
 * pagado, sin saber que el dinero lo tiene la oficina. Es la misma clase de
 * silencio que ya se arreglo para el supervisor.
 *
 * ── Por que la marca la pone el servidor ────────────────────────────────────
 *
 * `origenGestion` esta en la whitelist del controlador limitada a
 * `CIERRE_PENDIENTE`, asi que el frontend no puede mandar `OFICINA` ni aunque
 * quiera: se cae en el DTO. Y es lo correcto, porque esto no es un dato que
 * declare quien registra, es una consecuencia de QUIEN es.
 *
 * `CIERRE_PENDIENTE` manda sobre esta marca: es un flujo de regularizacion con
 * su propia fecha operativa, y hay media docena de consultas que dependen de
 * ese valor exacto.
 */
export const ORIGEN_OFICINA = 'OFICINA';

/**
 * Los roles cuyo efectivo entra a CAJA-OFICINA.
 *
 * Es la misma lista que `rolesOficina` en `resolveCajaIngresoPago`, y tiene
 * que seguir siendolo: si un rol entra ahi y no aqui, su pago acabaria en la
 * caja de la oficina sin que nada lo dijera. Lo vigila
 * `origen-de-gestion.spec.ts`.
 */
export const ROLES_DE_OFICINA: readonly string[] = [
  RolUsuario.COORDINADOR,
  RolUsuario.ADMIN,
  RolUsuario.SUPER_ADMINISTRADOR,
];

export const esRolDeOficina = (rol?: string | null): boolean =>
  ROLES_DE_OFICINA.includes(String(rol || '').toUpperCase());

/**
 * El `origenGestion` con el que nace un pago.
 *
 * @param origenPedido lo que llego en el DTO (solo puede ser CIERRE_PENDIENTE)
 * @param rolDelActor  el rol de quien esta registrando, del token
 */
export const resolverOrigenDeGestion = (
  origenPedido?: string | null,
  rolDelActor?: string | null,
): string | null => {
  const pedido = String(origenPedido || '').trim();
  if (pedido) return pedido;
  return esRolDeOficina(rolDelActor) ? ORIGEN_OFICINA : null;
};
