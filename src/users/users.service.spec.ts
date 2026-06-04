import { NotFoundException } from '@nestjs/common';
import { RolUsuario } from '@prisma/client';
import { UsersService } from './users.service';

describe('UsersService operational detail', () => {
  const buildService = (prismaOverrides: Record<string, any> = {}) => {
    const prisma: any = {
      usuario: {
        findUnique: jest.fn(),
        count: jest.fn(),
      },
      ruta: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      pago: {
        aggregate: jest.fn(),
        findMany: jest.fn(),
      },
      cuota: {
        aggregate: jest.fn(),
      },
      gasto: {
        aggregate: jest.fn(),
        groupBy: jest.fn(),
      },
      caja: {
        aggregate: jest.fn(),
      },
      prestamo: {
        count: jest.fn(),
        aggregate: jest.fn(),
      },
      cliente: {
        count: jest.fn(),
      },
      journalLine: {
        aggregate: jest.fn(),
      },
      registroAuditoria: {
        findMany: jest.fn(),
      },
      ...prismaOverrides,
    };

    const service = new UsersService(
      prisma,
      { create: jest.fn() } as any,
      { broadcastUsuariosActualizados: jest.fn() } as any,
    );

    return { service, prisma };
  };

  it('returns accounting metrics for contador users', async () => {
    const { service, prisma } = buildService();
    prisma.usuario.findUnique.mockResolvedValue({
      id: 'contador-1',
      rol: RolUsuario.CONTADOR,
      nombres: 'Contador',
      apellidos: 'Prueba',
    });
    prisma.journalLine.aggregate
      .mockResolvedValueOnce({ _sum: { creditAmount: 250000, debitAmount: 10000 } })
      .mockResolvedValueOnce({ _sum: { debitAmount: 45000, creditAmount: 5000 } });
    prisma.gasto.groupBy.mockResolvedValue([
      { tipoGasto: 'TRANSPORTE', _sum: { monto: 20000 } },
    ]);
    prisma.caja.aggregate.mockResolvedValue({ _sum: { saldoActual: 900000 } });
    prisma.registroAuditoria.findMany.mockResolvedValue([]);

    const detalle = await service.obtenerDetalleOperativo('contador-1');

    expect(detalle.rol).toBe(RolUsuario.CONTADOR);
    expect(detalle.metricas.ingresosDia).toBe(240000);
    expect(detalle.metricas.egresosDia).toBe(40000);
    expect(detalle.metricas.balanceDia).toBe(200000);
    expect(detalle.metricas.dineroCaja).toBe(900000);
    expect(detalle.metricas.gastosCategorias).toEqual([
      { categoria: 'TRANSPORTE', monto: 20000 },
    ]);
  });

  it('returns route scoped metrics for cobrador users', async () => {
    const { service, prisma } = buildService();
    prisma.usuario.findUnique.mockResolvedValue({
      id: 'cobrador-1',
      rol: RolUsuario.COBRADOR,
      nombres: 'Cobrador',
      apellidos: 'Prueba',
    });
    prisma.ruta.findMany.mockResolvedValue([
      { id: 'ruta-1', nombre: 'Ruta Norte', zona: 'Norte' },
    ]);
    prisma.pago.aggregate.mockResolvedValue({ _sum: { montoTotal: 425335 } });
    prisma.cuota.aggregate.mockResolvedValue({
      _sum: { monto: 990333, montoInteresMora: 0 },
    });
    prisma.gasto.aggregate.mockResolvedValue({ _sum: { monto: 20000 } });
    prisma.caja.aggregate.mockResolvedValue({ _sum: { saldoActual: 500000 } });
    prisma.prestamo.count.mockResolvedValue(2);
    prisma.pago.findMany.mockResolvedValue([
      {
        fechaPago: new Date('2026-06-04T15:00:00.000Z'),
        montoTotal: 425335,
        cliente: { nombres: 'Cliente', apellidos: 'Uno' },
      },
    ]);
    prisma.registroAuditoria.findMany.mockResolvedValue([]);

    const detalle = await service.obtenerDetalleOperativo('cobrador-1');

    expect(detalle.rol).toBe(RolUsuario.COBRADOR);
    expect(detalle.metricas.rutaNombre).toBe('Ruta Norte');
    expect(detalle.metricas.recaudoDia).toBe(425335);
    expect(detalle.metricas.metaDiaria).toBe(990333);
    expect(detalle.metricas.rutasActivas).toBe(1);
    expect(detalle.metricas.enMora).toBe(2);
    expect(detalle.metricas.gastosHoy).toBe(20000);
    expect(detalle.metricas.actividadReciente[0].action).toBe('Pago registrado');
  });

  it('throws when user does not exist', async () => {
    const { service, prisma } = buildService();
    prisma.usuario.findUnique.mockResolvedValue(null);

    await expect(service.obtenerDetalleOperativo('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns real active users count for admin users', async () => {
    const { service, prisma } = buildService();
    prisma.usuario.findUnique.mockResolvedValue({
      id: 'admin-1',
      rol: RolUsuario.ADMIN,
      nombres: 'Admin',
      apellidos: 'Prueba',
    });
    prisma.ruta.findMany.mockResolvedValue([]);
    prisma.ruta.count.mockResolvedValue(0);
    prisma.journalLine.aggregate
      .mockResolvedValueOnce({ _sum: { creditAmount: 0, debitAmount: 0 } })
      .mockResolvedValueOnce({ _sum: { debitAmount: 0, creditAmount: 0 } });
    prisma.caja.aggregate.mockResolvedValue({ _sum: { saldoActual: 0 } });
    prisma.gasto.groupBy.mockResolvedValue([]);
    prisma.usuario.count.mockResolvedValue(7);
    prisma.registroAuditoria.findMany.mockResolvedValue([]);

    const detalle = await service.obtenerDetalleOperativo('admin-1');

    expect(detalle.metricas.usuariosActivos).toBe(7);
    expect(detalle.metricas.rutasTotal).toBe(0);
  });
});
