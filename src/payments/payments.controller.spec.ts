import { PaymentsController } from './payments.controller';
import { MetodoPago, RolUsuario } from '@prisma/client';
import type { PaymentsService } from './payments.service';
import { comoDependencia } from '../common/testing/dobles';
import type { CreatePaymentDto } from './dto/create-payment.dto';

describe('PaymentsController', () => {
  it('preserva campos de cierre pendiente al normalizar el dto', async () => {
    const paymentsService = {
      create: jest.fn().mockResolvedValue({ ok: true }),
    };
    const controller = new PaymentsController(
      comoDependencia<PaymentsService>(paymentsService),
    );

    // El cuerpo entra como llega del cable: multipart manda TODO en texto, y el punto de
    // la prueba es que el controlador lo normalice (recorta, convierte a numero y pone el
    // enum en mayusculas). Por eso el literal se arma aparte y se entrega con un cast con
    // nombre, en vez de un `as any` por campo que ademas tapaba los nombres.
    const cuerpoComoLlegaDelCable = {
      prestamoId: ' prestamo-1 ',
      clienteId: ' cliente-1 ',
      cobradorId: ' cobrador-1 ',
      montoTotal: '10000',
      metodoPago: 'efectivo',
      tipoRegistro: 'pago',
      cuotaId: ' cuota-16 ',
      rutaId: ' ruta-3 ',
      cuotaNumeroEsperada: '16',
      montoCuotaEsperado: '10000',
      fechaOperativaRuta: ' 2026-05-27 ',
      origenGestion: 'cierre_pendiente',
      idempotencyKey: ' cierre:1 ',
    };

    await controller.create(
      cuerpoComoLlegaDelCable as unknown as CreatePaymentDto,
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
