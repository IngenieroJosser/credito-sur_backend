import { objetoDeJson } from './json.util';

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
