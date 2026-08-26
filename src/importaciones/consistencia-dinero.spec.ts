import { FrecuenciaPago, TipoAmortizacion } from '@prisma/client';
import { LoansService } from '../loans/loans.service';
import {
  calcularInteresTotal,
  construirTablaCuotas,
  derivarPlazoMeses,
  TipoAmortizacionImportacion,
} from './interes-credito';
import {
  construirPlanCuotas,
  aplicarAvanceHistorico,
} from './avance-historico';
import { pesos } from '../common/dinero.util';
import { LedgerService } from '../accounting/ledger.service';

/**
 * Que ningún peso se pierda ni se invente.
 *
 * No comprueba casos sueltos sino propiedades que tienen que cumplirse siempre,
 * sobre una malla amplia de montos, tasas, plazos y frecuencias. Un crédito mal
 * repartido no se nota en una cifra bonita: se nota cuando el cliente termina
 * de pagar y queda debiendo tres pesos, o cuando la caja no cuadra al cierre.
 *
 * Las combinaciones incluyen a propósito montos que no dividen exacto, tasas
 * con decimales y plazos fraccionarios, que son donde aparecen los residuos.
 */

const MONTOS = [
  1, // el mínimo que existe
  50_000,
  500_000,
  777_777, // no divide exacto entre casi nada
  1_234_567,
  14_227_937, // uno de los que delataron el orden de operaciones
  50_000_000,
];

const TASAS = [0, 2, 5, 7.5, 10, 15, 20, 33.33];

const FRECUENCIAS: FrecuenciaPago[] = [
  FrecuenciaPago.DIARIO,
  FrecuenciaPago.SEMANAL,
  FrecuenciaPago.QUINCENAL,
  FrecuenciaPago.MENSUAL,
];

const CANTIDADES_CUOTA = [1, 4, 6, 12, 13, 30, 45, 60];

const METODOS: TipoAmortizacionImportacion[] = [
  'INTERES_SIMPLE',
  'INTERES_PLANO',
];

interface Caso {
  metodo: TipoAmortizacionImportacion;
  monto: number;
  tasa: number;
  cuotas: number;
  frecuencia: FrecuenciaPago;
}

/** Todas las combinaciones: es una malla, no una muestra. */
const CASOS: Caso[] = [];
for (const metodo of METODOS) {
  for (const monto of MONTOS) {
    for (const tasa of TASAS) {
      for (const cuotas of CANTIDADES_CUOTA) {
        for (const frecuencia of FRECUENCIAS) {
          CASOS.push({ metodo, monto, tasa, cuotas, frecuencia });
        }
      }
    }
  }
}

const etiqueta = (c: Caso) =>
  `${c.metodo} · ${c.monto} · ${c.tasa}% · ${c.cuotas} ${c.frecuencia}`;

const planDe = (c: Caso) => {
  const plazoMeses = derivarPlazoMeses(c.cuotas, c.frecuencia);
  const interesTotal = calcularInteresTotal(
    c.metodo,
    c.monto,
    c.tasa,
    plazoMeses,
  );
  const tabla = construirTablaCuotas(c.metodo, c.monto, interesTotal, c.cuotas);
  return { plazoMeses, interesTotal, tabla };
};

