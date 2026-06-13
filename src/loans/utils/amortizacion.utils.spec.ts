import { FrecuenciaPago } from '@prisma/client';
import { calcularAmortizacionFrancesa } from './amortizacion.utils';

describe('calcularAmortizacionFrancesa', () => {
  it('calcula cuota fija mensual con tasa mensual sin dividirla por el plazo', () => {
    const result = calcularAmortizacionFrancesa(
      5_000_000,
      10,
      12,
      12,
      FrecuenciaPago.MENSUAL,
    );

    expect(result.cuotaFija).toBe(733_817);
    expect(result.tabla).toHaveLength(12);
    expect(result.tabla[0]).toMatchObject({
      numeroCuota: 1,
      montoInteres: 500_000,
      montoCapital: 233_817,
      monto: 733_817,
    });

    const totalPagado = result.tabla.reduce((sum, cuota) => sum + cuota.monto, 0);
    expect(totalPagado).toBe(8_805_796);
    expect(result.interesTotal).toBe(3_805_796);
    expect(result.tabla.at(-1)?.saldoRestante).toBe(0);
  });
});
