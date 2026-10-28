import { FrecuenciaPago } from '@prisma/client';
import {
  calcularAmortizacionFrancesa,
  calcularFechaVencimiento,
  saltarDomingo,
} from './amortizacion.utils';

describe('calcularAmortizacionFrancesa', () => {
  it('calcula cuotas con interés plano como método de amortización', () => {
    const result = calcularAmortizacionFrancesa(
      5_000_000,
      10,
      12,
      12,
      FrecuenciaPago.MENSUAL,
    );

    // Interés plano: 10% de 5.000.000 = 500.000
    // Total a pagar: 5.000.000 + 500.000 = 5.500.000
    // Cuota: 5.500.000 / 12 = 458.333 (Math.floor)
    expect(result.cuotaFija).toBe(458_333);
    expect(result.tabla).toHaveLength(12);
    expect(result.tabla[0]).toMatchObject({
      numeroCuota: 1,
      montoInteres: 0, // No aplica desglose tradicional en interés plano
      montoCapital: 0, // No aplica desglose tradicional en interés plano
      monto: 458_333,
    });

    const totalPagado = result.tabla.reduce(
      (sum, cuota) => sum + cuota.monto,
      0,
    );
    expect(totalPagado).toBe(5_500_000);
    expect(result.interesTotal).toBe(500_000);
    expect(result.tabla.at(-1)?.saldoRestante).toBe(0);
  });
});

describe('calcularFechaVencimiento', () => {
  // La version que vivia en amortizacion.utils y la que vivia dentro de
  // approvals.service no hacian nada de esto. Cada expectativa de aqui es un
  // caso en el que esas copias daban una fecha distinta a la de la creacion del
  // prestamo, sobre el mismo credito.
  const dia = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);

  // 2026-01-05 es lunes.
  const lunes = new Date('2026-01-05T12:00:00-05:00');

  it('la cuota 1 vence en la fecha base', () => {
    expect(dia(calcularFechaVencimiento(lunes, 1, FrecuenciaPago.DIARIO))).toBe(
      '2026-01-05',
    );
  });

  it('DIARIO salta los domingos', () => {
    // lun 5, mar 6, mie 7, jue 8, vie 9, sab 10 y la septima cae en domingo 11,
    // asi que pasa al lunes 12.
    expect(dia(calcularFechaVencimiento(lunes, 6, FrecuenciaPago.DIARIO))).toBe(
      '2026-01-10',
    );
    expect(dia(calcularFechaVencimiento(lunes, 7, FrecuenciaPago.DIARIO))).toBe(
      '2026-01-12',
    );
  });

  it('SEMANAL que cae en domingo se mueve al sabado anterior', () => {
    const domingo = new Date('2026-01-04T12:00:00-05:00');
    expect(
      dia(calcularFechaVencimiento(domingo, 1, FrecuenciaPago.SEMANAL)),
    ).toBe('2026-01-03');
  });

  it('MENSUAL recorta el dia al ultimo del mes', () => {
    // 31 de enero + 1 mes no existe: queda el 28 de febrero.
    const treintaYUno = new Date('2026-01-31T12:00:00-05:00');
    expect(
      dia(calcularFechaVencimiento(treintaYUno, 2, FrecuenciaPago.MENSUAL)),
    ).toBe('2026-02-28');
  });

  it('QUINCENAL avanza de quince en quince', () => {
    expect(
      dia(calcularFechaVencimiento(lunes, 3, FrecuenciaPago.QUINCENAL)),
    ).toBe('2026-02-04');
  });
});

describe('saltarDomingo', () => {
  const dia = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  const domingo = new Date('2026-01-04T12:00:00-05:00');

  it('DIARIO y MENSUAL pasan al lunes', () => {
    expect(dia(saltarDomingo(domingo, FrecuenciaPago.DIARIO))).toBe(
      '2026-01-05',
    );
    expect(dia(saltarDomingo(domingo, FrecuenciaPago.MENSUAL))).toBe(
      '2026-01-05',
    );
  });

  it('SEMANAL y QUINCENAL retroceden al sabado', () => {
    expect(dia(saltarDomingo(domingo, FrecuenciaPago.SEMANAL))).toBe(
      '2026-01-03',
    );
    expect(dia(saltarDomingo(domingo, FrecuenciaPago.QUINCENAL))).toBe(
      '2026-01-03',
    );
  });

  it('un dia que no es domingo no se mueve', () => {
    const martes = new Date('2026-01-06T12:00:00-05:00');
    expect(dia(saltarDomingo(martes, FrecuenciaPago.DIARIO))).toBe(
      '2026-01-06',
    );
  });
});
