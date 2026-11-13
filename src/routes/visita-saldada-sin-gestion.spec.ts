import { debeQuitarseVisitaSaldadaSinGestion } from './ruta-operational-rules';

/**
 * La regla que quita de la ruta a un cliente que ya no debe nada.
 *
 * ── Por que existe esta prueba ─────────────────────────────────────────────
 *
 * La regla vivia dentro de `getDailyVisits`, un metodo de 1.326 lineas que
 * arma la jornada entera del cobrador. Para probar siete lineas de decision
 * habia que simular Prisma, los pagos del dia, los registros de visita y las
 * reprogramaciones. Sacada al modulo de reglas, se prueba con dos objetos.
 *
 * Y lo que decide es dinero: si una visita saldada se queda, suma a la meta de
 * la ruta un cobro que no existe y el cobrador ve un cliente al que no tiene
 * nada que ir a cobrar.
 */
describe('debeQuitarseVisitaSaldadaSinGestion', () => {
  const pagado = { estado: 'PAGADO', saldoPendiente: 0 };

  it('quita al cliente que pago todo y al que nadie visito', () => {
    expect(
      debeQuitarseVisitaSaldadaSinGestion({ prestamos: [pagado] }, 'PENDIENTE'),
    ).toBe(true);
  });

  it('lo deja si hubo gestion, aunque este saldado', () => {
    /*
     * El cobrador fue, y eso tiene que aparecer en la jornada: si el cliente
     * pago hoy su ultima cuota, la visita queda saldada Y gestionada, y
     * quitarla borraria el pago de la vista del dia.
     */
    for (const gestion of ['PAGADO', 'AUSENTE', 'REPROGRAMADO', 'GESTIONADO']) {
      expect(
        debeQuitarseVisitaSaldadaSinGestion({ prestamos: [pagado] }, gestion),
      ).toBe(false);
    }
  });

  it('no lo quita si le queda saldo, aunque el estado diga PAGADO', () => {
    // Las dos condiciones son necesarias. Un credito marcado como pagado con
    // saldo residual sigue debiendo, y es justo el caso que no se puede
    // esconder.
    expect(
      debeQuitarseVisitaSaldadaSinGestion(
        { prestamos: [{ estado: 'PAGADO', saldoPendiente: 1500 }] },
        'PENDIENTE',
      ),
    ).toBe(false);
  });

  it('no lo quita si el saldo esta en cero pero el credito sigue activo', () => {
    // El otro lado: un saldo en cero con el estado activo es un credito a
    // punto de cerrarse, no uno cerrado. Se queda hasta que lo diga su estado.
    expect(
      debeQuitarseVisitaSaldadaSinGestion(
        { prestamos: [{ estado: 'ACTIVO', saldoPendiente: 0 }] },
        'PENDIENTE',
      ),
    ).toBe(false);
  });

  it('con varios creditos exige que TODOS esten pagados', () => {
    expect(
      debeQuitarseVisitaSaldadaSinGestion(
        {
          prestamos: [pagado, { estado: 'EN_MORA', saldoPendiente: 90000 }],
        },
        'PENDIENTE',
      ),
    ).toBe(false);

    expect(
      debeQuitarseVisitaSaldadaSinGestion(
        { prestamos: [pagado, { estado: 'PAGADO', saldoPendiente: 0 }] },
        'PENDIENTE',
      ),
    ).toBe(true);
  });

  it('y suma los saldos de todos, no mira solo el primero', () => {
    // Dos creditos pagados pero uno con saldo residual: la suma es positiva y
    // no se quita. Leyendo solo el primero se habria quitado.
    expect(
      debeQuitarseVisitaSaldadaSinGestion(
        { prestamos: [pagado, { estado: 'PAGADO', saldoPendiente: 500 }] },
        'PENDIENTE',
      ),
    ).toBe(false);
  });

  it('un saldo negativo cuenta como saldado', () => {
    // Pasa cuando el cliente pago de mas. No debe nada, asi que si no hubo
    // gestion, fuera.
    expect(
      debeQuitarseVisitaSaldadaSinGestion(
        { prestamos: [{ estado: 'PAGADO', saldoPendiente: -200 }] },
        'PENDIENTE',
      ),
    ).toBe(true);
  });

  it('no decide nada sobre una visita sin creditos', () => {
    // Una visita sin creditos es un dato incoherente. Quitarla en silencio lo
    // esconderia; se queda y se ve.
    expect(debeQuitarseVisitaSaldadaSinGestion({ prestamos: [] }, 'PENDIENTE')).toBe(
      false,
    );
    expect(debeQuitarseVisitaSaldadaSinGestion({}, 'PENDIENTE')).toBe(false);
    expect(debeQuitarseVisitaSaldadaSinGestion(null, 'PENDIENTE')).toBe(false);
  });

  it('tolera el estado de gestion ausente o con otra caja', () => {
    // El estado llega del servicio y en el camino puede venir en minusculas o
    // sin venir. Sin estado no se puede afirmar que no hubo gestion.
    expect(
      debeQuitarseVisitaSaldadaSinGestion({ prestamos: [pagado] }, 'pendiente'),
    ).toBe(true);
    expect(
      debeQuitarseVisitaSaldadaSinGestion({ prestamos: [pagado] }, null),
    ).toBe(false);
    expect(
      debeQuitarseVisitaSaldadaSinGestion({ prestamos: [pagado] }, undefined),
    ).toBe(false);
  });

  it('lee el dinero venga como numero o como Decimal de Prisma', () => {
    /*
     * De la base llega como `Decimal` y del servicio como numero. `Number(...)`
     * sirve para los dos, y esto lo fija: un `Decimal` simulado con su
     * `toString` tiene que contar igual.
     */
    const comoDecimal = {
      estado: 'PAGADO',
      saldoPendiente: { toString: () => '0' } as unknown as number,
    };
    expect(
      debeQuitarseVisitaSaldadaSinGestion({ prestamos: [comoDecimal] }, 'PENDIENTE'),
    ).toBe(true);

    const conSaldo = {
      estado: 'PAGADO',
      saldoPendiente: { toString: () => '1200' } as unknown as number,
    };
    expect(
      debeQuitarseVisitaSaldadaSinGestion({ prestamos: [conSaldo] }, 'PENDIENTE'),
    ).toBe(false);
  });
});
