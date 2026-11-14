import { calcularPrecioDeArticulo } from './articulo-precio';

/**
 * El dinero de un credito de articulo.
 *
 * ── El fallo que fija esta prueba ──────────────────────────────────────────
 *
 * La pantalla de credito de articulo deja elegir una cantidad, suma
 * `precio x cantidad` y ensena ese total. El backend, en cambio, recalculaba el
 * monto con `precioProducto.precio`, que es el precio de UNA unidad, y eso es
 * lo que se guardaba y lo que repartia las cuotas.
 *
 * Una venta de tres telefonos quedaba cobrada como uno. No es un descuadre de
 * inventario: es dinero que no se cobra, sobre un articulo que si sale de la
 * tienda.
 */
describe('calcularPrecioDeArticulo', () => {
  const base = {
    unidades: 1,
    precioPlan: 1200000,
    costoUnitario: 800000,
    monto: 1200000,
    cuotaInicial: 0,
    tienePlan: true,
  };

  it('con una unidad cobra el precio del plan', () => {
    expect(calcularPrecioDeArticulo(base)).toEqual({
      precioArticuloTotal: 1200000,
      montoFinanciar: 1200000,
      precioVentaArticulo: 1200000,
      costoArticulo: 800000,
      margenArticulo: 400000,
    });
  });

  it('con tres unidades cobra las tres', () => {
    // El caso del fallo. Antes esto devolvia 1.200.000.
    const r = calcularPrecioDeArticulo({ ...base, unidades: 3 });

    expect(r.precioArticuloTotal).toBe(3600000);
    expect(r.montoFinanciar).toBe(3600000);
  });

  it('y el costo tambien va por las tres, o el margen miente', () => {
    /*
     * Con el costo de una unidad y el precio de tres, el margen salia
     * 3.600.000 − 800.000 = 2.800.000: el triple del real. Y ese margen es el
     * que leen los reportes de utilidad.
     */
    const r = calcularPrecioDeArticulo({ ...base, unidades: 3 });

    expect(r.costoArticulo).toBe(2400000);
    expect(r.margenArticulo).toBe(1200000);
  });

  it('la cuota inicial se resta una sola vez, del total', () => {
    const r = calcularPrecioDeArticulo({
      ...base,
      unidades: 2,
      cuotaInicial: 400000,
    });

    expect(r.precioArticuloTotal).toBe(2400000);
    expect(r.montoFinanciar).toBe(2000000);
  });

  it('una cuota inicial mayor que el precio no deja un monto negativo', () => {
    // Quien llama valida esto aparte y rechaza la peticion; aqui lo que no
    // puede salir es un credito con monto negativo si esa validacion cambia.
    const r = calcularPrecioDeArticulo({ ...base, cuotaInicial: 2000000 });

    expect(r.montoFinanciar).toBe(0);
  });

  it('en venta de contado manda el monto de la pantalla', () => {
    /*
     * Ahi el precio no sale de un plan de financiacion: sale del precio de
     * contado de cada articulo, que el formulario ya sumo por sus cantidades.
     * Volver a multiplicarlo aqui cobraria el cuadrado.
     */
    const r = calcularPrecioDeArticulo({
      ...base,
      esContado: true,
      unidades: 3,
      monto: 2700000,
    });

    expect(r.precioArticuloTotal).toBe(2700000);
    // El costo si va por unidades: el contado tambien saca tres del inventario.
    expect(r.costoArticulo).toBe(2400000);
  });

  it('sin plan de financiacion tambien manda el monto', () => {
    const r = calcularPrecioDeArticulo({
      ...base,
      tienePlan: false,
      unidades: 2,
      monto: 2500000,
    });

    expect(r.precioArticuloTotal).toBe(2500000);
  });

  it('un plan en cero deja el precio en cero, no en el monto de la pantalla', () => {
    // Es el comportamiento que ya habia, y se fija: un plan sin precio es un
    // dato roto, y taparlo con el monto que mando el navegador seria aceptar
    // un precio que el servidor no puede comprobar.
    const r = calcularPrecioDeArticulo({ ...base, precioPlan: 0 });

    expect(r.precioArticuloTotal).toBe(0);
  });

  it('lee el dinero venga como numero, texto o Decimal', () => {
    // De Prisma llega `Decimal` y del cuerpo de la peticion, texto.
    const comoDecimal = {
      toString: () => '1200000',
    } as unknown as number;

    const r = calcularPrecioDeArticulo({
      ...base,
      unidades: 2,
      precioPlan: comoDecimal,
      costoUnitario: '800000',
    });

    expect(r.precioArticuloTotal).toBe(2400000);
    expect(r.costoArticulo).toBe(1600000);
  });

  it('un dato ilegible cuenta como cero y no como NaN', () => {
    // `Number(undefined)` es NaN, y un NaN metido en el monto deja un credito
    // sin cifra que ninguna pantalla sabe pintar.
    const r = calcularPrecioDeArticulo({
      ...base,
      tienePlan: false,
      monto: 'no es un numero',
      costoUnitario: undefined,
    });

    expect(r.precioArticuloTotal).toBe(0);
    expect(r.costoArticulo).toBe(0);
    expect(Number.isNaN(r.margenArticulo)).toBe(false);
  });

  it('las unidades nunca bajan de una', () => {
    // Llegan del cuerpo de la peticion. El DTO ya exige minimo 1; esto es la
    // segunda puerta, para que un 0 no deje una venta en cero pesos.
    for (const unidades of [0, -5, 0.4, NaN]) {
      expect(
        calcularPrecioDeArticulo({ ...base, unidades }).precioArticuloTotal,
      ).toBe(1200000);
    }
  });

  it('trunca una cantidad con decimales en vez de cobrar media unidad', () => {
    expect(
      calcularPrecioDeArticulo({ ...base, unidades: 2.7 }).precioArticuloTotal,
    ).toBe(2400000);
  });
});
