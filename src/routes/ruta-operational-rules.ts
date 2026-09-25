/**
 * Forma minima que estas reglas necesitan de una cuota y un prestamo.
 *
 * No se usa el tipo de Prisma a secas por dos motivos: aqui llegan tanto filas
 * de la base como proyecciones armadas a mano (con campos calculados como
 * `estadoActual` o `fechaEfectiva`, que no existen en el modelo), y ademas todo
 * se lee de forma defensiva con `?.`. Por eso los campos van opcionales: el
 * tipo describe lo que se lee, no obliga a traerlo todo.
 */
export interface CuotaOperativa {
  id?: string;
  numeroCuota?: number;
  estado?: string | null;
  estadoActual?: string | null;
  fechaVencimiento?: Date | string | null;
  fechaEfectiva?: Date | string | null;
  fechaVencimientoProrroga?: Date | string | null;
  // Los campos no listados siguen sin tipar: aqui llegan objetos con
  // muchisimos campos mas y tiparlos todos no aporta nada a estas reglas.
  [extra: string]: any;
}

export interface PrestamoOperativo {
  estado?: string | null;
  estadoAprobacion?: string | null;
  estadoEfectoProvisional?: string | null;
  efectoProvisional?: { estado?: string | null } | null;
  efectosProvisionales?: Array<{ estado?: string | null }> | null;
  eliminadoEn?: Date | string | null;
  tipoPrestamo?: string | null;
  tipo?: string | null;
  esContado?: boolean | null;
  cuotas?: CuotaOperativa[] | null;
  // Los campos no listados siguen sin tipar: aqui llegan objetos con
  // muchisimos campos mas y tiparlos todos no aporta nada a estas reglas.
  [extra: string]: any;
}

/** Normaliza a mayusculas sin espacios, tolerando null/undefined. */
export const normalizeUpper = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toUpperCase();

/**
 * Estados de cuota que todavia se pueden cobrar en ruta.
 *
 * PRORROGADA sigue siendo cobrable a proposito: la prorroga mueve la fecha, no
 * cancela la obligacion. PAGADA y CONDONADA quedan fuera porque ya no hay nada
 * que cobrar.
 */
const operativeCuotaStates = new Set([
  'PENDIENTE',
  'PARCIAL',
  'VENCIDA',
  'PRORROGADA',
]);

/**
 * Estados de prestamo que lo sacan de la operacion diaria.
 *
 * Van los dos generos de cada uno (ANULADO/ANULADA, CANCELADO/CANCELADA) porque
 * el dato llega de fuentes distintas (base, importaciones, proyecciones armadas
 * a mano) y no siempre con la misma forma.
 *
 * PERDIDA esta aqui aunque el cliente siga debiendo: es cartera castigada, ya
 * no se sale a cobrarla en la ruta. Sigue provisionada al 100% en contabilidad.
 */
const nonOperativePrestamoStates = new Set([
  'PERDIDA',
  'BORRADOR',
  'ANULADO',
  'ANULADA',
  'CANCELADO',
  'CANCELADA',
  'REVERSADO',
  'REVERTIDO',
]);

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Convierte cualquier fecha a la clave `YYYY-MM-DD` del dia en Bogota.
 *
 * Toda la operacion se compara por clave de dia y no por `Date`: el servidor
 * corre en UTC, asi que una cuota que vence el 5 a las 19:00 en Colombia ya es
 * dia 6 en UTC y se saldria del dia de ruta equivocadamente.
 *
 * Una cadena que ya viene en formato de clave se devuelve intacta, sin pasarla
 * por `new Date`, para no volver a interpretarle zona horaria.
 *
 * Una fecha ausente o invalida devuelve `9999-12-31` en vez de lanzar: el
 * centinela ordena al final y nunca entra en un dia operativo, que es justo lo
 * que se quiere de una cuota sin fecha.
 */
const toBogotaDayKey = (value: unknown): string => {
  if (!value) return '9999-12-31';

  if (typeof value === 'string') {
    const raw = value.trim();

    if (DATE_KEY_RE.test(raw)) {
      return raw;
    }
  }

  const date = new Date(value as any);

  if (Number.isNaN(date.getTime())) {
    return '9999-12-31';
  }

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};

/**
 * Igual que `toBogotaDayKey`, pero el centinela se vuelve cadena vacia: aqui una
 * fecha invalida debe invalidar la consulta, no colarse como una fecha lejana.
 */
const normalizeFechaOperativaKey = (value: unknown): string => {
  const key = toBogotaDayKey(value);
  return key === '9999-12-31' ? '' : key;
};

