import { PaymentsController } from './payments.controller';
import { MetodoPago, RolUsuario } from '@prisma/client';

describe('PaymentsController', () => {
  it('preserva campos de cierre pendiente al normalizar el dto', async () => {
    const paymentsService = {
      create: jest.fn().mockResolvedValue({ ok: true }),
    };
    const controller = new PaymentsController(paymentsService as any);

    await controller.create(
      {
        prestamoId: ' prestamo-1 ',
        clienteId: ' cliente-1 ',
        cobradorId: ' cobrador-1 ',
        montoTotal: '10000' as any,
        metodoPago: 'efectivo' as any,
        tipoRegistro: 'pago' as any,
        cuotaId: ' cuota-16 ',
        rutaId: ' ruta-3 ',
        cuotaNumeroEsperada: '16' as any,
        montoCuotaEsperado: '10000' as any,
        fechaOperativaRuta: ' 2026-05-27 ',
        origenGestion: 'cierre_pendiente' as any,
        idempotencyKey: ' cierre:1 ',
      },
      { user: { id: 'admin-1', rol: RolUsuario.ADMIN } },
    );

    expect(paymentsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        prestamoId: 'prestamo-1',
        clienteId: 'cliente-1',
        cobradorId: 'cobrador-1',
        montoTotal: 10000,
        metodoPago: MetodoPago.EFECTIVO,
        tipoRegistro: 'PAGO',
        cuotaId: 'cuota-16',
        rutaId: 'ruta-3',
        cuotaNumeroEsperada: 16,
        montoCuotaEsperado: 10000,
        fechaOperativaRuta: '2026-05-27',
        origenGestion: 'CIERRE_PENDIENTE',
        idempotencyKey: 'cierre:1',
      }),
      undefined,
      { id: 'admin-1', rol: RolUsuario.ADMIN },
    );
  });
});
