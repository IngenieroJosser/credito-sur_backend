import { nombreDeArticuloConCantidad } from './contrato-credito-articulo.template';

/**
 * La linea del articulo en el contrato.
 *
 * El contrato es el papel que firma el cliente diciendo lo que recibe. Desde
 * que la cantidad se cobra de verdad —el monto es `precio x cantidad`— una
 * linea que diga «Televisor» en una venta de tres no describe la entrega.
 */
describe('nombreDeArticuloConCantidad', () => {
  it('con una unidad escribe el nombre a secas', () => {
    // Es el caso normal, y es como estaba: no se añade ruido a lo de siempre.
    expect(
      nombreDeArticuloConCantidad({
        articulo: 'Televisor',
        cantidadArticulo: 1,
      }),
    ).toBe('Televisor');
  });

  it('con varias, la cantidad va delante', () => {
    expect(
      nombreDeArticuloConCantidad({
        articulo: 'Televisor',
        cantidadArticulo: 3,
      }),
    ).toBe('3 x Televisor');
  });

  it('sin cantidad se comporta como una unidad', () => {
    // Los prestamos anteriores a la columna: su DEFAULT es 1.
    expect(nombreDeArticuloConCantidad({ articulo: 'Nevera' })).toBe('Nevera');
  });

  it('un dato roto no escribe NaN en un contrato', () => {
    // `Number(undefined)` es NaN, y esto se imprime en un papel que se firma.
    expect(
      nombreDeArticuloConCantidad({
        articulo: 'Nevera',
        cantidadArticulo: NaN,
      }),
    ).toBe('Nevera');
  });

  it('sin nombre deja la raya para llenar a mano, como antes', () => {
    const linea = nombreDeArticuloConCantidad({});
    expect(linea).toMatch(/^_+$/);

    // Y con cantidad, la raya sigue siendo una raya con su numero delante.
    expect(nombreDeArticuloConCantidad({ cantidadArticulo: 2 })).toMatch(
      /^2 x _+$/,
    );
  });
});
