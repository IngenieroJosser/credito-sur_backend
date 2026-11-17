import { avisoDeClientesSinRuta } from './aviso-clientes-sin-ruta';

/**
 * Al importar, un cliente que se queda sin ruta tiene que decirse.
 *
 * ── Lo que pasaba ──────────────────────────────────────────────────────────
 *
 * `confirmarClientesCreditos` resolvia la ruta de cada cliente por el codigo
 * que trae el archivo, y tenia dos salidas en silencio:
 *
 *     if (!asignacion.rutaCodigo) continue;   // la fila no trae ruta
 *     if (!ruta) continue;                    // el codigo no existe
 *
 * Los creditos de esos clientes se crean despues SIN `rutaId`, porque la ruta
 * solo se le pone a los que quedaron en `clientesConRuta`. Y un credito sin
 * ruta no entra en la jornada de nadie: existe, devenga mora y nadie va a
 * cobrarlo.
 *
 * Medido en la base de desarrollo: 25 de 60 creditos vivos sin ruta, casi
 * todos de articulo, y CINCO clientes con 8, 4, 4, 3 y 3 creditos cada uno sin
 * una sola ruta, la mayoria ya EN_MORA. Nadie se entero al importarlos.
 *
 * ── Que se exige ───────────────────────────────────────────────────────────
 *
 * No que la importacion falle —los datos del cliente sirven igual, y cortar un
 * lote entero por una fila es peor— sino que lo DIGA, con el motivo y con los
 * codigos que no encontro, que es lo que hace falta para arreglarlo.
 *
 * Esta prueba trabaja sobre el texto del aviso —el de verdad, importado de
 * `aviso-clientes-sin-ruta.ts`— porque es lo unico que la
 * persona que importa llega a ver.
 */

describe('el aviso de los clientes que quedan sin ruta al importar', () => {
  it('no dice nada cuando todos quedaron con ruta', () => {
    // Lo normal no necesita aviso: un informe que avisa siempre deja de leerse.
    expect(avisoDeClientesSinRuta([], [])).toBeNull();
  });

  it('cuenta los que se quedaron sin ruta', () => {
    const aviso = avisoDeClientesSinRuta(['c1', 'c2'], ['R-09']);

    expect(aviso).toContain('3 cliente(s) quedaron SIN RUTA');
  });

  it('separa los dos motivos, porque se arreglan distinto', () => {
    /*
     * La fila sin codigo se corrige en el archivo; el codigo desconocido, o
     * creando la ruta o corrigiendo el codigo. Juntarlos en «no se pudo» deja
     * a quien importa sin saber por donde empezar.
     */
    const aviso = avisoDeClientesSinRuta(['c1'], ['R-09'])!;

    expect(aviso).toContain('1 porque el archivo no trae codigo de ruta');
    expect(aviso).toContain('1 porque la ruta no existe');
  });

  it('nombra los codigos que no encontro', () => {
    // Es lo que se busca a mano cuando el informe solo dice que algo fallo.
    const aviso = avisoDeClientesSinRuta([], ['R-09', 'R-12'])!;

    expect(aviso).toContain('R-09, R-12');
  });

  it('no repite un codigo que fallo en varias filas', () => {
    // Veinte clientes de la misma ruta mal escrita no son veinte problemas.
    const aviso = avisoDeClientesSinRuta([], ['R-09', 'R-09', 'R-09'])!;

    expect(aviso).toContain('3 porque la ruta no existe (R-09)');
    expect(aviso.match(/R-09/g)).toHaveLength(1);
  });

  it('dice que hacer, no solo que paso', () => {
    const aviso = avisoDeClientesSinRuta(['c1'], [])!;

    expect(aviso).toContain('Asignalos a una ruta');
    expect(aviso).toContain('se puedan cobrar');
  });

  it('y dice la consecuencia, que es lo que hace que se atienda', () => {
    // «Quedaron sin ruta» no mueve a nadie; «no entraran en la jornada de
    // nadie» si.
    const aviso = avisoDeClientesSinRuta(['c1'], [])!;

    expect(aviso).toContain('no entraran en la jornada de nadie');
  });
});
