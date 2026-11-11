import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EstadoUsuario, RolUsuario } from '@prisma/client';
import { UsersService } from './users.service';
import {
  comoDependencia,
  comoPrisma,
  type DobleDePrisma,
} from '../common/testing/dobles';
import type { AuditService } from '../audit/audit.service';
import type { NotificacionesGateway } from '../notificaciones/notificaciones.gateway';

describe('UsersService operational detail', () => {
  const buildService = (prismaOverrides: DobleDePrisma = {}) => {
    const prisma = {
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
      $transaction: jest.fn(async (callback) =>
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
      comoPrisma(prisma),
      comoDependencia<AuditService>(auditService),
      comoDependencia<NotificacionesGateway>(gateway),
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
        $transaction: jest.fn(async (callback) =>
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
      .mockResolvedValueOnce({
        _sum: { creditAmount: 250000, debitAmount: 10000 },
      })
      .mockResolvedValueOnce({
        _sum: { debitAmount: 45000, creditAmount: 5000 },
      });
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
    expect(detalle.metricas.actividadReciente[0].action).toBe(
      'Pago registrado',
    );
  });

  it('throws when user does not exist', async () => {
    const { service, prisma } = buildService();
    prisma.usuario.findUnique.mockResolvedValue(null);

    await expect(
      service.obtenerDetalleOperativo('missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
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
    // El doble de `usuario` no tiene `delete`: si el servicio lo llamara, la prueba
    // reventaria con "no es una funcion". Antes esto comprobaba el DOBLE y no el
    // servicio -pasaba igual hiciera lo que hiciera-, y el compilador lo dijo en cuanto
    // el doble dejo de ser `any`. Lo que de verdad fija el borrado logico son las
    // aserciones de arriba sobre `update`.
  });
  /**
   * Este metodo NO existia. El controlador ya exponia
   * `POST /usuarios/:id/reset-password` y lo llamaba con un cast sobre el servicio, asi
   * que tsc no podia avisar; el boton del frontend lanzaba un TypeError en el servidor.
   */
  describe('resetearContrasena', () => {
    const objetivo = {
      id: 'usuario-2',
      rol: RolUsuario.COBRADOR,
      nombres: 'Ana',
      apellidos: 'Munoz',
      nombreUsuario: 'amunoz',
      esPrincipal: false,
    };

    it('devuelve una temporal, la guarda hasheada y obliga a cambiarla', async () => {
      const { service, prisma } = buildService();
      prisma.usuario.findFirst.mockResolvedValue(objetivo);
      prisma.usuario.update.mockResolvedValue({ id: 'usuario-2' });

      const { contrasenaTemporal } = await service.resetearContrasena(
        'usuario-2',
        RolUsuario.ADMIN,
        'admin-1',
      );

      expect(contrasenaTemporal).toHaveLength(12);
      const [args] = prisma.usuario.update.mock.calls.at(-1);
      expect(args.where).toEqual({ id: 'usuario-2' });
      expect(args.data.debeCambiarContrasena).toBe(true);
      // Se guarda el hash, nunca la contrasena en claro.
      expect(args.data.hashContrasena).not.toBe(contrasenaTemporal);
      expect(args.data.hashContrasena).toMatch(/^\$argon2/);
    });

    it('no usa caracteres que se confundan al dictarla', async () => {
      const { service, prisma } = buildService();
      prisma.usuario.findFirst.mockResolvedValue(objetivo);
      prisma.usuario.update.mockResolvedValue({ id: 'usuario-2' });

      const { contrasenaTemporal } = await service.resetearContrasena(
        'usuario-2',
        RolUsuario.ADMIN,
        'admin-1',
      );

      expect(contrasenaTemporal).toMatch(
        /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/,
      );
    });

    it('un ADMIN no puede resetear la contrasena de un SUPER_ADMINISTRADOR', async () => {
      // Sin esta guarda un admin resetea la clave del superadmin y entra con ella: la
      // misma escalada vertical que `actualizar()` ya bloquea para el cambio de rol.
      const { service, prisma } = buildService();
      prisma.usuario.findFirst.mockResolvedValue({
        ...objetivo,
        rol: RolUsuario.SUPER_ADMINISTRADOR,
      });

      await expect(
        service.resetearContrasena('usuario-2', RolUsuario.ADMIN, 'admin-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.usuario.update).not.toHaveBeenCalled();
    });

    it('tampoco la del usuario principal', async () => {
      const { service, prisma } = buildService();
      prisma.usuario.findFirst.mockResolvedValue({
        ...objetivo,
        esPrincipal: true,
      });

      await expect(
        service.resetearContrasena('usuario-2', RolUsuario.ADMIN, 'admin-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('un SUPER_ADMINISTRADOR si puede resetear a otro', async () => {
      const { service, prisma } = buildService();
      prisma.usuario.findFirst.mockResolvedValue({
        ...objetivo,
        rol: RolUsuario.SUPER_ADMINISTRADOR,
      });
      prisma.usuario.update.mockResolvedValue({ id: 'usuario-2' });

      await expect(
        service.resetearContrasena(
          'usuario-2',
          RolUsuario.SUPER_ADMINISTRADOR,
          'super-1',
        ),
      ).resolves.toHaveProperty('contrasenaTemporal');
    });

    it('404 si el usuario no existe o esta borrado', async () => {
      const { service, prisma } = buildService();
      prisma.usuario.findFirst.mockResolvedValue(null);

      await expect(
        service.resetearContrasena('no-existe', RolUsuario.ADMIN, 'admin-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('audita la accion SIN la contrasena', async () => {
      const { service, prisma, auditService } = buildService();
      prisma.usuario.findFirst.mockResolvedValue(objetivo);
      prisma.usuario.update.mockResolvedValue({ id: 'usuario-2' });

      const { contrasenaTemporal } = await service.resetearContrasena(
        'usuario-2',
        RolUsuario.ADMIN,
        'admin-1',
      );

      const [registro] = auditService.create.mock.calls.at(-1);
      expect(registro.accion).toBe('RESETEAR_CONTRASENA');
      expect(registro.entidadId).toBe('usuario-2');
      expect(JSON.stringify(registro)).not.toContain(contrasenaTemporal);
    });
  });

  /**
   * Que no se pueda dejar el sistema sin ningún superadministrador.
   *
   * Pasó de verdad: llamando a las rutas de usuarios con la sesión del propio
   * superadministrador, `DELETE /usuarios/:id` sobre su propio id respondió
   * 200, le puso `estado = ARCHIVADO` y a partir de ahí nadie podía entrar a
   * administrar. Hubo que editar la base de datos a mano para recuperarlo.
   *
   * Había tres protecciones escritas para esto, y las tres preguntan por
   * `usuario.esPrincipal`, una columna que vale `false` por defecto y que
   * ningún sitio del código pone en `true` —ni la semilla, ni `auth/setup`, ni
   * el endpoint de crear usuarios—. Así que no se disparaban nunca. Esta
   * guarda no pregunta: cuenta los superadministradores activos que quedarían.
   *
   * Se cubren los cuatro caminos que vacían la silla, porque tapar uno solo
   * deja los otros tres abiertos: borrar, archivar, bajarse de rol y
   * desactivarse. Los dos últimos pasan por `actualizar`, donde la
   * autoedición está permitida siempre.
   */
  describe('nunca se queda el sistema sin superadministrador', () => {
    const SUPER = {
      id: 'super-1',
      rol: RolUsuario.SUPER_ADMINISTRADOR,
      estado: EstadoUsuario.ACTIVO,
      esPrincipal: false,
      eliminadoEn: null,
      nombreUsuario: 'super',
      correo: 'super@test.com',
    };

    /** `count` es la cuenta de los que QUEDARÍAN, sin contar al que se va. */
    const conSuperadministradoresRestantes = (cuantos: number) => ({
      usuario: {
        findUnique: jest.fn().mockResolvedValue(SUPER),
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(cuantos),
        update: jest.fn().mockResolvedValue({ ...SUPER }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    });

    it('no deja ELIMINAR al último que queda', async () => {
      const { service, prisma } = buildService(
        conSuperadministradoresRestantes(0),
      );

      await expect(service.eliminar('super-1', 'super-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.usuario.update).not.toHaveBeenCalled();
    });

    it('no deja ARCHIVAR al último que queda', async () => {
      const { service, prisma } = buildService(
        conSuperadministradoresRestantes(0),
      );

      await expect(service.archivar('super-1', 'super-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.usuario.update).not.toHaveBeenCalled();
    });

    it('no deja que el último se BAJE de rol a sí mismo', async () => {
      const { service, prisma } = buildService(
        conSuperadministradoresRestantes(0),
      );

      await expect(
        service.actualizar('super-1', { rol: RolUsuario.COBRADOR }, 'super-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.usuario.update).not.toHaveBeenCalled();
    });

    it('no deja que el último se DESACTIVE a sí mismo', async () => {
      const { service, prisma } = buildService(
        conSuperadministradoresRestantes(0),
      );

      await expect(
        service.actualizar(
          'super-1',
          { estado: EstadoUsuario.INACTIVO },
          'super-1',
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.usuario.update).not.toHaveBeenCalled();
    });

    it('el mensaje dice qué hacer, no solo que no se puede', async () => {
      const { service } = buildService(conSuperadministradoresRestantes(0));

      await expect(service.eliminar('super-1', 'super-1')).rejects.toThrow(
        /Crea otro Superadministrador primero/,
      );
    });

    it('si queda OTRO superadministrador activo, sí se puede', async () => {
      const { service, prisma } = buildService(
        conSuperadministradoresRestantes(1),
      );

      await expect(service.eliminar('super-1', 'super-2')).resolves.toBeDefined();
      expect(prisma.usuario.update).toHaveBeenCalled();
    });

    it('no estorba a los demás roles: un cobrador se archiva sin contar nada', async () => {
      const cobrador = {
        ...SUPER,
        id: 'cobrador-1',
        rol: RolUsuario.COBRADOR,
      };
      const { service, prisma } = buildService({
        usuario: {
          findUnique: jest.fn().mockResolvedValue(cobrador),
          findFirst: jest.fn().mockResolvedValue(null),
          // Cero superadministradores restantes: si la guarda se aplicara a
          // todo el mundo, esto fallaría. No debe aplicarse.
          count: jest.fn().mockResolvedValue(0),
          update: jest.fn().mockResolvedValue(cobrador),
          findMany: jest.fn().mockResolvedValue([]),
        },
      });

      await expect(service.archivar('cobrador-1', 'super-1')).resolves.toBeDefined();
      expect(prisma.usuario.update).toHaveBeenCalled();
    });
  });

  /**
   * Que falte la lista de permisos no es la orden de borrarlos todos.
   *
   * La lista VACIA si lo es, y es legitima. Que el campo no venga significa que
   * no se sabe que se queria, y eso no puede acabar en un borrado.
   *
   * Hacia falta decirlo porque el endpoint recibe `@Body('permisos')` sin DTO:
   * un cuerpo vacio llegaba como `undefined`, la consulta se defendia con
   * `(permisos || [])` pero el registro final leia `permisos.length` a pelo y
   * reventaba con 500 DESPUES del `deleteMany`. Se encontro llamando a las 218
   * rutas con los 7 roles.
   */
  describe('asignarPermisos distingue la lista vacia del hueco', () => {
    const conUsuario = () => ({
      usuario: {
        findUnique: jest.fn().mockResolvedValue({ id: 'u-1', rol: RolUsuario.COBRADOR }),
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(5),
        update: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      permiso: { findMany: jest.fn().mockResolvedValue([]) },
      asignacionPermisoUsuario: {
        deleteMany: jest.fn().mockResolvedValue({ count: 3 }),
        createMany: jest.fn(),
      },
    });

    /**
     * El doble de `$transaction` que trae `buildService` entrega un `tx` con
     * solo dos tablas, y `asignarPermisos` usa `tx.asignacionPermisoUsuario`.
     * Se reemplaza para que el callback reciba las MISMAS funciones espia que
     * se van a comprobar: si se le pasara otro doble, la prueba miraria un
     * objeto y el codigo tocaria otro, y pasaria sin comprobar nada.
     */
    const conTransaccion = (prisma: ReturnType<typeof conUsuario>) => ({
      ...prisma,
      $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(prisma)),
    });

    it('rechaza que NO venga la lista, sin borrar nada', async () => {
      const prisma = conUsuario();
      const { service } = buildService(conTransaccion(prisma));

      await expect(
        service.asignarPermisos('u-1', undefined as unknown as string[]),
      ).rejects.toBeInstanceOf(BadRequestException);

      // Lo que importa: no se llego a tocar la tabla de permisos.
      expect(prisma.asignacionPermisoUsuario.deleteMany).not.toHaveBeenCalled();
    });

    it('el mensaje explica como SI quitarlos todos', async () => {
      const { service } = buildService(conTransaccion(conUsuario()));

      await expect(
        service.asignarPermisos('u-1', undefined as unknown as string[]),
      ).rejects.toThrow(/lista vac/i);
    });

    it('la lista VACIA si borra los personalizados: es una orden valida', async () => {
      const prisma = conUsuario();
      const { service } = buildService(conTransaccion(prisma));

      const resultado = await service.asignarPermisos('u-1', []);

      expect(prisma.asignacionPermisoUsuario.deleteMany).toHaveBeenCalled();
      expect(prisma.asignacionPermisoUsuario.createMany).not.toHaveBeenCalled();
      expect(resultado).toMatchObject({ asignados: 0 });
    });
  });
});
