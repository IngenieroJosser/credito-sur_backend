/**
 * Réplica exacta de la matemática de créditos del sistema, para que un crédito
 * importado quede con las mismas cifras que si se hubiera creado desde el modal.
 *
 * Fuente de verdad: `CrearCreditoModal.calcularPrestamoPreview` (frontend) y
 * `LoansService.calculateInterestAndCuotas` / `createLoan` (backend).
 *
 * ── Los dos métodos que ofrece el negocio ────────────────────────────────────
 *  - "Interés Simple" → INTERES_SIMPLE: la tasa se aplica por cada mes de plazo.
 *  - "Amortización"   → INTERES_PLANO: la tasa se aplica una sola vez sobre el
 *    capital. Es interés plano; conserva el nombre "Amortización" porque así lo
 *    llama la empresa, no porque sea una amortización francesa.
 *
 * `FRANCESA` sigue en el enum de Prisma por créditos antiguos, pero el sistema
 * ya no la ofrece y la importación no la usa.
 *
 * ── El plazo en meses ────────────────────────────────────────────────────────
 * El modal no pide el plazo: lo deriva de la cantidad de cuotas y la frecuencia,
 * y puede quedar fraccionario (45 cuotas diarias = 1,5 meses). Ese valor
 * fraccionario es el que entra al cálculo de interés simple, aunque en la base
 * se guarde redondeado, porque la columna `plazoMeses` es entera.
 */

export type TipoAmortizacionImportacion = 'INTERES_SIMPLE' | 'INTERES_PLANO';

/** Método que se asume cuando la columna se deja vacía (igual que el modal). */
export const TIPO_AMORTIZACION_POR_DEFECTO: TipoAmortizacionImportacion =
  'INTERES_SIMPLE';

/** Etiquetas aceptadas en el Excel, tal como se ofrecen en el modal. */
export const ETIQUETA_INTERES_SIMPLE = 'Interés simple';
export const ETIQUETA_AMORTIZACION = 'Amortización';

/**
 * Cuotas que caben en un mes según la frecuencia.
 * Son los factores del modal y de `createLoan`; no los del formulario antiguo
 * de página completa, que usa 4,33 para semanal.
 */
export const CUOTAS_POR_MES: Record<string, number> = {
  DIARIO: 30,
  SEMANAL: 4,
  QUINCENAL: 2,
  MENSUAL: 1,
};

export interface CuotaCalculada {
  numeroCuota: number;
  monto: number;
  montoCapital: number;
  montoInteres: number;
}

