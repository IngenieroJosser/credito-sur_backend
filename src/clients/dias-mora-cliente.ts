import { calcularDiasMoraOperativos } from '../loans/mora.service';

/**
 * Días de mora de un cliente: el mayor atraso entre todos sus créditos.
 *
 * Vive aquí y no dentro del servicio porque lo necesitan dos sitios —el listado
 * de clientes y el PDF de exportación— y porque es la clase de cuenta que, si se
 * copia, acaba dando dos cifras distintas para el mismo cliente en dos
 * pantallas. Estaba escrito solo en el export.
 *
 * La cuenta de días NO se hace aquí: la hace `calcularDiasMoraOperativos`, que
 * es la que usa el proceso de mora. El cálculo que había en el export la repetía
 * a mano y salía distinto en dos cosas:
 *
 *  - Usaba `setHours(0, 0, 0, 0)`, que es medianoche en la zona del servidor, no
 *    en Bogotá. Con el servidor en UTC, una cuota guardada como fecha del día
 *    retrocedía un día y el atraso salía inflado en uno.
 *  - No miraba la frecuencia del crédito, así que a los créditos DIARIOS les
 *    contaba los domingos. Los domingos no hay jornada: un cliente diario no
 *    puede atrasarse un día que nadie salió a cobrar.
 *
 * Y se toma el máximo por crédito en vez de la fecha más antigua de todos: con
 * frecuencias distintas, dos créditos vencidos el mismo día no llevan los mismos
 * días de atraso, así que la fecha más vieja no identifica el peor atraso.
 */

/** Lo que hace falta de cada crédito: su cuota impaga más próxima y su frecuencia. */
export interface PrestamoParaDiasMora {
  frecuenciaPago?: string | null;
  /**
   * La cuota impaga más antigua, como la trae la consulta: filtrada por
   * `estado: { not: 'PAGADA' }`, ordenada por vencimiento y `take: 1`.
   *
   * `undefined` significa que la relación no se pidió, que es distinto de `[]`
   * —no hay ninguna cuota sin pagar—. De esa diferencia depende poder devolver
   * `null` en vez de un cero inventado.
   */
  cuotas?: { fechaVencimiento: Date | string | null }[] | null;
}

/**
 * Devuelve los días de mora, o `null` cuando no se puede saber.
 *
 * El `null` es deliberado y NO es lo mismo que cero. Un cero significa "está al
 * día", y eso se pinta en verde; si se devolviera cero cuando falta el dato, un
 * cliente con tres meses de atraso saldría en verde hasta que alguien abriera su
 * detalle. Quien lo consuma decide cómo mostrar el hueco, pero no puede
 * confundirlo con un cliente al día.
 *
 * Un cliente sin créditos, o con todas sus cuotas pagadas, sí da cero: ahí el
 * cero es verdad.
 */
export function calcularDiasMoraCliente(
  prestamos: PrestamoParaDiasMora[] | null | undefined,
  hoy: Date = new Date(),
): number | null {
  // La relación no vino en la consulta: no se sabe nada, ni para bien ni para mal.
  if (prestamos == null) return null;

  let maximo = 0;
  for (const prestamo of prestamos) {
    // Igual que arriba, pero por crédito: si a este le falta la relación, el
    // total podría estar escondiendo el peor atraso.
    if (prestamo.cuotas == null) return null;

    const fecha = prestamo.cuotas[0]?.fechaVencimiento;
    if (!fecha) continue;

    const dias = calcularDiasMoraOperativos(
      new Date(fecha),
      hoy,
      prestamo.frecuenciaPago,
    );
    if (dias > maximo) maximo = dias;
  }

  return maximo;
}
