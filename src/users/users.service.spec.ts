import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EstadoUsuario, RolUsuario } from '@prisma/client';
import { UsersService } from './users.service';

describe('UsersService operational detail', () => {
  const buildService = (prismaOverrides: Record<string, any> = {}) => {
    const prisma: any = {
      usuario: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      rol: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      asignacionRolUsuario: {
        create: jest.fn(),
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
      $transaction: jest.fn(async (callback: any) =>
        callback({
          usuario: {
            count: jest.fn().mockResolvedValue(1),
            create: jest.fn().mockResolvedValue({
              id: 'user-1',
              nombres: 'Juan',
              apellidos: 'Perez',
              nombreUsuario: 'juan.perez',
              correo: 'juan@test.com',
              rol: RolUsuario.COBRADOR,
              esPrincipal: false,
              estado: EstadoUsuario.ACTIVO,
              telefono: null,
              creadoEn: new Date('2026-06-26T00:00:00.000Z'),
            }),
          },
          asignacionRolUsuario: {
            create: jest.fn(),
          },
        }),
      ),
      ...prismaOverrides,
    };

    const auditService = { create: jest.fn() };
    const gateway = { broadcastUsuariosActualizados: jest.fn() };
    const service = new UsersService(
      prisma,
      auditService as any,
      gateway as any,
    );

    return { service, prisma, auditService, gateway };
  };

  describe('crear', () => {
    const baseDto = {
      nombres: 'Juan',
      apellidos: 'Perez',
      nombreUsuario: ' Juan.Perez ',
      correo: 'juan@test.com',
      password: 'password123',
      rol: RolUsuario.COBRADOR,
      estado: EstadoUsuario.ACTIVO,
    };

    it('rejects creating users without nombreUsuario', async () => {
      const { service, prisma } = buildService();
      prisma.usuario.findUnique.mockResolvedValue(null);

      await expect(
        service.crear({ ...baseDto, nombreUsuario: '' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates users with normalized nombreUsuario', async () => {
      const txUsuarioCreate = jest.fn().mockResolvedValue({
        id: 'user-1',
        nombres: 'Juan',
        apellidos: 'Perez',
        nombreUsuario: 'juan.perez',
        correo: 'juan@test.com',
        rol: RolUsuario.COBRADOR,
        esPrincipal: false,
        estado: EstadoUsuario.ACTIVO,
        telefono: null,
        creadoEn: new Date('2026-06-26T00:00:00.000Z'),
      });
      const { service, prisma } = buildService({
        $transaction: jest.fn(async (callback: any) =>
          callback({
            usuario: {
              count: jest.fn().mockResolvedValue(1),
              create: txUsuarioCreate,
            },
            asignacionRolUsuario: {
              create: jest.fn(),
            },
          }),
        ),
      });
      prisma.usuario.findUnique.mockResolvedValue(null);
      prisma.usuario.findFirst.mockResolvedValue(null);

      const result = await service.crear(baseDto);

      expect(result.nombreUsuario).toBe('juan.perez');
      expect(txUsuarioCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            nombreUsuario: 'juan.perez',
          }),
        }),
      );
    });

    it('rejects duplicated nombreUsuario', async () => {
      const { service, prisma } = buildService();
      prisma.usuario.findUnique.mockResolvedValue(null);
      prisma.usuario.findFirst.mockResolvedValue({ id: 'existing-user' });

      await expect(service.crear(baseDto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

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

  it('archives users without setting eliminadoEn', async () => {
    const { service, prisma, auditService, gateway } = buildService();
    prisma.usuario.findUnique.mockResolvedValue({
      id: 'user-1',
      esPrincipal: false,
      estado: EstadoUsuario.ACTIVO,
      eliminadoEn: null,
    });
    prisma.usuario.update.mockResolvedValue({
      id: 'user-1',
      estado: EstadoUsuario.ARCHIVADO,
      eliminadoEn: null,
    });

    const result = await service.archivar('user-1', 'admin-1');

    expect(result.estado).toBe(EstadoUsuario.ARCHIVADO);
    expect(prisma.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: { estado: EstadoUsuario.ARCHIVADO, eliminadoEn: null },
      }),
    );
    expect(auditService.create).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'ARCHIVAR_USUARIO' }),
    );
    expect(gateway.broadcastUsuariosActualizados).toHaveBeenCalledWith({
      accion: 'ARCHIVAR',
      usuarioId: 'user-1',
    });
  });

  it('does not allow archiving the principal superadmin', async () => {
    const { service, prisma } = buildService();
    prisma.usuario.findUnique.mockResolvedValue({
      id: 'root',
      esPrincipal: true,
      estado: EstadoUsuario.ACTIVO,
      eliminadoEn: null,
    });

    await expect(service.archivar('root', 'admin-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.usuario.update).not.toHaveBeenCalled();
  });

  it('hides archived users by setting eliminadoEn without physical delete', async () => {
    const { service, prisma } = buildService();
    prisma.usuario.findUnique.mockResolvedValue({
      id: 'user-1',
      esPrincipal: false,
      estado: EstadoUsuario.ARCHIVADO,
      eliminadoEn: null,
    });
    prisma.usuario.update.mockResolvedValue({
      id: 'user-1',
      estado: EstadoUsuario.ARCHIVADO,
      eliminadoEn: new Date('2026-06-04T12:00:00.000Z'),
    });

    await service.eliminar('user-1', 'admin-1');

    expect(prisma.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: {
          eliminadoEn: expect.any(Date),
          estado: EstadoUsuario.ARCHIVADO,
        },
      }),
    );
    expect(prisma.usuario.delete).toBeUndefined();
  });
});
