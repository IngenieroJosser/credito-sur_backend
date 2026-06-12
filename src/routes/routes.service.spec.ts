import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RolUsuario } from '@prisma/client';
import { RoutesService } from './routes.service';

const makeService = (prisma: any) => {
  if (prisma) {
    for (const key of Object.keys(prisma)) {
      const model = prisma[key];
      if (model && typeof model === 'object') {
        if (model.findUnique && !model.findFirst) {
          model.findFirst = model.findUnique;
        } else if (model.findFirst && !model.findUnique) {
          model.findUnique = model.findFirst;
        }
      }
    }
  }
  return new RoutesService(
    prisma,
    {} as any,
    {
      broadcastRutasActualizadas: jest.fn(),
      broadcastDashboardsActualizados: jest.fn(),
      broadcastJornadasActualizadas: jest.fn(),
    } as any,
    {
      create: jest.fn().mockResolvedValue({}),
      notifyRolesDeduped: jest.fn().mockResolvedValue(undefined),
    } as any,
  );
};

describe('RoutesService role scoping', () => {
  it('rejects a collector requesting assigned credits for another collector', async () => {
    const prisma = {
      asignacionRuta: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = makeService(prisma);

    await expect(
      service.listarCreditosAsignadosACobrador('cobrador-ajeno', {
        id: 'cobrador-propio',
        rol: RolUsuario.COBRADOR,
      } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.asignacionRuta.findMany).not.toHaveBeenCalled();
  });

  it('allows supervisors to request assigned credits for a collector', async () => {
    const prisma = {
      asignacionRuta: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = makeService(prisma);

    await expect(
      service.listarCreditosAsignadosACobrador('cobrador-1', {
        id: 'supervisor-1',
        rol: RolUsuario.SUPERVISOR,
      } as any),
    ).resolves.toEqual({ cobradorId: 'cobrador-1', total: 0, data: [] });

    expect(prisma.asignacionRuta.findMany).toHaveBeenCalled();
  });

  it('forces route list queries from collectors to their own user id', async () => {
    const prisma = {
      ruta: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const service = makeService(prisma);

    await service.findAll({ cobradorId: 'cobrador-ajeno', take: 10 }, {
      id: 'cobrador-propio',
      rol: RolUsuario.COBRADOR,
    } as any);

    expect(prisma.ruta.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          eliminadoEn: null,
          cobradorId: 'cobrador-propio',
        }),
      }),
    );
    expect(prisma.ruta.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        eliminadoEn: null,
        cobradorId: 'cobrador-propio',
      }),
    });
  });

  it('forces route list queries from supervisors to assigned routes only', async () => {
    const prisma = {
      ruta: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const service = makeService(prisma);

    await service.findAll({ supervisorId: 'supervisor-ajeno', take: 10 }, {
      id: 'supervisor-propio',
      rol: RolUsuario.SUPERVISOR,
    } as any);

    expect(prisma.ruta.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          eliminadoEn: null,
          supervisorId: 'supervisor-propio',
        }),
      }),
    );
    expect(prisma.ruta.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        eliminadoEn: null,
        supervisorId: 'supervisor-propio',
      }),
    });
  });

  it('forces route list queries from coordinators to assigned routes only', async () => {
    const prisma = {
      ruta: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const service = makeService(prisma);

    await service.findAll({ take: 10 }, {
      id: 'coordinador-propio',
      rol: RolUsuario.COORDINADOR,
    } as any);

    expect(prisma.ruta.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          eliminadoEn: null,
          supervisorId: 'coordinador-propio',
        }),
      }),
    );
    expect(prisma.ruta.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        eliminadoEn: null,
        supervisorId: 'coordinador-propio',
      }),
    });
  });

  it('usa el resumen operativo diario como fuente de verdad para el avance del listado', async () => {
    const prisma = {
      ruta: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'ruta-1',
            nombre: 'Ruta Centro',
            codigo: 'RT-1',
            activa: true,
            cobrador: {
              nombres: 'Cobrador',
              apellidos: 'Prueba',
            },
            supervisor: null,
            asignaciones: [],
            _count: { asignaciones: 1, gastos: 0 },
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
      },
      asignacionRuta: {
        findMany: jest.fn().mockResolvedValue([{ clienteId: 'cliente-1' }]),
        count: jest.fn().mockResolvedValue(0),
      },
      registroVisita: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      pago: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      prestamo: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = makeService(prisma);
    jest
      .spyOn(service as any, 'getCierresPendientesRutasMap')
      .mockResolvedValue(new Map());
    jest.spyOn(service, 'getDailyVisits').mockResolvedValue({
      resumen: {
        recaudoOperativo: 1_043_330,
        meta: 1_555_331,
      },
      visitas: [],
    } as any);

    const resultado = await service.findAll({ take: 10 });
    const ruta = resultado.data[0] as any;

    expect(ruta.cobranzaDelDia).toBe(1_043_330);
    expect(ruta.metaDelDia).toBe(1_555_331);
    expect(ruta.avanceDiario).toBe(67.08);
  });

  it('limits route detail for supervisors to assigned routes only', async () => {
    const prisma = {
      ruta: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const service = makeService(prisma);

    await expect(
      service.findOne('ruta-ajena', {
        id: 'supervisor-propio',
        rol: RolUsuario.SUPERVISOR,
      } as any),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.ruta.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'ruta-ajena',
          eliminadoEn: null,
          supervisorId: 'supervisor-propio',
        }),
      }),
    );
  });

  it('rejects a collector requesting daily visits for a route they do not own', async () => {
    const prisma = {
      ruta: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      asignacionRuta: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = makeService(prisma);

    await expect(
      service.getDailyVisits('ruta-ajena', undefined, {
        id: 'cobrador-propio',
        rol: RolUsuario.COBRADOR,
      } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.ruta.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'ruta-ajena',
        eliminadoEn: null,
        cobradorId: 'cobrador-propio',
      },
      select: { id: true },
    });
    expect(prisma.asignacionRuta.findMany).not.toHaveBeenCalled();
  });

  it('reconstruye la meta de una jornada cuando un ausente registra pago despues', async () => {
    const fechaPago = new Date('2026-06-03T15:00:00.000Z');
    const fechaCuota = new Date('2026-06-03T12:00:00.000Z');
    const prisma = {
      asignacionRuta: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'asig-pendiente',
            ordenVisita: 1,
            cliente: {
              id: 'cliente-pendiente',
              codigo: 'C001',
              dni: '111',
              nombres: 'Cliente',
              apellidos: 'Pendiente',
              telefono: '300',
              direccion: 'Calle 1',
              nivelRiesgo: 'MINIMO',
              prestamos: [
                {
                  id: 'prestamo-pendiente',
                  numeroPrestamo: 'P-1',
                  monto: 564_998,
                  saldoPendiente: 564_998,
                  frecuenciaPago: 'DIARIO',
                  cantidadCuotas: 1,
                  estado: 'ACTIVO',
                  cuotas: [
                    {
                      id: 'cuota-pendiente-1',
                      numeroCuota: 1,
                      fechaVencimiento: new Date('2026-06-02T12:00:00.000Z'),
                      fechaVencimientoProrroga: null,
                      fechaPago: null,
                      monto: 282_499,
                      montoPagado: 0,
                      estado: 'PENDIENTE',
                    },
                    {
                      id: 'cuota-pendiente-2',
                      numeroCuota: 2,
                      fechaVencimiento: fechaCuota,
                      fechaVencimientoProrroga: null,
                      fechaPago: null,
                      monto: 282_499,
                      montoPagado: 0,
                      estado: 'PENDIENTE',
                    },
                  ],
                },
              ],
            },
          },
          {
            id: 'asig-ausente-pagado',
            ordenVisita: 2,
            cliente: {
              id: 'cliente-ausente-pagado',
              codigo: 'C002',
              dni: '222',
              nombres: 'Cliente',
              apellidos: 'Ausente',
              telefono: '301',
              direccion: 'Calle 2',
              nivelRiesgo: 'MINIMO',
              prestamos: [
                {
                  id: 'prestamo-pagado',
                  numeroPrestamo: 'P-2',
                  monto: 425_335,
                  saldoPendiente: 0,
                  frecuenciaPago: 'DIARIO',
                  cantidadCuotas: 1,
                  estado: 'PAGADO',
                  cuotas: [
                    {
                      id: 'cuota-pagada',
                      numeroCuota: 1,
                      fechaVencimiento: fechaCuota,
                      fechaVencimientoProrroga: null,
                      fechaPago,
                      monto: 425_335,
                      montoPagado: 425_335,
                      estado: 'PAGADA',
                    },
                  ],
                },
              ],
            },
          },
        ]),
      },
      registroVisita: {
        findMany: jest.fn().mockResolvedValue([
          {
            clienteId: 'cliente-ausente-pagado',
            estadoVisita: 'ausente',
            notas: 'No estaba en casa',
          },
        ]),
      },
      pago: {
        findMany: jest.fn().mockResolvedValue([
          {
            clienteId: 'cliente-ausente-pagado',
            montoTotal: 425_335,
            fechaPago,
            fechaOperativaRuta: null,
            origenGestion: null,
          },
        ]),
      },
      gasto: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { monto: 0 } }),
      },
    };

    const resultado = await makeService(prisma).getDailyVisits(
      'ruta-1',
      '2026-06-03',
    );

    expect(resultado.resumen.recaudoOperativo).toBe(425_335);
    expect(resultado.resumen.meta).toBe(990_333);
    expect(resultado.resumen.efectividad).toBe(42.9);
    expect(resultado.visitas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cliente: expect.objectContaining({ id: 'cliente-ausente-pagado' }),
          estadoVisita: 'ausente',
          recaudadoDelDia: 425_335,
        }),
      ]),
    );
  });

  it('mantiene como cuota objetivo historica la cuota cubierta por el pago de la jornada', async () => {
    const fechaConsulta = new Date('2026-06-05T12:00:00.000Z');
    const fechaPago = new Date('2026-06-06T15:00:00.000Z');
    const cuotaPagada = {
      id: 'cuota-3',
      numeroCuota: 3,
      fechaVencimiento: new Date('2026-06-04T12:00:00.000Z'),
      fechaVencimientoProrroga: null,
      fechaPago,
      monto: 916_664,
      montoPagado: 916_664,
      estado: 'PAGADA',
    };
    const prisma = {
      asignacionRuta: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'asig-juan',
            ordenVisita: 1,
            cliente: {
              id: 'cliente-juan',
              codigo: 'C003',
              dni: '333',
              nombres: 'Juan Camilo',
              apellidos: 'Marrugo',
              telefono: '302',
              direccion: 'Calle 3',
              nivelRiesgo: 'MINIMO',
              prestamos: [
                {
                  id: 'prestamo-juan',
                  numeroPrestamo: 'P-3',
                  monto: 5_500_000,
                  saldoPendiente: 3_666_672,
                  frecuenciaPago: 'DIARIO',
                  cantidadCuotas: 12,
                  estado: 'ACTIVO',
                  cuotas: [
                    cuotaPagada,
                    {
                      id: 'cuota-4',
                      numeroCuota: 4,
                      fechaVencimiento: fechaConsulta,
                      fechaVencimientoProrroga: null,
                      fechaPago: null,
                      monto: 458_332,
                      montoPagado: 0,
                      estado: 'PENDIENTE',
                    },
                  ],
                },
              ],
            },
          },
        ]),
      },
      registroVisita: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      pago: {
        findMany: jest.fn().mockResolvedValue([
          {
            clienteId: 'cliente-juan',
            prestamoId: 'prestamo-juan',
            montoTotal: 916_664,
            fechaPago,
            fechaOperativaRuta: '2026-06-05',
            origenGestion: 'CIERRE_PENDIENTE',
            metodoPago: 'EFECTIVO',
            detalles: [
              {
                monto: 916_664,
                cuota: cuotaPagada,
              },
            ],
          },
        ]),
      },
      cliente: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      gasto: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { monto: 0 } }),
      },
    };

    const resultado = await makeService(prisma).getDailyVisits(
      'ruta-1',
      '2026-06-05',
    );

    expect(resultado.visitas[0]).toEqual(
      expect.objectContaining({
        recaudadoDelDia: 916_664,
        cuotaObjetivo: expect.objectContaining({
          id: 'cuota-3',
          numeroCuota: 3,
          saldoExigibleEnFechaOperativa: 0,
          cubiertaPorPagoJornada: true,
        }),
        cuotaObjetivoId: 'cuota-3',
      }),
    );
  });

  it('mantiene saldo y acciones disponibles cuando el pago regularizado es parcial', async () => {
    const fechaConsulta = new Date('2026-06-08T12:00:00.000Z');
    const fechaPago = new Date('2026-06-11T15:00:00.000Z');
    const cuotaParcial = {
      id: 'cuota-6',
      numeroCuota: 6,
      fechaVencimiento: fechaConsulta,
      fechaVencimientoProrroga: null,
      fechaPago: null,
      monto: 458_332,
      montoPagado: 20_000,
      estado: 'PARCIAL',
    };
    const prisma = {
      asignacionRuta: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'asig-juan',
            ordenVisita: 1,
            cliente: {
              id: 'cliente-juan',
              codigo: 'C003',
              dni: '333',
              nombres: 'Juan Camilo',
              apellidos: 'Marrugo',
              telefono: '302',
              direccion: 'Calle 3',
              nivelRiesgo: 'MINIMO',
              prestamos: [
                {
                  id: 'prestamo-juan',
                  numeroPrestamo: 'P-3',
                  monto: 5_500_000,
                  saldoPendiente: 3_188_340,
                  frecuenciaPago: 'DIARIO',
                  cantidadCuotas: 12,
                  estado: 'ACTIVO',
                  cuotas: [cuotaParcial],
                },
              ],
            },
          },
        ]),
      },
      registroVisita: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      pago: {
        findMany: jest.fn().mockResolvedValue([
          {
            clienteId: 'cliente-juan',
            prestamoId: 'prestamo-juan',
            montoTotal: 20_000,
            fechaPago,
            fechaOperativaRuta: '2026-06-08',
            origenGestion: 'CIERRE_PENDIENTE',
            metodoPago: 'EFECTIVO',
            detalles: [
              {
                monto: 20_000,
                cuota: cuotaParcial,
              },
            ],
          },
        ]),
      },
      cliente: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      gasto: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { monto: 0 } }),
      },
    };

    const resultado = await makeService(prisma).getDailyVisits(
      'ruta-1',
      '2026-06-08',
    );

    expect(resultado.resumen.recaudoOperativo).toBe(20_000);
    expect(resultado.resumen.meta).toBe(458_332);
    expect(resultado.visitas[0]).toEqual(
      expect.objectContaining({
        recaudadoDelDia: 20_000,
        cuotaObjetivo: expect.objectContaining({
          id: 'cuota-6',
          numeroCuota: 6,
          saldoExigibleEnFechaOperativa: 438_332,
          cubiertaPorPagoJornada: false,
          puedePagar: true,
          puedeReprogramar: true,
          motivoBloqueoPago: null,
        }),
      }),
    );
  });

  it('mantiene la cuota reprogramada de la jornada aunque el préstamo ya apunte a otra cuota', async () => {
    const cuotaPagadaAnterior = {
      id: 'cuota-7',
      numeroCuota: 7,
      fechaVencimiento: new Date('2026-06-09T12:00:00.000Z'),
      fechaVencimientoProrroga: null,
      fechaPago: new Date('2026-06-10T16:00:00.000Z'),
      monto: 43_333,
      montoPagado: 43_333,
      estado: 'PAGADA',
    };
    const cuotaReprogramada = {
      id: 'cuota-8',
      numeroCuota: 8,
      fechaVencimiento: new Date('2026-06-10T12:00:00.000Z'),
      fechaVencimientoProrroga: new Date('2026-06-11T12:00:00.000Z'),
      fechaPago: null,
      monto: 43_333,
      montoPagado: 0,
      estado: 'PRORROGADA',
    };
    const prisma = {
      asignacionRuta: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'asig-epifanio',
            ordenVisita: 4,
            cliente: {
              id: 'cliente-epifanio',
              codigo: 'C002',
              dni: '222',
              nombres: 'Epifanio',
              apellidos: 'Mena',
              telefono: '311',
              direccion: 'Barrio Playita',
              nivelRiesgo: 'MINIMO',
              prestamos: [
                {
                  id: 'prestamo-epifanio',
                  numeroPrestamo: 'ART-000002',
                  monto: 2_600_000,
                  saldoPendiente: 2_296_669,
                  frecuenciaPago: 'DIARIO',
                  cantidadCuotas: 60,
                  estado: 'ACTIVO',
                  cuotas: [cuotaPagadaAnterior, cuotaReprogramada],
                },
              ],
            },
          },
        ]),
      },
      registroVisita: {
        findMany: jest.fn().mockResolvedValue([
          {
            rutaId: 'ruta-1',
            clienteId: 'cliente-epifanio',
            prestamoId: 'prestamo-epifanio',
            cobradorId: 'cobrador-1',
            fechaVisita: '2026-06-10',
            estadoVisita: 'reprogramado',
            notas:
              'Reprogramación solicitada desde cierre pendiente: Reprogramación solicitada',
          },
        ]),
      },
      aprobacion: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'aprobacion-epifanio',
            referenciaId: 'cuota-8',
            estado: 'PENDIENTE',
            creadoEn: new Date('2026-06-11T08:32:00.000Z'),
            datosSolicitud: {
              prestamoId: 'prestamo-epifanio',
              cuotaId: 'cuota-8',
              clienteId: 'cliente-epifanio',
              numeroCuota: 8,
              fechaOperativaRuta: '2026-06-10',
              fechaVencimientoOriginal: '2026-06-10T12:00:00.000-05:00',
              nuevaFecha: '2026-06-11',
              montoCuota: 43_333,
            },
          },
        ]),
      },
      pago: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      cliente: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      gasto: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { monto: 0 } }),
      },
    };

    const resultado = await makeService(prisma).getDailyVisits(
      'ruta-1',
      '2026-06-10',
    );

    expect(resultado.resumen.visitados).toBe(1);
    expect(resultado.visitas[0]).toEqual(
      expect.objectContaining({
        estadoVisita: 'reprogramado',
        cuotaObjetivo: expect.objectContaining({
          id: 'cuota-8',
          numeroCuota: 8,
          esCuotaReprogramadaJornada: true,
          nuevaFechaReprogramada: '2026-06-11',
          saldoExigibleEnFechaOperativa: 0,
          motivoBloqueoPago:
            'La cuota fue reprogramada desde esta jornada pendiente.',
        }),
        cuotaObjetivoId: 'cuota-8',
      }),
    );
  });

  it('muestra como reprogramado un cliente de ruta actual aunque la cuota ya se haya movido al futuro', async () => {
    const cuotaReprogramada = {
      id: 'cuota-8',
      numeroCuota: 8,
      fechaVencimiento: new Date('2026-06-12T12:00:00.000Z'),
      fechaVencimientoProrroga: new Date('2026-06-13T12:00:00.000Z'),
      fechaPago: null,
      monto: 86_666,
      montoPagado: 0,
      estado: 'PRORROGADA',
    };
    const prisma = {
      asignacionRuta: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'asig-epifanio',
            ordenVisita: 4,
            cliente: {
              id: 'cliente-epifanio',
              codigo: 'C002',
              dni: '222',
              nombres: 'Epifanio',
              apellidos: 'Mena',
              telefono: '311',
              direccion: 'Barrio Playita',
              nivelRiesgo: 'LEVE',
              prestamos: [
                {
                  id: 'prestamo-epifanio',
                  numeroPrestamo: 'ART-000002',
                  monto: 2_600_000,
                  saldoPendiente: 2_296_669,
                  frecuenciaPago: 'DIARIO',
                  cantidadCuotas: 60,
                  estado: 'ACTIVO',
                  cuotas: [cuotaReprogramada],
                },
              ],
            },
          },
        ]),
      },
      registroVisita: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      aprobacion: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'aprobacion-epifanio',
            referenciaId: 'cuota-8',
            estado: 'APROBADO',
            creadoEn: new Date('2026-06-12T15:00:00.000Z'),
            datosSolicitud: {
              prestamoId: 'prestamo-epifanio',
              cuotaId: 'cuota-8',
              clienteId: 'cliente-epifanio',
              numeroCuota: 8,
              fechaGestionOriginal: '2026-06-12',
              fechaVencimientoOriginal: '2026-06-12T12:00:00.000-05:00',
              nuevaFecha: '2026-06-13',
              motivo: 'Cliente pidió pagar mañana',
              montoCuota: 86_666,
            },
          },
        ]),
      },
      pago: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      cliente: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      gasto: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { monto: 0 } }),
      },
    };

    const resultado = await makeService(prisma).getDailyVisits(
      'ruta-1',
      '2026-06-12',
    );

    expect(resultado.totalVisitas).toBe(1);
    expect(resultado.resumen.meta).toBe(0);
    expect(resultado.resumen.visitados).toBe(1);
    expect(resultado.visitas[0]).toEqual(
      expect.objectContaining({
        estadoVisita: 'reprogramado',
        cuotaObjetivo: expect.objectContaining({
          id: 'cuota-8',
          numeroCuota: 8,
          saldoExigibleEnFechaOperativa: 0,
          esCuotaReprogramadaJornada: true,
          nuevaFechaReprogramada: '2026-06-13',
        }),
      }),
    );
  });

  it('rejects a collector checking activation for a route they do not own', async () => {
    const prisma = {
      ruta: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      caja: {
        findFirst: jest.fn(),
      },
      transaccion: {
        findFirst: jest.fn(),
      },
    };
    const service = makeService(prisma);

    await expect(
      service.getRutaActivadaHoy('ruta-ajena', {
        id: 'cobrador-propio',
        rol: RolUsuario.COBRADOR,
      } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.ruta.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'ruta-ajena',
        eliminadoEn: null,
        cobradorId: 'cobrador-propio',
      },
      select: { id: true },
    });
    expect(prisma.caja.findFirst).not.toHaveBeenCalled();
    expect(prisma.transaccion.findFirst).not.toHaveBeenCalled();
  });

  it('bloquea la caja y revalida activación dentro de la transacción al activar ruta', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-01T12:00:00.000Z'));

    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      transaccion: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'activacion-existente',
          fechaTransaccion: new Date('2026-06-01T12:00:00.000Z'),
          tipoReferencia: 'ACTIVACION_RUTA',
        }),
        create: jest.fn().mockResolvedValue({ id: 'activacion-nueva' }),
      },
      rutaJornada: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        upsert: jest.fn().mockResolvedValue({ id: 'jornada-1' }),
      },
    };
    const prisma = {
      ruta: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'ruta-1',
            nombre: 'Ruta 1',
            cobradorId: 'cobrador-1',
          })
          .mockResolvedValueOnce({
            id: 'ruta-1',
            nombre: 'Ruta 1',
            cobrador: { id: 'cobrador-1', nombres: 'Cobrador', apellidos: 'Uno' },
            cajas: [{ id: 'caja-ruta-1' }],
          }),
      },
      caja: {
        findFirst: jest.fn().mockResolvedValue({ id: 'caja-ruta-1' }),
      },
      transaccion: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'activacion-fuera' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      rutaJornada: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn().mockImplementation((input: any) => {
        if (typeof input === 'function') {
          return input(tx);
        }
        return Promise.all(input);
      }),
    };

    await makeService(prisma).activarRutaHoy('ruta-1', 'admin-1');

    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.transaccion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          cajaId: 'caja-ruta-1',
        }),
      }),
    );
    expect(tx.transaccion.create).not.toHaveBeenCalled();
    expect(tx.rutaJornada.updateMany).toHaveBeenCalledWith({
      where: {
        rutaId: 'ruta-1',
        estado: 'ABIERTA',
        fechaOperativa: { lt: '2026-06-01' },
      },
      data: { estado: 'PENDIENTE_CIERRE' },
    });
    expect(tx.rutaJornada.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          rutaId_fechaOperativa: {
            rutaId: 'ruta-1',
            fechaOperativa: '2026-06-01',
          },
        },
      }),
    );
    expect(prisma.transaccion.create).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('crea activaciones con idempotencyKey por fecha operativa Bogota', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-12T04:15:00.000Z'));

    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      transaccion: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'activacion-nueva',
          fechaTransaccion: new Date('2026-06-12T04:15:00.000Z'),
          tipoReferencia: 'ACTIVACION_RUTA',
        }),
      },
      rutaJornada: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        upsert: jest.fn().mockResolvedValue({ id: 'jornada-1' }),
      },
    };
    const prisma = {
      ruta: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'ruta-1',
            nombre: 'Ruta 1',
            cobradorId: 'cobrador-1',
          })
          .mockResolvedValueOnce({
            id: 'ruta-1',
            nombre: 'Ruta 1',
            cobrador: { id: 'cobrador-1', nombres: 'Cobrador', apellidos: 'Uno' },
            cajas: [{ id: 'caja-ruta-1' }],
          }),
      },
      caja: {
        findFirst: jest.fn().mockResolvedValue({ id: 'caja-ruta-1' }),
      },
      transaccion: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      rutaJornada: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn().mockImplementation((callback: any) => callback(tx)),
    };

    await makeService(prisma).activarRutaHoy('ruta-1', 'admin-1');

    expect(tx.transaccion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          idempotencyKey: 'ACTIVACION_RUTA:ruta-1:2026-06-11',
        }),
      }),
    );

    jest.useRealTimers();
  });

  it('detecta activaciones antiguas sin RutaJornada como cierres pendientes', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-04T12:00:00.000Z'));

    const prisma = {
      ruta: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'ruta-1',
          nombre: 'Ruta 1',
          cobrador: { id: 'cobrador-1', nombres: 'Cobrador', apellidos: 'Uno' },
          cajas: [{ id: 'caja-ruta-1' }],
        }),
      },
      rutaJornada: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([]),
      },
      transaccion: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            {
              id: 'activacion-yesterday',
              fechaTransaccion: new Date('2026-06-03T14:00:00.000Z'),
            },
          ]),
      },
    };

    const cierre = await makeService(prisma).getCierrePendienteRutaPublic(
      'ruta-1',
      { id: 'admin-1', rol: RolUsuario.ADMIN } as any,
    );

    expect(cierre).toEqual(
      expect.objectContaining({
        pendienteCierre: true,
        fechaOperativa: '2026-06-03',
        activacionId: 'activacion-yesterday',
        origenDeteccion: 'TRANSACCION_ACTIVACION_LEGACY',
      }),
    );

    jest.useRealTimers();
  });

  it('cierra una jornada regularizada detectada desde activación legacy sin RutaJornada', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-04T12:00:00.000Z'));

    const tx = {
      rutaJornada: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'jornada-legacy',
          rutaId: 'ruta-1',
          cajaId: 'caja-ruta-1',
          fechaOperativa: '2026-06-03',
          estado: 'PENDIENTE_CIERRE',
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      ruta: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({ id: 'ruta-1', nombre: 'Ruta 1' })
          .mockResolvedValueOnce({
            id: 'ruta-1',
            nombre: 'Ruta 1',
            cobrador: { id: 'cobrador-1', nombres: 'Cobrador', apellidos: 'Uno' },
            cajas: [{ id: 'caja-ruta-1' }],
          })
          .mockResolvedValueOnce({
            id: 'ruta-1',
            nombre: 'Ruta 1',
            cobrador: { id: 'cobrador-1', nombres: 'Cobrador', apellidos: 'Uno' },
            cajas: [{ id: 'caja-ruta-1' }],
          }),
      },
      rutaJornada: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([]),
      },
      transaccion: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            {
              id: 'activacion-legacy',
              fechaTransaccion: new Date('2026-06-03T14:00:00.000Z'),
            },
          ])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([]),
      },
      notificacion: {
        create: jest.fn().mockResolvedValue({}),
      },
      usuario: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({
          id: 'admin-1',
          nombres: 'Admin',
          apellidos: 'Uno',
          rol: RolUsuario.ADMIN,
        }),
      },
      $transaction: jest.fn().mockImplementation((callback: any) => callback(tx)),
    };
    const service = makeService(prisma);
    jest.spyOn(service as any, 'getDailyVisits').mockResolvedValue({
      resumen: {
        meta: 100000,
        recaudo: 100000,
        recaudoOperativo: 100000,
        gastos: 15000,
        recaudoEfectivo: 60000,
        recaudoTransferencia: 40000,
        netoEfectivoRuta: 45000,
      },
      visitas: [
        {
          recaudadoDelDia: 100000,
          estadoVisita: null,
        },
      ],
    });

    await expect(
      service.cerrarJornadaRegularizada(
        'ruta-1',
        '2026-06-03',
        'Jornada regularizada',
        { id: 'admin-1', rol: RolUsuario.ADMIN } as any,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        success: true,
        jornadaId: 'jornada-legacy',
        fechaOperativa: '2026-06-03',
      }),
    );

    expect(tx.rutaJornada.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        rutaId: 'ruta-1',
        cajaId: 'caja-ruta-1',
        fechaOperativa: '2026-06-03',
        estado: 'PENDIENTE_CIERRE',
        activacionTransaccionId: 'activacion-legacy',
      }),
    });
    expect(tx.rutaJornada.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'jornada-legacy',
        estado: 'PENDIENTE_CIERRE',
      },
      data: expect.objectContaining({
        estado: 'REGULARIZADA',
        cierreTransaccionId: null,
        regularizadaPorId: 'admin-1',
      }),
    });
    expect(
      (service as any).notificacionesService.notifyRolesDeduped,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          tipoEvento: 'JORNADA_PENDIENTE_CERRADA',
          clientesGestionados: 1,
          clientesPagaron: 1,
          recaudoEfectivo: 60000,
          recaudoTransferencia: 40000,
          gastosRuta: 15000,
          netoEfectivoRuta: 45000,
          clientesPagaronDetalle: [
            expect.objectContaining({
              nombreCliente: 'Cliente sin nombre',
              estadoGestion: 'PAGO_REGISTRADO',
              recaudado: 100000,
            }),
          ],
        }),
      }),
    );

    jest.useRealTimers();
  });

  it('bloquea activar ruta en domingo antes de consultar base de datos', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-31T12:00:00.000Z'));

    const prisma = {
      ruta: {
        findFirst: jest.fn(),
      },
      caja: {
        findFirst: jest.fn(),
      },
    };

    await expect(
      makeService(prisma).activarRutaHoy('ruta-1', 'admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.ruta.findFirst).not.toHaveBeenCalled();
    expect(prisma.caja.findFirst).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('reporta ruta no operable en domingo aunque exista caja de ruta', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-31T12:00:00.000Z'));

    const prisma = {
      ruta: {
        findFirst: jest.fn().mockResolvedValue({ id: 'ruta-1' }),
      },
      caja: {
        findFirst: jest.fn().mockResolvedValue({ id: 'caja-ruta-1' }),
      },
      transaccion: {
        findFirst: jest.fn(),
      },
    };

    await expect(makeService(prisma).getRutaActivadaHoy('ruta-1')).resolves.toEqual(
      expect.objectContaining({
        rutaId: 'ruta-1',
        activadaHoy: false,
        operableHoy: false,
        diaNoLaboral: true,
      }),
    );

    expect(prisma.transaccion.findFirst).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('convierte el índice único de asignación activa en ConflictException legible', async () => {
    const tx = {
      asignacionRuta: {
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        aggregate: jest.fn().mockResolvedValue({ _max: { ordenVisita: 0 } }),
        create: jest
          .fn()
          .mockRejectedValue(
            new Prisma.PrismaClientKnownRequestError(
              'Unique constraint failed on active route assignment',
              { code: 'P2002', clientVersion: 'test' },
            ),
          ),
      },
      prestamo: {
        updateMany: jest.fn(),
      },
    };
    const prisma = {
      ruta: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ruta-1',
          nombre: 'Ruta 1',
          cobradorId: 'cobrador-1',
        }),
      },
      cliente: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'cliente-1',
          nombres: 'Ana',
          apellidos: 'Perez',
        }),
      },
      $transaction: jest
        .fn()
        .mockImplementation((input: any) =>
          typeof input === 'function' ? input(tx) : Promise.all(input),
        ),
    };

    await expect(
      makeService(prisma).assignClient('ruta-1', 'cliente-1', 'cobrador-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('asigna clientes usando el cobrador real de la ruta aunque el body traiga otro cobradorId', async () => {
    const tx = {
      asignacionRuta: {
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        aggregate: jest.fn().mockResolvedValue({ _max: { ordenVisita: 0 } }),
        create: jest.fn().mockResolvedValue({
          id: 'asignacion-1',
          clienteId: 'cliente-1',
          cobradorId: 'cobrador-ruta',
          cliente: { nombres: 'Ana', apellidos: 'Perez' },
        }),
      },
      prestamo: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      ruta: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ruta-1',
          nombre: 'Ruta 1',
          cobradorId: 'cobrador-ruta',
        }),
      },
      cliente: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'cliente-1',
          nombres: 'Ana',
          apellidos: 'Perez',
        }),
      },
      $transaction: jest.fn().mockImplementation((cb: any) => cb(tx)),
    };

    await makeService(prisma).assignClient(
      'ruta-1',
      'cliente-1',
      'cobrador-equivocado',
    );

    expect(tx.asignacionRuta.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rutaId: 'ruta-1',
          clienteId: 'cliente-1',
          cobradorId: 'cobrador-ruta',
        }),
      }),
    );
  });

  it('al asignar un cliente a una ruta desactiva asignaciones activas de otras rutas', async () => {
    const tx = {
      asignacionRuta: {
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
        aggregate: jest.fn().mockResolvedValue({ _max: { ordenVisita: 3 } }),
        create: jest.fn().mockResolvedValue({
          id: 'asignacion-nueva',
          clienteId: 'cliente-1',
          cobradorId: 'cobrador-destino',
          cliente: { nombres: 'Ana', apellidos: 'Perez' },
        }),
      },
      prestamo: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      ruta: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ruta-destino',
          nombre: 'Ruta Destino',
          cobradorId: 'cobrador-destino',
        }),
      },
      cliente: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'cliente-1',
          nombres: 'Ana',
          apellidos: 'Perez',
        }),
      },
      $transaction: jest.fn().mockImplementation((cb: any) => cb(tx)),
    };

    await makeService(prisma).assignClient(
      'ruta-destino',
      'cliente-1',
      'cobrador-equivocado',
    );

    expect(tx.asignacionRuta.updateMany).toHaveBeenCalledWith({
      where: { clienteId: 'cliente-1', activa: true },
      data: { activa: false },
    });
    expect(tx.asignacionRuta.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rutaId: 'ruta-destino',
          clienteId: 'cliente-1',
          cobradorId: 'cobrador-destino',
          ordenVisita: 4,
          activa: true,
        }),
      }),
    );
  });

  it('al mover un cliente reutiliza la asignación destino existente y apaga duplicados activos', async () => {
    const tx = {
      asignacionRuta: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'asignacion-destino-existente',
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
        update: jest
          .fn()
          .mockResolvedValue({ id: 'asignacion-destino-existente' }),
        aggregate: jest.fn(),
        create: jest.fn(),
      },
      prestamo: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      ruta: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'ruta-origen',
            nombre: 'Ruta Origen',
            cobradorId: 'cobrador-origen',
          })
          .mockResolvedValueOnce({
            id: 'ruta-destino',
            nombre: 'Ruta Destino',
            cobradorId: 'cobrador-destino',
          }),
      },
      asignacionRuta: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'asignacion-origen',
        }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
      cliente: {
        findUnique: jest.fn().mockResolvedValue({
          nombres: 'Ana',
          apellidos: 'Perez',
        }),
      },
      $transaction: jest
        .fn()
        .mockImplementation((input: any) =>
          typeof input === 'function' ? input(tx) : Promise.all(input),
        ),
    };

    await makeService(prisma).moveClient(
      'cliente-1',
      'ruta-origen',
      'ruta-destino',
    );

    expect(tx.asignacionRuta.updateMany).toHaveBeenCalledWith({
      where: {
        clienteId: 'cliente-1',
        activa: true,
        id: { not: 'asignacion-destino-existente' },
      },
      data: { activa: false },
    });
    expect(tx.asignacionRuta.update).toHaveBeenCalledWith({
      where: { id: 'asignacion-destino-existente' },
      data: {
        cobradorId: 'cobrador-destino',
        activa: true,
      },
    });
    expect(tx.asignacionRuta.create).not.toHaveBeenCalled();
  });

  it('al mover un crédito no deja al cliente activo en dos rutas', async () => {
    const tx = {
      asignacionRuta: {
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        aggregate: jest.fn().mockResolvedValue({ _max: { ordenVisita: 2 } }),
        create: jest.fn().mockResolvedValue({ id: 'asignacion-nueva' }),
        update: jest.fn(),
      },
    };
    const prisma = {
      prestamo: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'prestamo-1',
          clienteId: 'cliente-1',
          frecuenciaPago: 'DIARIO',
          estado: 'ACTIVO',
        }),
      },
      ruta: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ruta-destino',
          nombre: 'Ruta Destino',
          cobradorId: 'cobrador-destino',
        }),
      },
      cliente: {
        findUnique: jest.fn().mockResolvedValue({
          nombres: 'Ana',
          apellidos: 'Perez',
        }),
      },
      $transaction: jest.fn().mockImplementation((cb: any) => cb(tx)),
    };

    await makeService(prisma).moveLoan('prestamo-1', 'ruta-destino');

    expect(tx.asignacionRuta.updateMany).toHaveBeenCalledWith({
      where: {
        clienteId: 'cliente-1',
        activa: true,
      },
      data: { activa: false },
    });
    expect(tx.asignacionRuta.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        rutaId: 'ruta-destino',
        clienteId: 'cliente-1',
        cobradorId: 'cobrador-destino',
        ordenVisita: 3,
        activa: true,
      }),
    });
  });

  it('al cambiar el cobrador de una ruta sincroniza asignaciones activas y responsable de caja', async () => {
    const tx = {
      ruta: {
        update: jest.fn().mockResolvedValue({
          id: 'ruta-1',
          codigo: 'R-1',
          nombre: 'Ruta 1',
          cobradorId: 'cobrador-nuevo',
          cobrador: {
            id: 'cobrador-nuevo',
            nombres: 'Nuevo',
            apellidos: 'Cobrador',
          },
          supervisor: null,
        }),
      },
      asignacionRuta: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      caja: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      ruta: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ruta-1',
          codigo: 'R-1',
          nombre: 'Ruta 1',
          cobradorId: 'cobrador-anterior',
        }),
        update: jest.fn(),
      },
      usuario: {
        findUnique: jest.fn().mockResolvedValue({ id: 'cobrador-nuevo' }),
      },
      $transaction: jest.fn().mockImplementation((cb: any) => cb(tx)),
    };

    await makeService(prisma).update('ruta-1', {
      cobradorId: 'cobrador-nuevo',
    } as any);

    expect(tx.ruta.update).toHaveBeenCalled();
    expect(tx.asignacionRuta.updateMany).toHaveBeenCalledWith({
      where: { rutaId: 'ruta-1', activa: true },
      data: { cobradorId: 'cobrador-nuevo' },
    });
    expect(tx.caja.updateMany).toHaveBeenCalledWith({
      where: { rutaId: 'ruta-1', tipo: 'RUTA', activa: true },
      data: { responsableId: 'cobrador-nuevo' },
    });
  });
});