/**
 * Fecha por la que una cuota se ordena y se compara en la ruta.
 *
 * Una cuota puede tener hasta tres fechas y no todas mandan igual:
 *  - Si esta PRORROGADA, manda la fecha de prorroga. Es el punto del negocio:
 *    prorrogar corre el cobro, y si aqui se siguiera mirando el vencimiento
 *    original la cuota volveria a salir en la ruta el mismo dia.
 *  - Si no, se toma la primera que exista entre `fechaEfectiva`, la prorroga y
 *    el vencimiento original.
 */
export const getCuotaFechaEfectivaKeyRuta = (
  cuota: CuotaOperativa | null | undefined,
): string => {
  const estado = normalizeUpper(cuota?.estadoActual || cuota?.estado);

  const raw =
    estado === 'PRORROGADA' && cuota?.fechaVencimientoProrroga
      ? cuota.fechaVencimientoProrroga
      : cuota?.fechaEfectiva ||
        cuota?.fechaVencimientoProrroga ||
        cuota?.fechaVencimiento;

  return toBogotaDayKey(raw);
};

/**
 * Resuelve en que punto de la revision esta un prestamo.
 *
 * Un prestamo creado por un cobrador o supervisor surte efecto de inmediato
 * (sale la plata, se crean las cuotas) pero queda PENDIENTE de aprobacion. Ese
 * estado intermedio es el "efecto provisional":
 *  - `esProvisional`: ya opera, pero todavia lo tienen que aprobar.
 *  - `esRevertido`: lo rechazaron y sus movimientos ya se deshicieron. Deja de
 *    existir para la operacion.
 *
 * El estado llega por varios caminos segun quien arme el objeto
 * (`estadoEfectoProvisional`, `efectoProvisional.estado`, el primero de
 * `efectosProvisionales`, o las banderas `esProvisional`/`esRevertido`), asi que
 * se leen todos. `esRevertido` se evalua primero porque manda sobre lo demas: un
 * prestamo revertido no es provisional, esta muerto.
 */
export const getEstadoRevisionOperacion = (
  prestamo: PrestamoOperativo | null | undefined,
) => {
  const estadoAprobacion = normalizeUpper(prestamo?.estadoAprobacion);

  const estadoEfectoProvisional = normalizeUpper(
    prestamo?.estadoEfectoProvisional ||
      prestamo?.efectoProvisional?.estado ||
      prestamo?.efectosProvisionales?.[0]?.estado,
  );

  const estado = normalizeUpper(prestamo?.estado);

  const esRevertido =
    estadoEfectoProvisional === 'REVERTIDO' ||
    estadoEfectoProvisional === 'REVERSA_FALLIDA' ||
    Boolean(prestamo?.esRevertido);

  const esProvisional =
    !esRevertido &&
    (estadoAprobacion === 'PENDIENTE' ||
      estado === 'PENDIENTE_APROBACION' ||
      estadoEfectoProvisional === 'PENDIENTE_REVISION' ||
      Boolean(prestamo?.esProvisional));

  return {
    estadoAprobacion: estadoAprobacion || null,
    estadoEfectoProvisional: estadoEfectoProvisional || null,
    esProvisional,
    esRevertido,
    etiquetaRevision: esRevertido
      ? 'Revertido'
      : esProvisional
        ? 'Pendiente de revisión'
        : null,
  };
};

/**
 * Si un prestamo debe aparecer en la operacion de ruta.
 *
 * Quedan fuera, por orden: los borrados, los rechazados, los que estan en un
 * estado no operativo (ver `nonOperativePrestamoStates`), los revertidos tras un
 * rechazo, y las ventas de contado.
 *
 * Las ventas de contado se excluyen porque no generan cobro: se pagaron enteras
 * al momento. Si entraran, inflarian la meta del cobrador con plata que nadie
 * tiene que ir a recoger.
 *
 * Notar que un prestamo provisional SI es operativo: ya surtio efecto y hay que
 * cobrarlo aunque la aprobacion siga pendiente.
 */
export const isPrestamoOperativoRuta = (
  prestamo: PrestamoOperativo | null | undefined,
): boolean => {
  if (!prestamo) return false;
  if (prestamo.eliminadoEn) return false;

  const estado = normalizeUpper(prestamo.estado);
  const estadoAprobacion = normalizeUpper(prestamo.estadoAprobacion);
  const tipoPrestamo = normalizeUpper(prestamo.tipoPrestamo || prestamo.tipo);

  if (estadoAprobacion === 'RECHAZADO') return false;
  if (nonOperativePrestamoStates.has(estado)) return false;
  if (getEstadoRevisionOperacion(prestamo).esRevertido) return false;
  if (prestamo.esContado || tipoPrestamo === 'VENTA_CONTADO') return false;

  return true;
};

