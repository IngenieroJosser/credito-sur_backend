import { Prisma } from '@prisma/client';

/**
 * El dinero de un credito de articulo: precio, monto a financiar y margen.
 *
 * ── Por que esta aqui y no dentro de `createLoan` ───────────────────────────
 *
 * Eran cinco lineas en medio de un metodo de trescientas, y decidian lo que se
 * cobra. El fallo que tenian no se veia leyendo la pantalla ni leyendo el
 * backend por separado: el formulario suma `precio x cantidad` y ensena ese
 * total, pero aqui el monto se RECALCULA con `precioProducto.precio`, que es el
 * precio de UNA unidad. Una venta de tres telefonos quedaba cobrada como una, y
 * las cuotas se repartian sobre ese precio.
 *
 * Sacado aqui se prueba con numeros, sin simular Prisma ni la transaccion.
 */

type DineroDeEntrada = Prisma.Decimal | number | string | null | undefined;

const aNumero = (valor: DineroDeEntrada): number => {
  if (valor === null || valor === undefined) return 0;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
};

export type EntradaPrecioArticulo = {
  /** Unidades que se venden. Nunca menos de una. */
  unidades: number;
  /** Precio del plan de financiacion, POR UNIDAD. */
  precioPlan: DineroDeEntrada;
  /** Costo del producto, POR UNIDAD. */
  costoUnitario: DineroDeEntrada;
  /** Lo que la pantalla mando como monto. Manda en venta de contado. */
  monto: DineroDeEntrada;
  cuotaInicial: DineroDeEntrada;
  esContado?: boolean;
  /** Falso cuando no hay plan de financiacion que aplicar. */
  tienePlan: boolean;
};

export type PrecioArticulo = {
  /** Precio total de la venta, ya por las unidades. */
  precioArticuloTotal: number;
  /** Lo que queda a credito despues de la cuota inicial. */
  montoFinanciar: number;
  precioVentaArticulo: number;
  costoArticulo: number;
  margenArticulo: number;
};

export const calcularPrecioDeArticulo = (
  entrada: EntradaPrecioArticulo,
): PrecioArticulo => {
  const unidades = Math.max(1, Math.trunc(Number(entrada.unidades) || 1));
  const cuotaInicial = aNumero(entrada.cuotaInicial);

  /*
   * En venta de contado manda el monto de la pantalla: ahi el precio no sale
   * de un plan de financiacion, sino del precio de contado de cada articulo,
   * que el formulario ya sumo por sus cantidades.
   *
   * Con plan, el precio es el del plan POR las unidades.
   */
  const precioPlan = aNumero(entrada.precioPlan);
  const precioArticuloTotal =
    entrada.esContado || !entrada.tienePlan
      ? aNumero(entrada.monto)
      : precioPlan > 0
        ? precioPlan * unidades
        : 0;

  const costoArticulo = aNumero(entrada.costoUnitario) * unidades;

  return {
    precioArticuloTotal,
    montoFinanciar: Math.max(0, precioArticuloTotal - cuotaInicial),
    precioVentaArticulo: precioArticuloTotal,
    costoArticulo,
    // El margen se reconoce una sola vez, al crear el credito, y no toca caja:
    // se guarda para poder calcular la utilidad operativa en reportes.
    margenArticulo: precioArticuloTotal - costoArticulo,
  };
};
