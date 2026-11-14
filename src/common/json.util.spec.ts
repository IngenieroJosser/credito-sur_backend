import { objetoDeJson, unidadesDeJson } from './json.util';

describe('objetoDeJson', () => {
  it('devuelve el objeto cuando la columna trae un objeto', () => {
    const resumen = { creado: { clientes: 3 } };
    expect(objetoDeJson(resumen)).toBe(resumen);
  });

  it('devuelve {} con null, que es como llega una columna Json vacía', () => {
    expect(objetoDeJson(null)).toEqual({});
    expect(objetoDeJson(undefined)).toEqual({});
  });

  it('devuelve {} con un texto, un número o un booleano', () => {
    // Una columna `Json` admite todo eso, y leerle una propiedad daba undefined
    // en silencio.
    expect(objetoDeJson('texto')).toEqual({});
    expect(objetoDeJson(42)).toEqual({});
    expect(objetoDeJson(true)).toEqual({});
  });

  it('devuelve {} con una lista, que no se lee por nombre de propiedad', () => {
    expect(objetoDeJson([1, 2, 3])).toEqual({});
  });
});

/**
 * Las unidades de inventario de un prestamo de articulo.
 *
 * Deciden cuanto stock sale al aprobar y cuanto vuelve al rechazar, y el valor
 * llega unas veces de la columna `Int` del prestamo y otras del `rollbackData`,
 * que es `Json`. El atajo de cada sitio, `Number(valor) || 1`, dejaba pasar un
 * `NaN` al `increment` de Prisma.
 */
describe('unidadesDeJson', () => {
  it('devuelve el numero cuando lo hay', () => {
    expect(unidadesDeJson(3)).toBe(3);
    expect(unidadesDeJson('3')).toBe(3);
  });

  it('una unidad cuando no hay dato', () => {
    // Es el caso de las filas anteriores a la columna y de los `rollbackData`
    // viejos: describen una venta de una unidad, que es lo que el DEFAULT dice.
    expect(unidadesDeJson(undefined)).toBe(1);
    expect(unidadesDeJson(null)).toBe(1);
  });

  it('una unidad con un objeto, una lista o un texto que no es numero', () => {
    // `Number({})` es NaN, y un NaN en `stock: { increment: NaN }` deja el
    // inventario del producto inservible.
    expect(unidadesDeJson({})).toBe(1);
    expect(unidadesDeJson([2])).toBe(1);
    expect(unidadesDeJson('tres')).toBe(1);
  });

  it('nunca menos de una, ni fraccionada', () => {
    // Un cero haria una devolucion de stock que no devuelve nada, en silencio.
    expect(unidadesDeJson(0)).toBe(1);
    expect(unidadesDeJson(-4)).toBe(1);
    expect(unidadesDeJson(2.9)).toBe(2);
  });
});