describe('Ningún peso se pierde al repartir las cuotas', () => {
  it(`la malla cubre ${CASOS.length} combinaciones`, () => {
    // Si alguien recorta la malla, que se note.
    expect(CASOS.length).toBe(
      METODOS.length *
        MONTOS.length *
        TASAS.length *
        CANTIDADES_CUOTA.length *
        FRECUENCIAS.length,
    );
    expect(CASOS.length).toBeGreaterThan(3000);
  });

  it('las cuotas suman exactamente el total, en todas las combinaciones', () => {
    const fallos: string[] = [];

    for (const caso of CASOS) {
      const { interesTotal, tabla } = planDe(caso);
      const total = caso.monto + interesTotal;

      const sumaCuotas = tabla.reduce((a, c) => a + c.monto, 0);
      const sumaCapital = tabla.reduce((a, c) => a + c.montoCapital, 0);
      const sumaInteres = tabla.reduce((a, c) => a + c.montoInteres, 0);

      if (sumaCuotas !== total) {
        fallos.push(
          `${etiqueta(caso)} — las cuotas suman ${sumaCuotas} y el total es ${total}`,
        );
      }
      if (sumaCapital !== caso.monto) {
        fallos.push(
          `${etiqueta(caso)} — el capital suma ${sumaCapital} y el monto es ${caso.monto}`,
        );
      }
      if (sumaInteres !== interesTotal) {
        fallos.push(
          `${etiqueta(caso)} — el interés suma ${sumaInteres} y debía ser ${interesTotal}`,
        );
      }
    }

    expect(fallos).toEqual([]);
  });

  it('ninguna cuota trae centavos ni queda negativa', () => {
    const fallos: string[] = [];

    for (const caso of CASOS) {
      const { tabla } = planDe(caso);
      for (const cuota of tabla) {
        const cifras = {
          monto: cuota.monto,
          capital: cuota.montoCapital,
          interés: cuota.montoInteres,
        };
        for (const [nombre, valor] of Object.entries(cifras)) {
          if (!Number.isInteger(valor)) {
            fallos.push(`${etiqueta(caso)} — ${nombre} con centavos: ${valor}`);
          }
          if (valor < 0) {
            fallos.push(`${etiqueta(caso)} — ${nombre} negativo: ${valor}`);
          }
        }
        if (cuota.montoCapital + cuota.montoInteres !== cuota.monto) {
          fallos.push(
            `${etiqueta(caso)} — capital + interés no da la cuota en la ${cuota.numeroCuota}`,
          );
        }
      }
    }

    expect(fallos).toEqual([]);
  });

  it('el residuo cae en la última cuota y en ninguna otra', () => {
    const fallos: string[] = [];

    for (const caso of CASOS) {
      const { tabla } = planDe(caso);
      if (tabla.length < 2) continue;

      // Todas las cuotas menos la última valen lo mismo; la última absorbe lo
      // que sobra. Si el residuo se repartiera, cada cliente pagaría una cifra
      // distinta cada quincena sin motivo.
      const base = tabla[0].monto;
      const intermedias = tabla.slice(0, -1);
      if (intermedias.some((c) => c.monto !== base)) {
        fallos.push(
          `${etiqueta(caso)} — las cuotas intermedias no son iguales`,
        );
      }

      const ultima = tabla[tabla.length - 1].monto;
      if (ultima < base) {
        // La última puede ser mayor (absorbe el residuo) pero nunca menor:
        // eso significaría regalar plata.
        fallos.push(
          `${etiqueta(caso)} — la última cuota (${ultima}) es menor que la base (${base})`,
        );
      }
    }

    expect(fallos).toEqual([]);
  });
});

describe('La importación calcula el interés igual que el sistema', () => {
  const servicio = new LoansService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );

  it('coincide con LoansService en toda la malla', () => {
    const fallos: string[] = [];

    for (const caso of CASOS) {
      // El sistema no ofrece crédito sin interés desde el modal, y con tasa 0
      // toma otro camino; se compara aparte más abajo.
      if (caso.tasa === 0) continue;

      const { plazoMeses, interesTotal, tabla } = planDe(caso);

      const delSistema = (servicio as any).calculateInterestAndCuotas(
        caso.metodo as TipoAmortizacion,
        caso.monto,
        caso.tasa,
        caso.cuotas,
        plazoMeses,
        caso.frecuencia,
        new Date('2026-05-01T12:00:00.000Z'),
        new Date('2026-05-01T12:00:00.000Z'),
      );

      if (interesTotal !== delSistema.interesTotal) {
        fallos.push(
          `${etiqueta(caso)} — interés ${interesTotal} contra ${delSistema.interesTotal}`,
        );
      }

      const cuotasSistema = delSistema.cuotas as Array<{ monto: number }>;
      if (tabla.length !== cuotasSistema.length) {
        fallos.push(`${etiqueta(caso)} — distinta cantidad de cuotas`);
        continue;
      }

      for (let i = 0; i < tabla.length; i++) {
        if (tabla[i].monto !== cuotasSistema[i].monto) {
          fallos.push(
            `${etiqueta(caso)} — cuota ${i + 1}: ${tabla[i].monto} contra ${cuotasSistema[i].monto}`,
          );
          break;
        }
      }
    }

    expect(fallos).toEqual([]);
  });

  it('sin tasa no se cobra interés y el capital se reparte entero', () => {
    for (const caso of CASOS.filter((c) => c.tasa === 0)) {
      const { interesTotal, tabla } = planDe(caso);
      expect(interesTotal).toBe(0);
      expect(tabla.reduce((a, c) => a + c.monto, 0)).toBe(caso.monto);
      expect(tabla.every((c) => c.montoInteres === 0)).toBe(true);
    }
  });
});

