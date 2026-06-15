import { FrecuenciaPago } from '@prisma/client';
import { calcularAmortizacionFrancesa } from './amortizacion.utils';

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

    const totalPagado = result.tabla.reduce((sum, cuota) => sum + cuota.monto, 0);
    expect(totalPagado).toBe(5_500_000);
    expect(result.interesTotal).toBe(500_000);
    expect(result.tabla.at(-1)?.saldoRestante).toBe(0);
  });
});
