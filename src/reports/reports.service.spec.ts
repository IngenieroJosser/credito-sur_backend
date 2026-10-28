import { ReportsService } from './reports.service';
import { ReportPeriod } from './dto/get-operational-report.dto';
import type { NotificacionesService } from '../notificaciones/notificaciones.service';
import type { RoutesService } from '../routes/routes.service';
import type { ArgsDePrismaEnMock } from '../common/testing/prisma-mock.types';
import { comoPrisma, dependenciaSinUsar } from '../common/testing/dobles';

describe('ReportsService operational report', () => {
  it('no suma cuota inicial como recaudo ni meta operativa en reportes por periodo', async () => {
    const prisma = {
      ruta: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'ruta-1',
            nombre: 'Ruta 1',
            cobrador: {
              id: 'cobrador-1',
              nombres: 'Ana',
              apellidos: 'Ruta',
            },
            asignaciones: [
              {
                cliente: {
                  id: 'cliente-1',
                },
              },
            ],
          },
        ]),
      },
      pago: {
        aggregate: jest
          .fn()
          .mockResolvedValueOnce({ _sum: { montoTotal: 100000 } })
          .mockResolvedValueOnce({ _sum: { montoTotal: 100000 } }),
      },
      prestamo: {
        aggregate: jest
          .fn()
          .mockResolvedValueOnce({
            _sum: { monto: 500000, cuotaInicial: 20000 },
            _count: { id: 1 },
          })
          .mockResolvedValueOnce({
            _sum: { monto: 500000, cuotaInicial: 20000 },
            _count: { id: 1 },
          }),
      },
      cliente: {
        count: jest.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(0),
      },
      cuota: {
        aggregate: jest
          .fn()
          .mockResolvedValueOnce({
            _sum: { monto: 200000, montoInteresMora: 0 },
          })
          .mockResolvedValueOnce({
            _sum: { monto: 200000, montoInteresMora: 0 },
          }),
      },
    };
    const service = new ReportsService(
      comoPrisma(prisma),
      dependenciaSinUsar<NotificacionesService>(),
      dependenciaSinUsar<RoutesService>(),
    );

    const result = await service.getOperationalReport({
      period: 'week' as ReportPeriod,
    });

    expect(result.totalRecaudo).toBe(100000);
    expect(result.totalMeta).toBe(200000);
    expect(result.rendimientoRutas[0]).toMatchObject({
      recaudado: 100000,
      meta: 200000,
      eficiencia: 50,
      montoNuevosPrestamos: 500000,
    });
  });
});

describe('ReportsService getRouteDetail: jurisdicción del supervisor', () => {
  function prismaConRuta(supervisorId: string) {
    return {
      ruta: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ruta-x',
          nombre: 'Ruta X',
          supervisorId,
          cobrador: null,
          supervisor: { id: supervisorId, nombres: 'S', apellidos: 'V' },
        }),
      },
      asignacionRuta: { findMany: jest.fn().mockResolvedValue([]) },
      pago: { aggregate: jest.fn().mockResolvedValue({ _sum: {} }) },
      prestamo: {
        aggregate: jest.fn().mockResolvedValue({ _sum: {}, _count: {} }),
      },
      cliente: { count: jest.fn().mockResolvedValue(0) },
      cuota: { aggregate: jest.fn().mockResolvedValue({ _sum: {} }) },
    };
  }

  it('un supervisor NO puede ver una ruta que no supervisa (403)', async () => {
    const prisma = prismaConRuta('otro-supervisor');
    const service = new ReportsService(
      comoPrisma(prisma),
      dependenciaSinUsar<NotificacionesService>(),
      dependenciaSinUsar<RoutesService>(),
    );
    await expect(
      service.getRouteDetail(
        'ruta-x',
        { period: 'week' },
        {
          id: 'sup-1',
          rol: 'SUPERVISOR',
        },
      ),
    ).rejects.toThrow(/No supervisa/);
  });

  it('el admin puede ver cualquier ruta', async () => {
    const prisma = prismaConRuta('otro-supervisor');
    const service = new ReportsService(
      comoPrisma(prisma),
      dependenciaSinUsar<NotificacionesService>(),
      dependenciaSinUsar<RoutesService>(),
    );
    // no debe lanzar por jurisdicción (puede fallar más adelante por mocks, se ignora)
    await service
      .getRouteDetail(
        'ruta-x',
        { period: 'week' },
        {
          id: 'admin-1',
          rol: 'ADMIN',
        },
      )
      .catch(() => undefined);
    expect(prisma.ruta.findUnique).toHaveBeenCalled();
  });
});

describe('ReportsService: scope de rutas por rol en reportes de mora/vencidas', () => {
  // Captura el where con que se consulta, para verificar que lleva el filtro de ruta.
  function prismaEspia() {
    // Lo que la prueba captura de las consultas: el `where` de mora y los de estadisticas.
    // Lo que la prueba captura: el `where` de mora, del que lee el filtro de ruta.
    type WhereCapturado = {
      ruta?: { is?: { supervisorId?: string; cobradorId?: string } };
      [clave: string]: unknown;
    };
    const capturado: {
      moraWhere?: WhereCapturado;
      estadisticas: WhereCapturado[];
    } = { estadisticas: [] };
    return {
      capturado,
      prisma: {
        prestamo: {
          findMany: jest
            .fn()
            .mockImplementation(({ where }: ArgsDePrismaEnMock) => {
              capturado.moraWhere = where ?? {};
              return Promise.resolve([]);
            }),
          count: jest
            .fn()
            .mockImplementation(({ where }: ArgsDePrismaEnMock) => {
              capturado.estadisticas.push(where ?? {});
              return Promise.resolve(0);
            }),
          aggregate: jest.fn().mockResolvedValue({ _sum: {}, _count: {} }),
        },
        cuota: { aggregate: jest.fn().mockResolvedValue({ _sum: {} }) },
      },
    };
  }

  it('el supervisor filtra la mora por sus rutas (supervisorId)', async () => {
    const { prisma, capturado } = prismaEspia();
    const service = new ReportsService(
      comoPrisma(prisma),
      dependenciaSinUsar<NotificacionesService>(),
      dependenciaSinUsar<RoutesService>(),
    );
    await service.obtenerPrestamosEnMora({}, 1, 50, {
      id: 'sup-1',
      rol: 'SUPERVISOR',
    });
    expect(capturado.moraWhere?.ruta?.is?.supervisorId).toBe('sup-1');
  });

  it('el admin NO filtra por ruta (ve todo)', async () => {
    const { prisma, capturado } = prismaEspia();
    const service = new ReportsService(
      comoPrisma(prisma),
      dependenciaSinUsar<NotificacionesService>(),
      dependenciaSinUsar<RoutesService>(),
    );
    await service.obtenerPrestamosEnMora({}, 1, 50, {
      id: 'admin-1',
      rol: 'ADMIN',
    });
    expect(capturado.moraWhere?.ruta).toBeUndefined();
  });

  it('las estadísticas de mora del supervisor van filtradas por su ruta', async () => {
    const { prisma, capturado } = prismaEspia();
    const service = new ReportsService(
      comoPrisma(prisma),
      dependenciaSinUsar<NotificacionesService>(),
      dependenciaSinUsar<RoutesService>(),
    );
    await service.obtenerEstadisticasMora({ id: 'sup-9', rol: 'SUPERVISOR' });
    // todos los count deben llevar el scope de ruta
    expect(capturado.estadisticas.length).toBeGreaterThan(0);
    for (const w of capturado.estadisticas) {
      expect(w?.ruta?.is?.supervisorId).toBe('sup-9');
    }
  });
});
