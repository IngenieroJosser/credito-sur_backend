import { normalizarNombreCategoria } from './importaciones.service';

/**
 * Al importar artículos, la categoría del archivo se da de alta en el catálogo
 * si no existe. La clave de comparación es lo que evita que la misma categoría,
 * escrita de forma distinta en dos filas, acabe creada dos o tres veces.
 */
describe('Clave de comparación de categorías de artículo', () => {
  it('trata como la misma categoría las variantes de escritura', () => {
    const variantes = [
      'Celulares',
      'celulares',
      'CELULARES',
      '  Celulares  ',
      'Celulares',
    ];
    const claves = new Set(variantes.map(normalizarNombreCategoria));
    expect(claves.size).toBe(1);
  });

  it('ignora los acentos y los espacios de más', () => {
    expect(normalizarNombreCategoria('Electrodomésticos')).toBe(
      normalizarNombreCategoria('electrodomesticos'),
    );
    expect(normalizarNombreCategoria('Línea  blanca')).toBe('linea blanca');
  });

  it('distingue categorías que de verdad son distintas', () => {
    expect(normalizarNombreCategoria('Celulares')).not.toBe(
      normalizarNombreCategoria('Computadores'),
    );
  });

  it('una celda vacía o no textual no crea categoría', () => {
    for (const vacio of ['', '   ', null, undefined, 42]) {
      expect(normalizarNombreCategoria(vacio)).toBe('');
    }
  });
});