function normalizar(valor: unknown): string {
  return String(valor ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Traduce la etiqueta escrita en el Excel al método correspondiente.
 * Devuelve `null` si el texto no corresponde a ninguno de los dos.
 */
export function mapTipoAmortizacionExcel(
  valor: unknown,
): TipoAmortizacionImportacion | null {
  const texto = normalizar(valor);

  if (texto === 'INTERES SIMPLE' || texto === 'SIMPLE') {
    return 'INTERES_SIMPLE';
  }

  if (
    texto === 'AMORTIZACION' ||
    texto === 'AMORTIZACION FIJA' ||
    texto === 'AMORTIZABLE' ||
    texto === 'INTERES PLANO' ||
    texto === 'PLANO'
  ) {
    return 'INTERES_PLANO';
  }

  return null;
}

/** Etiqueta legible del método, para exportaciones y plantillas. */
export function etiquetaTipoAmortizacion(valor: unknown): string {
  const texto = normalizar(valor);
  return mapTipoAmortizacionExcel(valor) === 'INTERES_PLANO' ||
    texto === 'FRANCESA'
    ? ETIQUETA_AMORTIZACION
    : ETIQUETA_INTERES_SIMPLE;
}

/**
 * Plazo en meses derivado de la cantidad de cuotas y la frecuencia, igual que
 * hace el modal. El resultado puede ser fraccionario a propósito.
 */
export function derivarPlazoMeses(
  cantidadCuotas: number,
  frecuenciaPago: string,
): number {
  const factor = CUOTAS_POR_MES[normalizar(frecuenciaPago)];
  if (!factor || !(cantidadCuotas > 0)) return 0;
  return cantidadCuotas / factor;
}

/** Cantidad de cuotas derivada del plazo, para migraciones documentadas en meses. */
export function derivarCantidadCuotas(
  plazoMeses: number,
  frecuenciaPago: string,
): number {
  const factor = CUOTAS_POR_MES[normalizar(frecuenciaPago)];
  if (!factor || !(plazoMeses > 0)) return 0;
  return Math.ceil(plazoMeses * factor);
}

/** Plazo tal como se guarda en la base: la columna `plazoMeses` es entera. */
export function plazoMesesPersistido(plazoMeses: number): number {
  return Math.max(1, Math.round(plazoMeses || 0));
}

/**
 * Interés total del crédito.
 * Réplica de `calculateInterestAndCuotas`: el plazo entra fraccionario.
 */
export function calcularInteresTotal(
  tipoAmortizacion: TipoAmortizacionImportacion,
  monto: number,
  tasaInteres: number,
  plazoMeses: number,
): number {
  if (!(monto > 0) || !(tasaInteres > 0)) return 0;

  if (tipoAmortizacion === 'INTERES_PLANO') {
    // Amortización: la tasa se aplica una sola vez sobre el capital.
    // Se TRUNCA (no se redondea): en un préstamo nunca se cobra al cliente más
    // interés del que corresponde, y queda coherente con el reparto de cuotas,
    // que también trunca. Solo cambia el resultado cuando hay decimales.
    return Math.trunc(monto * (tasaInteres / 100));
  }

  // Interés simple: la tasa se aplica por cada mes de plazo. Se trunca igual.
  const mesesInteres = Math.max(1, plazoMeses);
  return Math.trunc((monto * tasaInteres * mesesInteres) / 100);
}

/**
 * Reparto del crédito en cuotas.
 *
 * Réplica exacta de `LoansService.calculateInterestAndCuotas`, incluidos los
 * `Math.floor` de las bases y el residuo que absorbe la última cuota. Se copia
 * el redondeo tal cual: usar `Math.round` en lugar de `Math.floor` produce
 * diferencias de pesos entre un crédito importado y uno creado a mano.
 */
export function construirTablaCuotas(
  tipoAmortizacion: TipoAmortizacionImportacion,
  monto: number,
  interesTotal: number,
  cantidadCuotas: number,
): CuotaCalculada[] {
  if (!(cantidadCuotas > 0) || !(monto > 0)) return [];

  if (tipoAmortizacion === 'INTERES_PLANO') {
    const totalFinanciado = monto + interesTotal;
    const cuotaBase = Math.floor(totalFinanciado / cantidadCuotas);
    const interesBase = Math.floor(interesTotal / cantidadCuotas);

    let capitalRestante = monto;
    let interesRestante = interesTotal;

    return Array.from({ length: cantidadCuotas }, (_, i) => {
      const esUltima = i === cantidadCuotas - 1;

      const montoCuota = esUltima
        ? capitalRestante + interesRestante
        : cuotaBase;
      const montoInteres = esUltima
        ? interesRestante
        : Math.min(interesBase, interesRestante);
      const montoCapital = Math.max(0, montoCuota - montoInteres);

      capitalRestante = Math.max(0, capitalRestante - montoCapital);
      interesRestante = Math.max(0, interesRestante - montoInteres);

      return {
        numeroCuota: i + 1,
        monto: montoCuota,
        montoCapital,
        montoInteres,
      };
    });
  }

  // Interés simple
  const baseCapital = Math.floor(monto / cantidadCuotas);
  const baseInteres = Math.floor(interesTotal / cantidadCuotas);

  let capitalRestante = monto;
  let interesRestante = interesTotal;

  return Array.from({ length: cantidadCuotas }, (_, i) => {
    const esUltima = i === cantidadCuotas - 1;

    const montoCapital = esUltima ? capitalRestante : baseCapital;
    const montoInteres = esUltima ? interesRestante : baseInteres;

    capitalRestante = Math.max(0, capitalRestante - montoCapital);
    interesRestante = Math.max(0, interesRestante - montoInteres);

    return {
      numeroCuota: i + 1,
      monto: montoCapital + montoInteres,
      montoCapital,
      montoInteres,
    };
  });
}
