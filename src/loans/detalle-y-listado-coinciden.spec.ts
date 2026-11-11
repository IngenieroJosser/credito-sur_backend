/**
 * Que la misma cifra se llame igual por los dos caminos.
 *
 * El detalle de un crédito y el listado respondían con nombres distintos para
 * el mismo dinero. Medido pidiendo los dos endpoints con la sesión del
 * superadministrador:
 *
 *     concepto           GET /loans/:id    GET /loans
 *     ────────────────────────────────────────────────────
 *     prestado           monto             montoPrestado
 *     total a pagar      (no venía)        montoTotal
 *     saldo pendiente    saldoPendiente    montoPendiente
 *     ya pagado          totalPagado       montoPagado
 *
 * Leer el nombre del otro endpoint no da error: da `undefined`, y el
 * `|| 0` con el que las pantallas se cubren lo convierte en «$ 0», que se lee
 * como «no debe nada». En el frontend hay 106 usos de `saldoPendiente` y 32 de
 * `montoPendiente`, y ocho pantallas usan los dos a la vez.
 *
 * Esta prueba vigila las dos mitades: que el detalle traiga los nombres del
 * listado, y —lo que de verdad importa— que la cuenta detrás de cada alias sea
 * LA MISMA que hace el listado, no una parecida. `montoPendiente` no es
 * `saldoPendiente` a secas: se trunca y se pone en cero cuando todas las cuotas
 * están pagadas, para que un residuo de redondeo no deje una deuda fantasma.
 */

import { EstadoCuota, EstadoPrestamo } from '@prisma/client';
import { LoansService } from './loans.service';
import { comoPrisma, type DobleDePrisma } from '../common/testing/dobles';

describe('el detalle de un crédito trae los nombres del listado', () => {
  /**
   * Un servicio con lo justo para que `getLoanById` llegue a su `return`.
   *
   * No se usa el módulo de Nest completo a propósito: lo que se mide es la
   * forma de la respuesta, y montar el servicio entero obligaría a declarar
   * una docena de dependencias que este camino no toca.
   */
  const servicioCon = (prestamo: Record<string, unknown>) => {
    const prisma: DobleDePrisma = {
      prestamo: {
        findFirst: jest.fn().mockResolvedValue(prestamo),
        findUnique: jest.fn().mockResolvedValue(prestamo),
      },
      registroVisita: { findMany: jest.fn().mockResolvedValue([]) },
      asignacionRuta: { findFirst: jest.fn().mockResolvedValue(null) },
    };

    const servicio = Object.create(LoansService.prototype) as LoansService;
    Object.assign(servicio, {
      prisma: comoPrisma(prisma),
      logger: { error: jest.fn(), log: jest.fn(), warn: jest.fn() },
    });
    return servicio;
  };

  const cuota = (estado: EstadoCuota) => ({
    id: `cuota-${estado}-${Math.random()}`,
    estado,
    monto: 180000,
    numeroCuota: 1,
    fechaVencimiento: new Date('2026-12-01T00:00:00-05:00'),
    montoInteresMora: 0,
  });

  const PRESTAMO_BASE = {
    id: 'prestamo-1',
    numeroPrestamo: 'PRES-000001',
    estado: EstadoPrestamo.ACTIVO,
    monto: 600000,
    interesTotal: 120000,
    saldoPendiente: 400000,
    totalPagado: 320000,
    cuotas: [cuota(EstadoCuota.PAGADA), cuota(EstadoCuota.PENDIENTE)],
  };

  it('añade los cuatro nombres del listado sin quitar los del detalle', async () => {
    const servicio = servicioCon({ ...PRESTAMO_BASE });

    const detalle = (await servicio.getLoanById('prestamo-1')) as Record<
      string,
      unknown
    >;

    // Los nuevos.
    expect(detalle.montoPrestado).toBe(600000);
    expect(detalle.montoTotal).toBe(720000);
    expect(detalle.montoPendiente).toBe(400000);
    expect(detalle.montoPagado).toBe(320000);

    // Y los de antes siguen: quitarlos habría dejado en blanco de golpe las
    // 106 lecturas de `saldoPendiente` que hay en el frontend.
    expect(detalle.saldoPendiente).toBe(400000);
    expect(detalle.totalPagado).toBe(320000);
    expect(detalle.monto).toBe(600000);
  });

  it('montoTotal es el prestado MÁS el interés, como en el listado', async () => {
    const servicio = servicioCon({
      ...PRESTAMO_BASE,
      monto: 1000000,
      interesTotal: 200000,
    });

    const detalle = (await servicio.getLoanById('prestamo-1')) as Record<
      string,
      unknown
    >;

    expect(detalle.montoTotal).toBe(1200000);
  });

  describe('montoPendiente usa la MISMA regla que el listado', () => {
    it('con todas las cuotas pagadas da cero, aunque quede residuo', async () => {
      // Es el caso para el que existe la regla: un residuo de redondeo dejaba
      // una deuda fantasma de unos pesos en un crédito ya pagado. Copiar
      // `saldoPendiente` a secas habría devuelto ese residuo y la misma cifra
      // habría salido distinta en el detalle y en el listado.
      const servicio = servicioCon({
        ...PRESTAMO_BASE,
        saldoPendiente: 3,
        cuotas: [cuota(EstadoCuota.PAGADA), cuota(EstadoCuota.PAGADA)],
      });

      const detalle = (await servicio.getLoanById('prestamo-1')) as Record<
        string,
        unknown
      >;

      expect(detalle.montoPendiente).toBe(0);
      // El saldo crudo NO se toca: quien quiera el residuo lo tiene.
      expect(detalle.saldoPendiente).toBe(3);
    });

    it('con cuotas sin pagar trunca el saldo, no lo redondea', async () => {
      // Truncar y no redondear es la regla del sistema para el dinero: nunca
      // se inventa un peso que nadie entregó.
      const servicio = servicioCon({
        ...PRESTAMO_BASE,
        saldoPendiente: 400000.99,
      });

      const detalle = (await servicio.getLoanById('prestamo-1')) as Record<
        string,
        unknown
      >;

      expect(detalle.montoPendiente).toBe(400000);
    });

    it('sin cuotas en la respuesta no inventa un cero', async () => {
      // Un crédito sin cuotas cargadas no es un crédito pagado. Si la
      // condición fuera solo `cuotasPagadas === cuotasTotales`, cero igual a
      // cero daría «pagado» y el saldo saldría en 0: un cliente con deuda
      // pintado como al día.
      const servicio = servicioCon({
        ...PRESTAMO_BASE,
        saldoPendiente: 250000,
        cuotas: [],
      });

      const detalle = (await servicio.getLoanById('prestamo-1')) as Record<
        string,
        unknown
      >;

      expect(detalle.montoPendiente).toBe(250000);
    });
  });

  it('cuenta las cuotas pagadas y las totales', async () => {
    const servicio = servicioCon({
      ...PRESTAMO_BASE,
      cuotas: [
        cuota(EstadoCuota.PAGADA),
        cuota(EstadoCuota.PAGADA),
        cuota(EstadoCuota.PENDIENTE),
        cuota(EstadoCuota.VENCIDA),
      ],
    });

    const detalle = (await servicio.getLoanById('prestamo-1')) as Record<
      string,
      unknown
    >;

    expect(detalle.cuotasTotales).toBe(4);
    expect(detalle.cuotasPagadas).toBe(2);
  });
});