describe('Lo ya cobrado nunca supera lo que se debe', () => {
  const fechas = (cantidad: number) =>
    Array.from({ length: cantidad }, (_, i) => {
      const fecha = new Date('2026-05-01T12:00:00.000Z');
      fecha.setDate(fecha.getDate() + i);
      return fecha;
    });

  it('el avance histórico cuadra en toda la malla', () => {
    const fallos: string[] = [];

    for (const caso of CASOS) {
      const { interesTotal } = planDe(caso);
      const total = caso.monto + interesTotal;

      // Se prueba con ninguna cuota pagada, con la mitad, con todas, y con una
      // más de las que existen, que es el error de dedo más común.
      const avances = [
        0,
        Math.floor(caso.cuotas / 2),
        caso.cuotas,
        caso.cuotas + 1,
      ];

      for (const cuotasPagadas of avances) {
        const plan = construirPlanCuotas({
          tipoAmortizacion: caso.metodo,
          monto: caso.monto,
          interesTotal,
          cantidadCuotas: caso.cuotas,
          fechasVencimiento: fechas(caso.cuotas),
        });

        const avance = aplicarAvanceHistorico(plan, cuotasPagadas, 0, null);
        const donde = `${etiqueta(caso)} · ${cuotasPagadas} pagadas`;

        if (avance.totalPagado > total) {
          fallos.push(
            `${donde} — se pagó ${avance.totalPagado} de un total de ${total}`,
          );
        }
        if (
          avance.capitalPagado + avance.interesPagado !==
          avance.totalPagado
        ) {
          fallos.push(`${donde} — capital + interés no da el total pagado`);
        }
        if (!Number.isInteger(avance.totalPagado)) {
          fallos.push(`${donde} — el total pagado trae centavos`);
        }
        if (avance.capitalPagado > caso.monto) {
          fallos.push(`${donde} — se abonó más capital del que se prestó`);
        }
        if (avance.interesPagado > interesTotal) {
          fallos.push(`${donde} — se cobró más interés del pactado`);
        }
        if (total - avance.totalPagado < 0) {
          fallos.push(`${donde} — el saldo queda negativo`);
        }

        // Pagando todas las cuotas el crédito tiene que quedar en cero, ni un
        // peso de más ni de menos.
        if (cuotasPagadas >= caso.cuotas && avance.totalPagado !== total) {
          fallos.push(
            `${donde} — pagando todo quedó en ${avance.totalPagado} de ${total}`,
          );
        }
      }
    }

    expect(fallos).toEqual([]);
  });

  it('un abono suelto se aplica sin pasarse del total', () => {
    const fallos: string[] = [];

    for (const caso of CASOS) {
      const { interesTotal } = planDe(caso);
      const total = caso.monto + interesTotal;

      const plan = construirPlanCuotas({
        tipoAmortizacion: caso.metodo,
        monto: caso.monto,
        interesTotal,
        cantidadCuotas: caso.cuotas,
        fechasVencimiento: fechas(caso.cuotas),
      });

      // Un abono mayor que el crédito entero: no puede terminar debiendo el
      // sistema plata al cliente.
      const avance = aplicarAvanceHistorico(plan, 0, total * 2, null);

      if (avance.totalPagado > total) {
        fallos.push(
          `${etiqueta(caso)} — abono excesivo aplicó ${avance.totalPagado} de ${total}`,
        );
      }
      if (avance.montoNoAplicado < 0) {
        fallos.push(`${etiqueta(caso)} — sobrante negativo`);
      }
      if (avance.totalPagado + avance.montoNoAplicado !== total * 2) {
        fallos.push(
          `${etiqueta(caso)} — lo aplicado más lo no aplicado no da lo abonado`,
        );
      }
    }

    expect(fallos).toEqual([]);
  });
});

