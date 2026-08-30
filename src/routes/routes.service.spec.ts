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
  it('incluye obligaciones pendientes de revisión y excluye préstamos rechazados en daily visits', async () => {
    const prisma = {
      asignacionRuta: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'asig-provisional',
            ordenVisita: 1,
            cliente: {
              id: 'cliente-provisional',
              codigo: 'C-PROV',
              dni: '111',
              nombres: 'Cliente',
              apellidos: 'Provisional',
              telefono: '300',
              direccion: 'Calle 1',
              nivelRiesgo: 'MINIMO',
              prestamos: [
                {
                  id: 'prestamo-pendiente',
                  numeroPrestamo: 'PEND-1',
                  monto: 300_000,
                  saldoPendiente: 300_000,
                  frecuenciaPago: 'DIARIO',
                  cantidadCuotas: 3,
                  estado: 'PENDIENTE_APROBACION',
                  estadoAprobacion: 'PENDIENTE',
                  efectoProvisional: { estado: 'PENDIENTE_REVISION' },
                  cuotas: [
                    {
                      id: 'cuota-pendiente',
                      numeroCuota: 1,
                      fechaVencimiento: new Date('2026-06-12T12:00:00.000Z'),
                      fechaVencimientoProrroga: null,
                      fechaPago: null,
                      monto: 100_000,
                      montoPagado: 0,
                      estado: 'PENDIENTE',
                    },
                  ],
                },
                {
                  id: 'prestamo-rechazado',
                  numeroPrestamo: 'RECH-1',
                  monto: 600_000,
                  saldoPendiente: 600_000,
                  frecuenciaPago: 'DIARIO',
                  cantidadCuotas: 3,
                  estado: 'PENDIENTE_APROBACION',
                  estadoAprobacion: 'RECHAZADO',
                  cuotas: [
                    {
                      id: 'cuota-rechazada',
                      numeroCuota: 1,
                      fechaVencimiento: new Date('2026-06-12T12:00:00.000Z'),
                      fechaVencimientoProrroga: null,
                      fechaPago: null,
                      monto: 200_000,
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

    expect(resultado.resumen.meta).toBe(100_000);
    expect(resultado.resumen.total).toBe(1);
    expect(resultado.obligaciones).toHaveLength(1);
    expect(resultado.obligaciones[0]).toMatchObject({
      prestamoId: 'prestamo-pendiente',
      montoMetaOperativaPendiente: 100_000,
      esProvisional: true,
      estadoAprobacion: 'PENDIENTE',
      estadoEfectoProvisional: 'PENDIENTE_REVISION',
      etiquetaRevision: 'Pendiente de revisión',
    });
    expect(resultado.obligaciones).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ prestamoId: 'prestamo-rechazado' }),
      ]),
    );
  });

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

  it('deja que el coordinador vea todas las rutas, sin filtrar por supervisor', async () => {
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

    // Decisión de producto: a diferencia de supervisor y cobrador, el
    // coordinador tiene visibilidad total sobre las rutas.
    const argumentos = prisma.ruta.findMany.mock.calls[0][0];
    expect(argumentos.where).toEqual({ eliminadoEn: null });
    expect(argumentos.where).not.toHaveProperty('supervisorId');
    expect(argumentos.where).not.toHaveProperty('cobradorId');
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
    const ruta = resultado.data[0];

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
    expect(resultado.resumen.meta).toBe(707_834);
    expect(resultado.resumen.efectividad).toBe(60.1);
    expect(resultado.obligaciones).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          prestamoId: 'prestamo-pendiente',
          montoMetaOperativaPendiente: 282_499,
        }),
        // La meta del día no baja porque el cliente haya pagado: el resumen
        // de arriba (707.834) es justamente la suma de estas dos metas.
        expect.objectContaining({
          prestamoId: 'prestamo-pagado',
          montoMetaOperativaPendiente: 425_335,
          recaudadoDelDia: 425_335,
        }),
      ]),
    );
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
    expect(prisma.aprobacion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tipoAprobacion: 'REPROGRAMACION_CUOTA',
          estado: { in: ['PENDIENTE', 'APROBADO'] },
        }),
      }),
    );
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

  it('no propaga una reprogramación a otros créditos activos del mismo cliente', async () => {
    const cuotaCreditoViejo = {
      id: 'cuota-vieja-8',
      numeroCuota: 8,
      fechaVencimiento: new Date('2026-06-12T12:00:00.000Z'),
      fechaVencimientoProrroga: null,
      fechaPago: null,
      monto: 86_666,
      montoPagado: 0,
      estado: 'VENCIDA',
    };
    const cuotaCreditoNuevo = {
      id: 'cuota-nueva-1',
      numeroCuota: 1,
      fechaVencimiento: new Date('2026-06-12T12:00:00.000Z'),
      fechaVencimientoProrroga: null,
      fechaPago: null,
      monto: 33_333,
      montoPagado: 0,
      estado: 'PENDIENTE',
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
                  id: 'prestamo-viejo',
                  numeroPrestamo: 'ART-000002',
                  monto: 2_600_000,
                  saldoPendiente: 2_296_669,
                  frecuenciaPago: 'DIARIO',
                  cantidadCuotas: 60,
                  estado: 'ACTIVO',
                  cuotas: [cuotaCreditoViejo],
                },
                {
                  id: 'prestamo-nuevo',
                  numeroPrestamo: 'ART-000003',
                  monto: 2_000_000,
                  saldoPendiente: 2_000_000,
                  frecuenciaPago: 'DIARIO',
                  cantidadCuotas: 60,
                  estado: 'ACTIVO',
                  cuotas: [cuotaCreditoNuevo],
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
            id: 'aprobacion-epifanio-viejo',
            referenciaId: 'cuota-vieja-8',
            estado: 'APROBADO',
            creadoEn: new Date('2026-06-12T15:00:00.000Z'),
            datosSolicitud: {
              prestamoId: 'prestamo-viejo',
              cuotaId: 'cuota-vieja-8',
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

    expect(resultado.totalVisitas).toBe(2);
    expect(resultado.resumen.meta).toBe(33_333);
    expect(resultado.resumen.visitados).toBe(1);
    expect(resultado.visitas).toHaveLength(1);
    expect(resultado.obligaciones).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          prestamoId: 'prestamo-viejo',
          estadoGestion: 'REPROGRAMADO',
          montoMetaOperativaPendiente: 0,
        }),
        expect.objectContaining({
          prestamoId: 'prestamo-nuevo',
          estadoGestion: 'PENDIENTE',
          montoMetaOperativaPendiente: 33_333,
        }),
      ]),
    );
    expect(resultado.visitas[0]).toEqual(
      expect.objectContaining({
        prestamoObjetivoId: 'prestamo-nuevo',
        estadoVisita: null,
        cuotaObjetivo: expect.objectContaining({
          id: 'cuota-nueva-1',
          saldoExigibleEnFechaOperativa: 33_333,
        }),
      }),
    );
    expect(resultado.visitas[0].prestamos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'prestamo-viejo',
          montoMetaOperativaPendiente: 0,
          cuotaObjetivo: expect.objectContaining({
            id: 'cuota-vieja-8',
            esCuotaReprogramadaJornada: true,
          }),
        }),
        expect.objectContaining({
          id: 'prestamo-nuevo',
          montoMetaOperativaPendiente: 33_333,
          cuotaObjetivo: expect.objectContaining({
            id: 'cuota-nueva-1',
          }),
        }),
      ]),
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
            cobrador: {
              id: 'cobrador-1',
              nombres: 'Cobrador',
              apellidos: 'Uno',
            },
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
            cobrador: {
              id: 'cobrador-1',
              nombres: 'Cobrador',
              apellidos: 'Uno',
            },
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
      $transaction: jest
        .fn()
        .mockImplementation((callback: any) => callback(tx)),
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
        findMany: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]),
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
            cobrador: {
              id: 'cobrador-1',
              nombres: 'Cobrador',
              apellidos: 'Uno',
            },
            cajas: [{ id: 'caja-ruta-1' }],
          })
          .mockResolvedValueOnce({
            id: 'ruta-1',
            nombre: 'Ruta 1',
            cobrador: {
              id: 'cobrador-1',
              nombres: 'Cobrador',
              apellidos: 'Uno',
            },
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
      $transaction: jest
        .fn()
        .mockImplementation((callback: any) => callback(tx)),
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

  describe('cerrarJornadaRegularizada', () => {
    it('permite regularizar jornada pendiente sin arqueo', async () => {
      const prisma = {
        ruta: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ id: 'ruta-1', nombre: 'Ruta 1' }),
        },
        rutaJornada: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'jornada-1',
            rutaId: 'ruta-1',
            cajaId: 'caja-ruta-1',
            fechaOperativa: '2026-06-13',
            estado: 'PENDIENTE_CIERRE',
          }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        arqueoCaja: {
          findUnique: jest.fn().mockResolvedValue(null), // Sin arqueo
        },
        usuario: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'admin-1',
            nombres: 'Admin',
            apellidos: 'Uno',
            correo: 'admin@test.com',
          }),
        },
        $transaction: jest.fn().mockImplementation((callback: any) => {
          const tx = {
            rutaJornada: {
              findUnique: jest.fn().mockResolvedValue({
                id: 'jornada-1',
                rutaId: 'ruta-1',
                cajaId: 'caja-ruta-1',
                fechaOperativa: '2026-06-13',
                estado: 'PENDIENTE_CIERRE',
              }),
              updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            arqueoCaja: {
              findUnique: jest.fn().mockResolvedValue(null),
            },
            usuario: {
              findUnique: jest.fn().mockResolvedValue({
                id: 'admin-1',
                nombres: 'Admin',
                apellidos: 'Uno',
                correo: 'admin@test.com',
              }),
            },
          };
          return callback(tx);
        }),
      };

      const service = makeService(prisma);
      jest.spyOn(service as any, 'getDailyVisits').mockResolvedValue({
        resumen: { meta: 100000, recaudo: 100000, recaudoOperativo: 100000 },
        visitas: [],
      });
      jest
        .spyOn(service as any, 'getCierresPendientesRuta')
        .mockResolvedValue([]);

      await expect(
        service.cerrarJornadaRegularizada(
          'ruta-1',
          '2026-06-13',
          'Jornada regularizada',
          { id: 'admin-1', rol: RolUsuario.ADMIN } as any,
        ),
      ).resolves.toEqual(
        expect.objectContaining({
          jornadaId: 'jornada-1',
        }),
      );
    });

    it('no permite regularizar jornada anulada', async () => {
      const prisma = {
        ruta: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ id: 'ruta-1', nombre: 'Ruta 1' }),
        },
        $transaction: jest.fn().mockImplementation((callback: any) => {
          const tx = {
            rutaJornada: {
              findUnique: jest.fn().mockResolvedValue({
                id: 'jornada-1',
                estado: 'ANULADA',
              }),
            },
          };
          return callback(tx);
        }),
      };

      const service = makeService(prisma);
      jest.spyOn(service as any, 'getDailyVisits').mockResolvedValue({
        resumen: { meta: 100000, recaudo: 100000 },
        visitas: [],
      });
      jest
        .spyOn(service as any, 'getCierresPendientesRuta')
        .mockResolvedValue([]);

      await expect(
        service.cerrarJornadaRegularizada(
          'ruta-1',
          '2026-06-13',
          'Jornada regularizada',
          { id: 'admin-1', rol: RolUsuario.ADMIN } as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('no permite regularizar jornada ya cerrada o regularizada', async () => {
      const prisma = {
        ruta: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ id: 'ruta-1', nombre: 'Ruta 1' }),
        },
        $transaction: jest.fn().mockImplementation((callback: any) => {
          const tx = {
            rutaJornada: {
              findUnique: jest.fn().mockResolvedValue({
                id: 'jornada-1',
                estado: 'REGULARIZADA',
              }),
            },
          };
          return callback(tx);
        }),
      };

      const service = makeService(prisma);
      jest.spyOn(service as any, 'getDailyVisits').mockResolvedValue({
        resumen: { meta: 100000, recaudo: 100000 },
        visitas: [],
      });
      jest
        .spyOn(service as any, 'getCierresPendientesRuta')
        .mockResolvedValue([]);

      await expect(
        service.cerrarJornadaRegularizada(
          'ruta-1',
          '2026-06-13',
          'Jornada regularizada',
          { id: 'admin-1', rol: RolUsuario.ADMIN } as any,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('exige observación cuando hay pendientes, ausencias o descuadre', async () => {
      const prisma = {
        ruta: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ id: 'ruta-1', nombre: 'Ruta 1' }),
        },
        $transaction: jest.fn().mockImplementation((callback: any) => {
          const tx = {
            rutaJornada: {
              findUnique: jest.fn().mockResolvedValue({
                id: 'jornada-1',
                estado: 'PENDIENTE_CIERRE',
              }),
            },
          };
          return callback(tx);
        }),
      };

      const service = makeService(prisma);
      jest.spyOn(service as any, 'getDailyVisits').mockResolvedValue({
        resumen: { meta: 100000, recaudo: 50000, recaudoOperativo: 50000 }, // Descuadre
        visitas: [{ estadoGestion: 'PENDIENTE' }],
      });
      jest
        .spyOn(service as any, 'getCierresPendientesRuta')
        .mockResolvedValue([]);

      await expect(
        service.cerrarJornadaRegularizada(
          'ruta-1',
          '2026-06-13',
          undefined, // Sin observación
          { id: 'admin-1', rol: RolUsuario.ADMIN } as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('no exige observación cuando la jornada está limpia', async () => {
      const prisma = {
        ruta: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ id: 'ruta-1', nombre: 'Ruta 1' }),
        },
        rutaJornada: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'jornada-1',
            estado: 'PENDIENTE_CIERRE',
          }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        usuario: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'admin-1',
            nombres: 'Admin',
            apellidos: 'Uno',
            correo: 'admin@test.com',
          }),
        },
        $transaction: jest.fn().mockImplementation((callback: any) => {
          const tx = {
            rutaJornada: {
              findUnique: jest.fn().mockResolvedValue({
                id: 'jornada-1',
                estado: 'PENDIENTE_CIERRE',
              }),
              updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            usuario: {
              findUnique: jest.fn().mockResolvedValue({
                id: 'admin-1',
                nombres: 'Admin',
                apellidos: 'Uno',
                correo: 'admin@test.com',
              }),
            },
          };
          return callback(tx);
        }),
      };

      const service = makeService(prisma);
      jest.spyOn(service as any, 'getDailyVisits').mockResolvedValue({
        resumen: { meta: 100000, recaudo: 100000, recaudoOperativo: 100000 },
        visitas: [],
      });
      jest
        .spyOn(service as any, 'getCierresPendientesRuta')
        .mockResolvedValue([]);

      await expect(
        service.cerrarJornadaRegularizada(
          'ruta-1',
          '2026-06-13',
          undefined, // Sin observación, pero jornada está limpia
          { id: 'admin-1', rol: RolUsuario.ADMIN } as any,
        ),
      ).resolves.toEqual(
        expect.objectContaining({
          jornadaId: 'jornada-1',
        }),
      );
    });

    it('no crea transacción financiera al regularizar', async () => {
      const prisma = {
        ruta: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ id: 'ruta-1', nombre: 'Ruta 1' }),
        },
        rutaJornada: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'jornada-1',
            estado: 'PENDIENTE_CIERRE',
          }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        transaccion: {
          create: jest.fn().mockResolvedValue({}),
        },
        usuario: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'admin-1',
            nombres: 'Admin',
            apellidos: 'Uno',
            correo: 'admin@test.com',
          }),
        },
        $transaction: jest.fn().mockImplementation((callback: any) => {
          const tx = {
            rutaJornada: {
              findUnique: jest.fn().mockResolvedValue({
                id: 'jornada-1',
                estado: 'PENDIENTE_CIERRE',
              }),
              updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            transaccion: {
              create: jest.fn().mockResolvedValue({}),
            },
            usuario: {
              findUnique: jest.fn().mockResolvedValue({
                id: 'admin-1',
                nombres: 'Admin',
                apellidos: 'Uno',
                correo: 'admin@test.com',
              }),
            },
          };
          return callback(tx);
        }),
      };

      const service = makeService(prisma);
      jest.spyOn(service as any, 'getDailyVisits').mockResolvedValue({
        resumen: { meta: 100000, recaudo: 100000 },
        visitas: [],
      });
      jest
        .spyOn(service as any, 'getCierresPendientesRuta')
        .mockResolvedValue([]);

      await service.cerrarJornadaRegularizada(
        'ruta-1',
        '2026-06-13',
        'Jornada regularizada',
        { id: 'admin-1', rol: RolUsuario.ADMIN } as any,
      );

      // Verificar que no se creó transacción financiera
      expect(prisma.transaccion?.create).not.toHaveBeenCalled();
    });

    it('no crea JournalEntry al regularizar', async () => {
      const prisma = {
        ruta: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ id: 'ruta-1', nombre: 'Ruta 1' }),
        },
        rutaJornada: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'jornada-1',
            estado: 'PENDIENTE_CIERRE',
          }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        journalEntry: {
          create: jest.fn().mockResolvedValue({}),
        },
        usuario: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'admin-1',
            nombres: 'Admin',
            apellidos: 'Uno',
            correo: 'admin@test.com',
          }),
        },
        $transaction: jest.fn().mockImplementation((callback: any) => {
          const tx = {
            rutaJornada: {
              findUnique: jest.fn().mockResolvedValue({
                id: 'jornada-1',
                estado: 'PENDIENTE_CIERRE',
              }),
              updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            journalEntry: {
              create: jest.fn().mockResolvedValue({}),
            },
            usuario: {
              findUnique: jest.fn().mockResolvedValue({
                id: 'admin-1',
                nombres: 'Admin',
                apellidos: 'Uno',
                correo: 'admin@test.com',
              }),
            },
          };
          return callback(tx);
        }),
      };

      const service = makeService(prisma);
      jest.spyOn(service as any, 'getDailyVisits').mockResolvedValue({
        resumen: { meta: 100000, recaudo: 100000 },
        visitas: [],
      });
      jest
        .spyOn(service as any, 'getCierresPendientesRuta')
        .mockResolvedValue([]);

      await service.cerrarJornadaRegularizada(
        'ruta-1',
        '2026-06-13',
        'Jornada regularizada',
        { id: 'admin-1', rol: RolUsuario.ADMIN } as any,
      );

      // Verificar que no se creó JournalEntry
      expect(prisma.journalEntry?.create).not.toHaveBeenCalled();
    });
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

    await expect(
      makeService(prisma).getRutaActivadaHoy('ruta-1'),
    ).resolves.toEqual(
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

  // ── Rutas por crédito ────────────────────────────────────────────────────
  // La ruta la lleva el crédito, no el cliente: un cliente puede tener el
  // crédito A en una ruta y el B en otra, y varios créditos en la misma.
  // Estas pruebas usan una base falsa en memoria en lugar de comprobar
  // llamadas, porque lo que importa es en qué rutas acaba el cliente.
  const baseFalsa = (opciones: {
    prestamos: Array<{ id: string; clienteId: string; rutaId: string | null }>;
    asignaciones?: Array<{
      id: string;
      rutaId: string;
      clienteId: string;
      activa: boolean;
    }>;
    rutas?: Array<{ id: string; cobradorId: string }>;
  }) => {
    const prestamos = opciones.prestamos.map((p) => ({ ...p }));
    const asignaciones = (opciones.asignaciones || []).map((a) => ({
      ...a,
      cobradorId: 'cobrador-x',
      ordenVisita: 1,
      creadoEn: new Date(),
    }));
    const rutas = opciones.rutas || [
      { id: 'ruta-a', cobradorId: 'cobrador-a' },
      { id: 'ruta-b', cobradorId: 'cobrador-b' },
    ];

    const cumple = (fila: any, where: any = {}): boolean =>
      Object.entries(where).every(([campo, valor]: [string, any]) => {
        // Un campo ausente en el falso equivale a null, como en la base.
        const actual = fila[campo] ?? null;
        if (valor && typeof valor === 'object') {
          if ('not' in valor) return actual !== (valor.not ?? null);
          if ('in' in valor) return valor.in.includes(actual);
        }
        return actual === (valor ?? null);
      });

    let siguienteId = 1;

    const tx: any = {
      prestamo: {
        findMany: jest.fn(async ({ where, distinct }: any) => {
          let filas = prestamos.filter((p) => cumple(p, where));
          if (distinct?.includes('rutaId')) {
            const vistos = new Set();
            filas = filas.filter((p) =>
              vistos.has(p.rutaId) ? false : vistos.add(p.rutaId),
            );
          }
          return filas.map((p) => ({ ...p }));
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const fila = prestamos.find((p) => p.id === where.id);
          Object.assign(fila as any, data);
          return { ...(fila as any) };
        }),
        updateMany: jest.fn(async ({ where, data }: any) => {
          const filas = prestamos.filter((p) => cumple(p, where));
          filas.forEach((p) => Object.assign(p, data));
          return { count: filas.length };
        }),
      },
      asignacionRuta: {
        findMany: jest.fn(async ({ where }: any = {}) =>
          asignaciones.filter((a) => cumple(a, where)).map((a) => ({ ...a })),
        ),
        findFirst: jest.fn(async ({ where }: any = {}) => {
          const fila = asignaciones.find((a) => cumple(a, where));
          return fila ? { ...fila } : null;
        }),
        findFirstOrThrow: jest.fn(async ({ where }: any = {}) => {
          const fila = asignaciones.find((a) => cumple(a, where));
          if (!fila) throw new Error('no encontrada');
          return { ...fila, cliente: { id: fila.clienteId } };
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const fila = asignaciones.find((a) => a.id === where.id);
          Object.assign(fila as any, data);
          return { ...(fila as any) };
        }),
        updateMany: jest.fn(async ({ where, data }: any) => {
          const filas = asignaciones.filter((a) => cumple(a, where));
          filas.forEach((a) => Object.assign(a, data));
          return { count: filas.length };
        }),
        aggregate: jest.fn(async () => ({ _max: { ordenVisita: 1 } })),
        create: jest.fn(async ({ data }: any) => {
          const fila = {
            id: `asignacion-${siguienteId++}`,
            creadoEn: new Date(),
            ...data,
          };
          asignaciones.push(fila);
          return { ...fila, cliente: { id: fila.clienteId } };
        }),
      },
      ruta: {
        findUnique: jest.fn(async ({ where }: any) => {
          const fila = rutas.find((r) => r.id === where.id);
          return fila ? { ...fila } : null;
        }),
      },
    };

    return {
      tx,
      prestamos,
      asignaciones,
      rutasActivasDe: (clienteId: string) =>
        asignaciones
          .filter((a) => a.clienteId === clienteId && a.activa)
          .map((a) => a.rutaId)
          .sort(),
    };
  };

  it('al mover un crédito el cliente queda activo en las dos rutas', async () => {
    const falsa = baseFalsa({
      prestamos: [
        { id: 'prestamo-1', clienteId: 'cliente-1', rutaId: 'ruta-a' },
        { id: 'prestamo-2', clienteId: 'cliente-1', rutaId: 'ruta-a' },
      ],
      asignaciones: [
        {
          id: 'asignacion-a',
          rutaId: 'ruta-a',
          clienteId: 'cliente-1',
          activa: true,
        },
      ],
    });

    const prisma = {
      prestamo: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'prestamo-2',
          clienteId: 'cliente-1',
          frecuenciaPago: 'DIARIO',
          estado: 'ACTIVO',
        }),
      },
      ruta: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'ruta-b',
          nombre: 'Ruta B',
          cobradorId: 'cobrador-b',
        }),
      },
      cliente: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ nombres: 'Ana', apellidos: 'Perez' }),
      },
      $transaction: jest.fn().mockImplementation((cb: any) => cb(falsa.tx)),
    };

    await makeService(prisma).moveLoan('prestamo-2', 'ruta-b');

    // El crédito movido cambia de ruta; el otro se queda donde estaba.
    expect(falsa.prestamos.find((p) => p.id === 'prestamo-2')?.rutaId).toBe(
      'ruta-b',
    );
    expect(falsa.prestamos.find((p) => p.id === 'prestamo-1')?.rutaId).toBe(
      'ruta-a',
    );

    // Y el cliente sigue en la ruta de origen, porque le queda un crédito ahí.
    expect(falsa.rutasActivasDe('cliente-1')).toEqual(['ruta-a', 'ruta-b']);
  });

  it('al mover el último crédito de una ruta el cliente sale de ella', async () => {
    const falsa = baseFalsa({
      prestamos: [{ id: 'prestamo-1', clienteId: 'cliente-1', rutaId: 'ruta-a' }],
      asignaciones: [
        {
          id: 'asignacion-a',
          rutaId: 'ruta-a',
          clienteId: 'cliente-1',
          activa: true,
        },
      ],
    });

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
        findFirst: jest.fn().mockResolvedValue({
          id: 'ruta-b',
          nombre: 'Ruta B',
          cobradorId: 'cobrador-b',
        }),
      },
      cliente: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ nombres: 'Ana', apellidos: 'Perez' }),
      },
      $transaction: jest.fn().mockImplementation((cb: any) => cb(falsa.tx)),
    };

    await makeService(prisma).moveLoan('prestamo-1', 'ruta-b');

    expect(falsa.rutasActivasDe('cliente-1')).toEqual(['ruta-b']);
  });

  it('asignar un cliente a una ruta mueve todos sus créditos a esa ruta', async () => {
    const falsa = baseFalsa({
      prestamos: [
        { id: 'prestamo-1', clienteId: 'cliente-1', rutaId: 'ruta-a' },
        { id: 'prestamo-2', clienteId: 'cliente-1', rutaId: 'ruta-b' },
      ],
      asignaciones: [
        {
          id: 'asignacion-a',
          rutaId: 'ruta-a',
          clienteId: 'cliente-1',
          activa: true,
        },
        {
          id: 'asignacion-b',
          rutaId: 'ruta-b',
          clienteId: 'cliente-1',
          activa: true,
        },
      ],
    });

    const prisma = {
      ruta: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'ruta-b',
          nombre: 'Ruta B',
          cobradorId: 'cobrador-b',
        }),
      },
      cliente: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'cliente-1',
          nombres: 'Ana',
          apellidos: 'Perez',
        }),
      },
      $transaction: jest.fn().mockImplementation((cb: any) => cb(falsa.tx)),
    };

    await makeService(prisma).assignClient(
      'ruta-b',
      'cliente-1',
      'cobrador-equivocado',
    );

    expect(falsa.prestamos.every((p) => p.rutaId === 'ruta-b')).toBe(true);
    expect(falsa.rutasActivasDe('cliente-1')).toEqual(['ruta-b']);
  });

  it('asigna clientes usando el cobrador real de la ruta aunque el body traiga otro cobradorId', async () => {
    const falsa = baseFalsa({
      prestamos: [{ id: 'prestamo-1', clienteId: 'cliente-1', rutaId: null }],
    });

    const prisma = {
      ruta: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'ruta-b',
          nombre: 'Ruta B',
          cobradorId: 'cobrador-b',
        }),
      },
      cliente: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'cliente-1',
          nombres: 'Ana',
          apellidos: 'Perez',
        }),
      },
      $transaction: jest.fn().mockImplementation((cb: any) => cb(falsa.tx)),
    };

    await makeService(prisma).assignClient(
      'ruta-b',
      'cliente-1',
      'cobrador-equivocado',
    );

    const asignacion = falsa.asignaciones.find(
      (a) => a.clienteId === 'cliente-1' && a.activa,
    );
    expect(asignacion?.rutaId).toBe('ruta-b');
    expect((asignacion as any)?.cobradorId).toBe('cobrador-b');
  });

  it('al mover un cliente solo se llevan los créditos de la ruta de origen', async () => {
    const falsa = baseFalsa({
      prestamos: [
        { id: 'prestamo-1', clienteId: 'cliente-1', rutaId: 'ruta-a' },
        { id: 'prestamo-2', clienteId: 'cliente-1', rutaId: 'ruta-c' },
      ],
      asignaciones: [
        {
          id: 'asignacion-a',
          rutaId: 'ruta-a',
          clienteId: 'cliente-1',
          activa: true,
        },
        {
          id: 'asignacion-c',
          rutaId: 'ruta-c',
          clienteId: 'cliente-1',
          activa: true,
        },
      ],
      rutas: [
        { id: 'ruta-a', cobradorId: 'cobrador-a' },
        { id: 'ruta-b', cobradorId: 'cobrador-b' },
        { id: 'ruta-c', cobradorId: 'cobrador-c' },
      ],
    });

    const prisma = {
      ruta: {
        findFirst: jest.fn().mockImplementation(({ where }: any) =>
          Promise.resolve({
            id: where.id,
            nombre: `Ruta ${where.id}`,
            cobradorId: where.id === 'ruta-b' ? 'cobrador-b' : 'cobrador-a',
          }),
        ),
      },
      asignacionRuta: {
        findFirst: jest.fn().mockResolvedValue({ id: 'asignacion-a' }),
      },
      cliente: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ nombres: 'Ana', apellidos: 'Perez' }),
      },
      $transaction: jest.fn().mockImplementation((cb: any) => cb(falsa.tx)),
      asignacionRutaReorder: jest.fn(),
    };

    const servicio = makeService(prisma);
    (servicio as any).reorderAssignments = jest.fn();

    await servicio.moveClient('cliente-1', 'ruta-a', 'ruta-b');

    expect(falsa.prestamos.find((p) => p.id === 'prestamo-1')?.rutaId).toBe(
      'ruta-b',
    );
    expect(falsa.prestamos.find((p) => p.id === 'prestamo-2')?.rutaId).toBe(
      'ruta-c',
    );
    expect(falsa.rutasActivasDe('cliente-1')).toEqual(['ruta-b', 'ruta-c']);
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
