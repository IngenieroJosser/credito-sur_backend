/**
 * Que el rechazo diga QUE deshizo, y no solo que se rechazo.
 *
 * ── Lo que pasaba ───────────────────────────────────────────────────────────
 *
 * Rechazar una solicitud desde Revisiones devolvia siempre lo mismo:
 *
 *     { success: true, message: 'Aprobacion rechazada' }
 *
 * Y la pantalla ni siquiera leia ese texto: escribia «Solicitud rechazada» por
 * su cuenta. Pero rechazar un credito nuevo NO es un cambio de estado: revierte
 * el desembolso, devuelve el articulo al inventario, borra las cuotas y oculta
 * el prestamo del listado. Quien lo rechaza no veia nada de eso, y lo que
 * pregunta despues —«¿volvio el televisor al stock?», «¿se devolvio la plata a
 * la caja?»— no tenia respuesta en pantalla.
 *
 * Esto arma la frase con lo que de verdad se deshizo. No adivina: cada parte
 * sale de un dato del propio rechazo, y si no hay dato, no se dice.
 */

export type EfectosDelRechazo = {
  /** Unidades que volvieron al inventario, si el credito era de articulo. */
  unidadesDevueltas?: number | null;
  /** Nombre del articulo, para poder nombrarlo. */
  articulo?: string | null;
  /** Dinero que se devolvio a la caja de origen. */
  montoRevertido?: number | null;
  /** Cuotas que se borraron con el credito. */
  cuotasAnuladas?: number | null;
};

const pesos = (valor: number): string =>
  `$${Math.round(valor).toLocaleString('es-CO')}`;

/**
 * La frase que se le ensena a quien acaba de rechazar.
 *
 * Empieza siempre por el hecho —«Credito rechazado»— y despues enumera lo que
 * se deshizo, en el orden en que a quien revisa le importa: primero el dinero,
 * despues el inventario, despues lo administrativo.
 */
export function mensajeDeRechazoDeCredito(
  efectos: EfectosDelRechazo | null | undefined,
): string {
  const partes: string[] = [];

  const monto = Number(efectos?.montoRevertido || 0);
  if (monto > 0) partes.push(`se devolvieron ${pesos(monto)} a la caja`);

  const unidades = Math.trunc(Number(efectos?.unidadesDevueltas || 0));
  if (unidades > 0) {
    const articulo = String(efectos?.articulo || '').trim();
    const cuerpo =
      unidades === 1
        ? `volvio ${articulo ? `1 ${articulo}` : '1 unidad'} al inventario`
        : `volvieron ${unidades} ${articulo || 'unidades'} al inventario`;
    partes.push(cuerpo);
  }

  const cuotas = Math.trunc(Number(efectos?.cuotasAnuladas || 0));
  if (cuotas > 0) {
    partes.push(
      cuotas === 1 ? 'se anulo 1 cuota' : `se anularon ${cuotas} cuotas`,
    );
  }

  if (partes.length === 0) return 'Credito rechazado';

  // «a, b y c»: se lee como lo diria una persona, no como una lista de log.
  const enumerado =
    partes.length === 1
      ? partes[0]
      : `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;

  return `Credito rechazado: ${enumerado}.`;
}
