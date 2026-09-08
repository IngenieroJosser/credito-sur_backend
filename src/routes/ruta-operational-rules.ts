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

export const normalizeUpper = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toUpperCase();

const operativeCuotaStates = new Set([
  'PENDIENTE',
  'PARCIAL',
  'VENCIDA',
  'PRORROGADA',
]);

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

const normalizeFechaOperativaKey = (value: unknown): string => {
  const key = toBogotaDayKey(value);
  return key === '9999-12-31' ? '' : key;
};

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

export const resolveCuotaObjetivoOperativa = (
  prestamo: PrestamoOperativo | null | undefined,
  fechaOperativaKey: string,
) => {
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
