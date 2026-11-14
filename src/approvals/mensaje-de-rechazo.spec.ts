import { mensajeDeRechazoDeCredito } from './mensaje-de-rechazo';

/**
 * El rechazo de un credito dice que deshizo.
 *
 * Antes devolvia siempre «Aprobacion rechazada», y la pantalla ni leia ese
 * texto: escribia «Solicitud rechazada» por su cuenta. Pero rechazar un credito
 * nuevo revierte el desembolso, devuelve el articulo al inventario y anula las
 * cuotas. Quien revisaba no tenia como saber si el televisor habia vuelto al
 * stock.
 */
describe('mensajeDeRechazoDeCredito', () => {
  it('nombra el dinero, el articulo y las cuotas', () => {
    expect(
      mensajeDeRechazoDeCredito({
        montoRevertido: 1200000,
        unidadesDevueltas: 1,
        articulo: 'Televisor',
        cuotasAnuladas: 12,
      }),
    ).toBe(
      'Credito rechazado: se devolvieron $1.200.000 a la caja, volvio 1 Televisor al inventario y se anularon 12 cuotas.',
    );
  });

  it('con varias unidades lo dice en plural', () => {
    // La cantidad importa desde que el inventario se descuenta de verdad: si
    // salieron tres, tienen que volver tres y verse que volvieron tres.
    const mensaje = mensajeDeRechazoDeCredito({
      unidadesDevueltas: 3,
      articulo: 'Televisores',
    });

    expect(mensaje).toContain('volvieron 3 Televisores al inventario');
  });

  it('sin nombre de articulo dice «unidades», no una frase coja', () => {
    expect(mensajeDeRechazoDeCredito({ unidadesDevueltas: 2 })).toContain(
      'volvieron 2 unidades al inventario',
    );
    expect(mensajeDeRechazoDeCredito({ unidadesDevueltas: 1 })).toContain(
      'volvio 1 unidad al inventario',
    );
  });

  it('un credito de efectivo no habla de inventario', () => {
    // No hay articulo que devolver, y mencionarlo en cero seria ruido.
    const mensaje = mensajeDeRechazoDeCredito({
      montoRevertido: 500000,
      cuotasAnuladas: 1,
    });

    expect(mensaje).not.toContain('inventario');
    expect(mensaje).toBe(
      'Credito rechazado: se devolvieron $500.000 a la caja y se anulo 1 cuota.',
    );
  });

  it('sin efectos que contar, no se inventa ninguno', () => {
    /*
     * Pasa cuando el credito no habia desembolsado nada todavia. Decir «se
     * devolvieron $0» seria peor que no decir nada: suena a que hubo un
     * movimiento.
     */
    expect(mensajeDeRechazoDeCredito({})).toBe('Credito rechazado');
    expect(mensajeDeRechazoDeCredito(null)).toBe('Credito rechazado');
    expect(
      mensajeDeRechazoDeCredito({
        montoRevertido: 0,
        unidadesDevueltas: 0,
        cuotasAnuladas: 0,
      }),
    ).toBe('Credito rechazado');
  });

  it('un dato roto no escribe NaN en la pantalla', () => {
    // Los tres valores salen de una columna `Json`; `Number(undefined)` es NaN
    // y acabaria impreso en un aviso.
    const mensaje = mensajeDeRechazoDeCredito({
      montoRevertido: NaN,
      unidadesDevueltas: NaN,
      cuotasAnuladas: NaN,
    });

    expect(mensaje).toBe('Credito rechazado');
    expect(mensaje).not.toContain('NaN');
  });

  it('una sola cosa deshecha no lleva «y» colgando', () => {
    expect(mensajeDeRechazoDeCredito({ cuotasAnuladas: 4 })).toBe(
      'Credito rechazado: se anularon 4 cuotas.',
    );
  });
});
