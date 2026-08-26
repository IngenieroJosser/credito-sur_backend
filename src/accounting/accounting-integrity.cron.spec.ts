import { RolUsuario } from '@prisma/client';
import { AccountingIntegrityCron } from './accounting-integrity.cron';

function armar(opciones: { balanceado: boolean; cajasDescuadradas?: number }) {
  const ledger = {
    verificarIntegridadGlobal: jest.fn().mockResolvedValue({
      balanced: opciones.balanceado,
      diferencia: opciones.balanceado ? 0 : 12345,
    }),
    verificarIntegridadCajas: jest.fn().mockResolvedValue(
      Array.from({ length: opciones.cajasDescuadradas ?? 0 }, (_, i) => ({
        nombre: `Caja ${i + 1}`,
        correct: false,
        diferencia: 500,
      })),
    ),
  };
  const notificaciones = {
    notifyRolesDeduped: jest.fn().mockResolvedValue(undefined),
    notifyCoordinator: jest.fn().mockResolvedValue(undefined),
  };
  return {
    cron: new AccountingIntegrityCron(ledger as any, notificaciones as any),
    notificaciones,
  };
}

describe('La alerta de integridad contable llega a quien puede actuar', () => {
  it('avisa del coordinador para arriba, no solo al coordinador', async () => {
    // Antes iba únicamente al COORDINADOR. Si nadie revisa esa cuenta, un
    // libro descuadrado se queda en la base sin que nadie lo lea, que es
    // exactamente lo que pasaba.
    const { cron, notificaciones } = armar({
      balanceado: false,
      cajasDescuadradas: 2,
    });

    await cron.handleNightlyIntegrityCheck();

    expect(notificaciones.notifyCoordinator).not.toHaveBeenCalled();
    expect(notificaciones.notifyRolesDeduped).toHaveBeenCalledTimes(1);

    const [aviso] = (notificaciones.notifyRolesDeduped as jest.Mock).mock
      .calls[0];
    expect(aviso.roles).toEqual([
      RolUsuario.CONTADOR,
      RolUsuario.COORDINADOR,
      RolUsuario.ADMIN,
      RolUsuario.SUPER_ADMINISTRADOR,
    ]);
    expect(aviso.mensaje).toContain('Balance global descuadrado');
    expect(aviso.mensaje).toContain('2 cajas');
    // Una por día: que el cron corra dos veces no debe llenar de avisos.
    expect(aviso.dedupeKey).toMatch(/^integridad-contable:\d{4}-\d{2}-\d{2}$/);
  });

  it('no molesta a nadie cuando las cuentas cuadran', async () => {
    const { cron, notificaciones } = armar({ balanceado: true });

    await cron.handleNightlyIntegrityCheck();

    expect(notificaciones.notifyRolesDeduped).not.toHaveBeenCalled();
    expect(notificaciones.notifyCoordinator).not.toHaveBeenCalled();
  });

  it('avisa también si solo hay cajas descuadradas', async () => {
    const { cron, notificaciones } = armar({
      balanceado: true,
      cajasDescuadradas: 1,
    });

    await cron.handleNightlyIntegrityCheck();

    expect(notificaciones.notifyRolesDeduped).toHaveBeenCalledTimes(1);
  });
});
