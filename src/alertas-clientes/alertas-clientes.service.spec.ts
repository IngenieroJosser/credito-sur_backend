import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { RolUsuario } from '@prisma/client';
import { AlertasClientesService } from './alertas-clientes.service';

const makeActor = (rol: RolUsuario = RolUsuario.SUPERVISOR) => ({
  id: 'usuario-reportante-1',
  rol,
});

const makePrisma = () => {
  const tx = {
    alertaCliente: {
      create: jest.fn().mockResolvedValue({
        id: 'alerta-1',
        clienteId: 'cliente-1',
        estado: 'ACTIVA',
      }),
      update: jest.fn().mockResolvedValue({
        id: 'alerta-1',
        estado: 'RESUELTA',
      }),
    },
    notificacion: {
      createMany: jest.fn().mockResolvedValue({ count: 3 }),
    },
    historialCliente: {
      create: jest.fn().mockResolvedValue({ id: 'historial-1' }),
    },
  };

  return {
    cliente: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'cliente-1',
        codigo: 'C001',
        dni: '123456',
        nombres: 'Ana',
        apellidos: 'Mosquera',
        telefono: '3000000000',
        direccion: 'Calle 1',
        nivelRiesgo: 'AMARILLO',
        enListaNegra: false,
        referencia1Nombre: 'Maria',
        referencia1Telefono: '301',
        referencia2Nombre: 'Carlos',
        referencia2Telefono: '302',
        asignacionesRuta: [
          {
            rutaId: 'ruta-1',
            cobradorId: 'cobrador-1',
            ruta: {
              id: 'ruta-1',
              nombre: 'Ruta Centro',
              codigo: 'R-1',
              cobrador: {
                id: 'cobrador-1',
                nombres: 'Cobra',
                apellidos: 'Dor',
              },
            },
          },
        ],
        prestamos: [
          {
            id: 'prestamo-1',
            numeroPrestamo: 'PRES-000001',
            estado: 'EN_MORA',
            estadoAprobacion: 'APROBADO',
            saldoPendiente: 200000,
            monto: 500000,
            tipoPrestamo: 'EFECTIVO',
            frecuenciaPago: 'DIARIO',
            cuotas: [
              {
                id: 'cuota-1',
                numeroCuota: 3,
                monto: 50000,
                montoPagado: 0,
                estado: 'VENCIDA',
                fechaVencimiento: new Date('2026-06-10T12:00:00.000Z'),
              },
            ],
            pagos: [
              {
                id: 'pago-1',
                montoTotal: 50000,
                fechaPago: new Date('2026-06-11T15:00:00.000Z'),
                metodoPago: 'EFECTIVO',
              },
            ],
          },
          {
            id: 'prestamo-pendiente-revision',
            numeroPrestamo: 'PRES-000002',
            estado: 'PENDIENTE_APROBACION',
            estadoAprobacion: 'PENDIENTE',
            saldoPendiente: 900000,
            monto: 900000,
            tipoPrestamo: 'EFECTIVO',
            frecuenciaPago: 'DIARIO',
            cuotas: [
              {
                id: 'cuota-pendiente-revision',
                numeroCuota: 1,
                monto: 900000,
                montoPagado: 0,
                estado: 'PENDIENTE',
                fechaVencimiento: new Date('2026-06-20T12:00:00.000Z'),
              },
            ],
            pagos: [],
          },
        ],
        archivos: [{ id: 'foto-1', tipoContenido: 'FOTO_VIVIENDA' }],
        registrosVisitas: [
          {
            id: 'visita-1',
            fechaVisita: '2026-06-18',
            estadoVisita: 'ausente',
            notas: 'No abrió',
            ruta: { id: 'ruta-1', nombre: 'Ruta Centro' },
            cobrador: { id: 'cobrador-1', nombres: 'Cobra', apellidos: 'Dor' },
          },
        ],
      }),
    },
    usuario: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'admin-1', rol: RolUsuario.ADMIN },
        { id: 'supervisor-1', rol: RolUsuario.SUPERVISOR },
        { id: 'cobrador-1', rol: RolUsuario.COBRADOR },
      ]),
    },
    alertaCliente: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([
        { id: 'alerta-1', clienteId: 'cliente-1', estado: 'ACTIVA' },
      ]),
      findUnique: jest.fn().mockResolvedValue({
        id: 'alerta-1',
        clienteId: 'cliente-1',
        estado: 'ACTIVA',
      }),
    },
    $transaction: jest.fn().mockImplementation((callback: any) => callback(tx)),
    _tx: tx,
  };
};