/**
 * Si una cuota entra en la jornada de un dia dado.
 *
 * La comparacion es `fechaCuota <= fechaOperativa`, no `===`: la ruta de hoy
 * arrastra lo que vencio antes y sigue sin pagarse. Con igualdad estricta, una
 * cuota atrasada desapareceria de la ruta al dia siguiente de vencer, que es
 * justo cuando hay que ir a cobrarla.
 */
export const isCuotaOperativaParaFechaRuta = (
  cuota: CuotaOperativa | null | undefined,
  fechaOperativaKey: string,
): boolean => {
  const fechaOperativa = normalizeFechaOperativaKey(fechaOperativaKey);

  if (!cuota || !fechaOperativa) return false;

  const estado = normalizeUpper(cuota.estadoActual || cuota.estado);

  if (!operativeCuotaStates.has(estado)) {
    return false;
  }

  const fechaKey = getCuotaFechaEfectivaKeyRuta(cuota);

  return Boolean(fechaKey && fechaKey <= fechaOperativa);
};

/**
 * La cuota que toca cobrar de un prestamo en un dia dado.
 *
 * Se ordena por fecha efectiva y se toma la PRIMERA que siga siendo cobrable a
 * esa fecha, es decir la mas atrasada. El cobro va siempre de la mas vieja a la
 * mas nueva; dejar atras una cuota vencida para cobrar la de hoy descuadraria el
 * orden de imputacion del pago.
 *
 * Se ordena sobre una copia (`[...cuotas]`) para no reordenar el arreglo que
 * viene dentro del prestamo, que quien llama puede seguir usando.
 */
export const resolveCuotaObjetivoOperativa = (
  prestamo: PrestamoOperativo | null | undefined,
  fechaOperativaKey: string,
  // El retorno se declara a proposito. Sin declararlo, TypeScript inferia la
  // union de las dos formas por las que puede salir —la cuota tal como la trae
  // `prestamo.cuotas`, ya tipada por Prisma, y `null`— y en el consumidor esa
  // union impedia leer los campos de `CuotaOperativa`, que es justamente lo que
  // este modulo dice que son estas cuotas. Quien llame recibe la forma laxa, que
  // es la que estas reglas manejan.
): CuotaOperativa | null => {
  const fechaOperativa = normalizeFechaOperativaKey(fechaOperativaKey);

  if (!isPrestamoOperativoRuta(prestamo) || !fechaOperativa) return null;

  const cuotas = Array.isArray(prestamo?.cuotas) ? prestamo.cuotas : [];

  if (cuotas.length === 0) {
    return null;
  }

  return (
    [...cuotas]
      .sort((a, b) =>
        getCuotaFechaEfectivaKeyRuta(a).localeCompare(
          getCuotaFechaEfectivaKeyRuta(b),
        ),
      )
      .find((cuota) => isCuotaOperativaParaFechaRuta(cuota, fechaOperativa)) ||
    null
  );
};

/**
 * Version de `isCuotaOperativaParaFechaRuta` para los objetos de visita, que
 * llegan con formas distintas segun la pantalla.
 *
 * La cuota puede venir ya resuelta (`cuota`, `cuotaObjetivo`, `proximaCuota`) o
 * no venir: en ese ultimo caso se calcula con `resolveCuotaObjetivoOperativa`.
 * El prestamo puede venir anidado o ser el objeto mismo.
 *
 * El orden en que se buscan importa: primero lo que la pantalla ya decidio, y
 * solo al final el calculo, para no contradecir a quien ya eligio la cuota.
 */
export const isObligacionOperativaRuta = (
  obligacion: { prestamo?: any; cuota?: any; cuotaObjetivo?: any },
  fechaOperativaKey: string,
): boolean => {
  const fechaOperativa = normalizeFechaOperativaKey(fechaOperativaKey);
  const prestamo = obligacion?.prestamo ?? obligacion;

  if (!isPrestamoOperativoRuta(prestamo) || !fechaOperativa) {
    return false;
  }

  const cuota =
    obligacion?.cuota ??
    obligacion?.cuotaObjetivo ??
    prestamo?.cuotaObjetivo ??
    prestamo?.proximaCuota ??
    resolveCuotaObjetivoOperativa(prestamo, fechaOperativa);

  return isCuotaOperativaParaFechaRuta(cuota, fechaOperativa);
};