describe('El crédito de artículo cierra contra el precio', () => {
  const PRECIOS = [135_000, 540_000, 980_000, 1_450_000, 3_333_333];
  const INICIALES = [0, 1, 50_000, 150_000];

  it('lo financiado más la inicial siempre da el precio', () => {
    const fallos: string[] = [];

    for (const precio of PRECIOS) {
      for (const inicial of INICIALES) {
        if (inicial > precio) continue;

        // Es lo que hace el parser: se financia el precio menos la inicial.
        const financiado = Math.max(0, precio - inicial);
        // Y es lo que el asiento acredita como ingreso de la venta.
        const precioVenta = pesos(financiado + inicial);

        if (precioVenta !== precio) {
          fallos.push(
            `precio ${precio} con inicial ${inicial} — la venta quedó en ${precioVenta}`,
          );
        }
        if (!Number.isInteger(financiado)) {
          fallos.push(`precio ${precio} — lo financiado trae centavos`);
        }
      }
    }

    expect(fallos).toEqual([]);
  });

  it('el asiento que arma el servicio cuadra en toda la malla', async () => {
    // Se invoca el servicio de verdad, no una copia de su aritmética: una
    // prueba que rehace la cuenta a mano no detecta que el servicio cambie.
    const COSTOS = [0, 95_000, 480_000, 1_100_000];
    const fallos: string[] = [];

    for (const precio of PRECIOS) {
      for (const inicial of INICIALES) {
        if (inicial > precio) continue;
        for (const costo of COSTOS) {
          const financiado = precio - inicial;
          const creado: any[] = [];
          const tx = {
            journalEntry: {
              create: jest.fn().mockImplementation((argumento: any) => {
                creado.push(argumento);
                return { id: 'journal-1', lines: [] };
              }),
            },
            caja: {
              findUnique: jest
                .fn()
                .mockResolvedValue({ id: 'caja-oficina', saldoActual: 0 }),
              update: jest.fn().mockResolvedValue({}),
            },
          };
          const prisma = {
            $transaction: jest.fn().mockImplementation((cb: any) => cb(tx)),
          };
          const ledger = new LedgerService(prisma as any);

          const donde = `precio ${precio} · inicial ${inicial} · costo ${costo}`;
          try {
            await ledger.registrarVentaArticulo({
              prestamoId: 'prestamo-1',
              precioVenta: pesos(financiado + inicial),
              costoArticulo: costo,
              montoFinanciado: financiado,
              cuotaInicial: inicial,
              cajaId: inicial > 0 ? 'caja-oficina' : undefined,
              accountCodeCaja: inicial > 0 ? '1.1.1' : undefined,
              createdBy: 'admin-1',
            });
          } catch (error: any) {
            fallos.push(
              `${donde} — el asiento fue rechazado: ${error.message}`,
            );
            continue;
          }

          const lineas = (creado[0]?.data?.lines?.create ?? []) as Array<{
            debitAmount?: number;
            creditAmount?: number;
          }>;
          const debitos = lineas.reduce(
            (a, l) => a + Number(l.debitAmount || 0),
            0,
          );
          const creditos = lineas.reduce(
            (a, l) => a + Number(l.creditAmount || 0),
            0,
          );

          if (debitos !== creditos) {
            fallos.push(
              `${donde} — débitos ${debitos} contra créditos ${creditos}`,
            );
          }
          if (debitos !== inicial + financiado + costo) {
            fallos.push(`${donde} — los débitos no son caja + cartera + costo`);
          }
        }
      }
    }

    expect(fallos).toEqual([]);
  });

  it('la utilidad es el precio menos el costo, sin redondear', () => {
    for (const precio of PRECIOS) {
      for (const costo of [0, 95_000, 480_000, 1_100_000]) {
        const utilidad = precio - costo;
        expect(Number.isInteger(utilidad)).toBe(true);
        // El porcentaje del Excel va sobre el costo (markup), no sobre la
        // venta. Son distintos y convertibles: margen = markup / (1 + markup).
        if (costo > 0) {
          const markup = utilidad / costo;
          const margen = utilidad / precio;
          expect(margen).toBeCloseTo(markup / (1 + markup), 10);
        }
      }
    }
  });
});