const makeService = (prisma: any) =>
  new AlertasClientesService(
    prisma,
    {
      broadcastClientesActualizados: jest.fn(),
      broadcastNotificacionesActualizadas: jest.fn(),
    } as any,
  );

describe('AlertasClientesService', () => {
  it('bloquea al cobrador para emitir alertas de cliente no ubicado', async () => {
    await expect(
      makeService(makePrisma()).reportarClienteNoUbicado(
        {
          clienteId: 'cliente-1',
          motivo: 'NO_LOCALIZADO',
          descripcion: 'No se ubicó al cliente',
          observacionesReportante: 'No responde llamadas',
        },
        makeActor(RolUsuario.COBRADOR),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('valida campos obligatorios antes de crear la alerta', async () => {
    await expect(
      makeService(makePrisma()).reportarClienteNoUbicado(
        {
          clienteId: 'cliente-1',
          motivo: 'NO_LOCALIZADO',
          descripcion: '',
          observacionesReportante: 'No responde llamadas',
        },
        makeActor(),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('crea una alerta persistente con snapshot y notifica roles operativos', async () => {
    const prisma = makePrisma();

    const result = await makeService(prisma).reportarClienteNoUbicado(
      {
        clienteId: 'cliente-1',
        motivo: 'NO_LOCALIZADO',
        descripcion: 'El cliente no fue ubicado en la dirección registrada',
        observacionesReportante: 'Vecinos indican que se mudó',
        ultimaUbicacionConocida: 'Calle 1',
        evidenciaIds: ['foto-1'],
      },
      makeActor(),
    );

    expect(result.id).toBe('alerta-1');
    expect(prisma._tx.alertaCliente.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clienteId: 'cliente-1',
        rutaId: 'ruta-1',
        cobradorId: 'cobrador-1',
        reportadoPorId: 'usuario-reportante-1',
        estado: 'ACTIVA',
        snapshotCliente: expect.objectContaining({
          cliente: expect.objectContaining({ id: 'cliente-1' }),
          creditos: expect.arrayContaining([
            expect.objectContaining({ id: 'prestamo-1' }),
          ]),
          metricas: expect.objectContaining({
            saldoPendienteTotal: 200000,
            saldoPendienteCarteraActiva: 200000,
            saldoPendientePendienteRevision: 900000,
            cuotasVencidas: 1,
            creditosActivos: 1,
            creditosPendientesRevision: 1,
          }),
        }),
      }),
    });
    expect(prisma._tx.notificacion.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          usuarioId: 'admin-1',
          tipo: 'ALERTA_CLIENTE_NO_UBICADO',
          entidad: 'AlertaCliente',
          entidadId: 'alerta-1',
          metadata: expect.objectContaining({
            alertaId: 'alerta-1',
            clienteId: 'cliente-1',
            clienteNombre: 'Ana Mosquera',
            documento: '123456',
            telefono: '3000000000',
            rutaId: 'ruta-1',
            rutaNombre: 'Ruta Centro',
            cobradorId: 'cobrador-1',
            motivo: 'NO_LOCALIZADO',
            estadoAlerta: 'ACTIVA',
            prioridad: 'ALTA',
            tipoAlerta: 'CLIENTE_NO_UBICADO',
            saldoPendienteTotal: 200000,
            cuotasVencidas: 1,
          }),
        }),
      ]),
      skipDuplicates: true,
    });
  });

  it('impide crear otra alerta activa para el mismo cliente', async () => {
    const prisma = makePrisma();
    prisma.alertaCliente.findFirst.mockResolvedValue({
      id: 'alerta-activa-1',
      creadoEn: new Date('2026-06-19T14:00:00.000Z'),
    });

    await expect(
      makeService(prisma).reportarClienteNoUbicado(
        {
          clienteId: 'cliente-1',
          motivo: 'NO_LOCALIZADO',
          descripcion: 'No fue ubicado',
          observacionesReportante: 'Ya existe una alerta activa',
        },
        makeActor(),
      ),
    ).rejects.toThrow(
      'Este cliente ya tiene una alerta activa. Resuelva la alerta existente antes de crear una nueva.',
    );

    expect(prisma._tx.alertaCliente.create).not.toHaveBeenCalled();
  });

  it('hereda evidencias del expediente cuando el frontend no envía evidenciaIds', async () => {
    const prisma = makePrisma();

    await makeService(prisma).reportarClienteNoUbicado(
      {
        clienteId: 'cliente-1',
        motivo: 'NO_LOCALIZADO',
        descripcion: 'No fue ubicado',
        observacionesReportante: 'Usar evidencias existentes',
      },
      makeActor(),
    );

    expect(prisma._tx.alertaCliente.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        evidenciaIds: ['foto-1'],
      }),
    });
  });

  it('prioriza la ruta enviada desde la pantalla cuando existe contexto operativo', async () => {
    const prisma = makePrisma();

    await makeService(prisma).reportarClienteNoUbicado(
      {
        clienteId: 'cliente-1',
        rutaId: 'ruta-operativa-actual',
        motivo: 'NO_LOCALIZADO',
        descripcion: 'No fue ubicado desde una ruta concreta',
        observacionesReportante: 'Usar ruta de la pantalla',
      } as any,
      makeActor(),
    );

    expect(prisma._tx.alertaCliente.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        rutaId: 'ruta-operativa-actual',
      }),
    });
    expect(prisma._tx.notificacion.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          metadata: expect.objectContaining({
            rutaId: 'ruta-operativa-actual',
          }),
        }),
      ]),
      skipDuplicates: true,
    });
  });

  it('lista alertas filtradas por ruta y estado', async () => {
    const prisma = makePrisma();

    await makeService(prisma).listarAlertas({
      rutaId: 'ruta-1',
      estado: 'ACTIVA',
    });

    expect(prisma.alertaCliente.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          rutaId: 'ruta-1',
          estado: 'ACTIVA',
        },
      }),
    );
  });

  it('permite buscar alertas por texto del cliente o descripción', async () => {
    const prisma = makePrisma();

    await makeService(prisma).listarAlertas({
      q: 'Ana',
    });

    expect(prisma.alertaCliente.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { motivo: { contains: 'Ana', mode: 'insensitive' } },
            { descripcion: { contains: 'Ana', mode: 'insensitive' } },
            { observacionesReportante: { contains: 'Ana', mode: 'insensitive' } },
            { cliente: { nombres: { contains: 'Ana', mode: 'insensitive' } } },
            { cliente: { apellidos: { contains: 'Ana', mode: 'insensitive' } } },
            { cliente: { dni: { contains: 'Ana', mode: 'insensitive' } } },
            { cliente: { telefono: { contains: 'Ana', mode: 'insensitive' } } },
          ]),
        }),
      }),
    );
  });

  it('marca una alerta como resuelta sin eliminarla', async () => {
    const prisma = makePrisma();

    await makeService(prisma).resolverAlerta(
      'alerta-1',
      {
        motivoResolucion: 'Cliente ubicado y datos actualizados',
      },
      makeActor(RolUsuario.ADMIN),
    );

    expect(prisma._tx.alertaCliente.update).toHaveBeenCalledWith({
      where: { id: 'alerta-1' },
      data: expect.objectContaining({
        estado: 'RESUELTA',
        resueltoPorId: 'usuario-reportante-1',
        resueltoEn: expect.any(Date),
        motivoResolucion: 'Cliente ubicado y datos actualizados',
      }),
    });
  });

  it('rechaza resolver alertas inexistentes', async () => {
    const prisma = makePrisma();
    prisma.alertaCliente.findUnique.mockResolvedValue(null);

    await expect(
      makeService(prisma).resolverAlerta(
        'alerta-inexistente',
        { motivoResolucion: 'No existe' },
        makeActor(RolUsuario.ADMIN),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
