import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { RolUsuario } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacionesGateway } from '../notificaciones/notificaciones.gateway';
import { PushService } from '../push/push.service';
import { CrearAlertaClienteDto } from './dto/crear-alerta-cliente.dto';
import { ResolverAlertaClienteDto } from './dto/resolver-alerta-cliente.dto';

type ActorAlerta = { id?: string; rol?: RolUsuario | string };

const ROLES_EMISORES = new Set<string>([
  RolUsuario.SUPER_ADMINISTRADOR,
  RolUsuario.ADMIN,
  RolUsuario.COORDINADOR,
  RolUsuario.SUPERVISOR,
]);

const ROLES_NOTIFICADOS = [
  RolUsuario.SUPER_ADMINISTRADOR,
  RolUsuario.ADMIN,
  RolUsuario.COORDINADOR,
  RolUsuario.SUPERVISOR,
  RolUsuario.COBRADOR,
];

@Injectable()
export class AlertasClientesService {
  private readonly logger = new Logger(AlertasClientesService.name);

  constructor(
    private prisma: PrismaService,
    private notificacionesGateway: NotificacionesGateway,
    @Optional()
    private readonly pushService?: PushService,
  ) {}

  private assertPuedeEmitir(actor: ActorAlerta) {
    const rol = String(actor?.rol || '').toUpperCase();
    if (!actor?.id || !ROLES_EMISORES.has(rol)) {
      throw new ForbiddenException(
        'No tienes permiso para reportar clientes no ubicados.',
      );
    }
  }

  private validateText(value: unknown, field: string) {
    if (!String(value || '').trim()) {
      throw new BadRequestException(`${field} es obligatorio.`);
    }
  }

  private toNumber(value: any) {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
  }

  private buildSnapshot(cliente: any) {
    const asignacion = cliente.asignacionesRuta?.[0] || null;
    const creditos = (cliente.prestamos || []).map((prestamo: any) => {
      const cuotas = Array.isArray(prestamo.cuotas) ? prestamo.cuotas : [];
      const pagos = Array.isArray(prestamo.pagos) ? prestamo.pagos : [];
      const estadoPrestamo = String(prestamo.estado || '').toUpperCase();
      const estadoAprobacion = String(prestamo.estadoAprobacion || '').toUpperCase();
      const esCarteraActiva =
        ['ACTIVO', 'EN_MORA', 'INCUMPLIDO'].includes(estadoPrestamo) &&
        !['PENDIENTE', 'RECHAZADO'].includes(estadoAprobacion);
      const cuotasVencidas = cuotas.filter(
        (cuota: any) => String(cuota.estado || '').toUpperCase() === 'VENCIDA',
      );

      return {
        id: prestamo.id,
        numeroPrestamo: prestamo.numeroPrestamo,
        estado: prestamo.estado,
        estadoAprobacion: prestamo.estadoAprobacion,
        esCarteraActiva,
        saldoPendiente: this.toNumber(prestamo.saldoPendiente),
        monto: this.toNumber(prestamo.monto),
        tipoPrestamo: prestamo.tipoPrestamo,
        frecuenciaPago: prestamo.frecuenciaPago,
        cuotasVencidas: cuotasVencidas.length,
        saldoVencido: cuotasVencidas.reduce(
          (sum: number, cuota: any) =>
            sum + Math.max(0, this.toNumber(cuota.monto) - this.toNumber(cuota.montoPagado)),
          0,
        ),
        cuotas: cuotas.map((cuota: any) => ({
          id: cuota.id,
          numeroCuota: cuota.numeroCuota,
          estado: cuota.estado,
          monto: this.toNumber(cuota.monto),
          montoPagado: this.toNumber(cuota.montoPagado),
          fechaVencimiento: cuota.fechaVencimiento,
        })),
        pagosRecientes: pagos.map((pago: any) => ({
          id: pago.id,
          montoTotal: this.toNumber(pago.montoTotal),
          fechaPago: pago.fechaPago,
          metodoPago: pago.metodoPago,
        })),
      };
    });

    const metricas = creditos.reduce(
      (acc: any, credito: any) => {
        if (!credito.esCarteraActiva) {
          return {
            ...acc,
            saldoPendientePendienteRevision:
              acc.saldoPendientePendienteRevision + credito.saldoPendiente,
            creditosPendientesRevision: acc.creditosPendientesRevision + 1,
          };
        }

        return {
          ...acc,
          saldoPendienteTotal: acc.saldoPendienteTotal + credito.saldoPendiente,
          saldoPendienteCarteraActiva:
            acc.saldoPendienteCarteraActiva + credito.saldoPendiente,
          cuotasVencidas: acc.cuotasVencidas + credito.cuotasVencidas,
          saldoVencidoTotal: acc.saldoVencidoTotal + credito.saldoVencido,
          creditosActivos: acc.creditosActivos + 1,
        };
      },
      {
        saldoPendienteTotal: 0,
        saldoPendienteCarteraActiva: 0,
        saldoPendientePendienteRevision: 0,
        cuotasVencidas: 0,
        saldoVencidoTotal: 0,
        creditosActivos: 0,
        creditosPendientesRevision: 0,
        totalObligaciones: creditos.length,
      },
    );

    return {
      cliente: {
        id: cliente.id,
        codigo: cliente.codigo,
        dni: cliente.dni,
        nombres: cliente.nombres,
        apellidos: cliente.apellidos,
        telefono: cliente.telefono,
        direccion: cliente.direccion,
        nivelRiesgo: cliente.nivelRiesgo,
        enListaNegra: cliente.enListaNegra,
      },
      referencias: [
        cliente.referencia1Nombre || cliente.referencia1Telefono
          ? {
              tipo: 'REFERENCIA_1',
              nombre: cliente.referencia1Nombre,
              telefono: cliente.referencia1Telefono,
            }
          : null,
        cliente.referencia2Nombre || cliente.referencia2Telefono
          ? {
              tipo: 'REFERENCIA_2',
              nombre: cliente.referencia2Nombre,
              telefono: cliente.referencia2Telefono,
            }
          : null,
      ].filter(Boolean),
      ruta: asignacion?.ruta
        ? {
            id: asignacion.ruta.id,
            nombre: asignacion.ruta.nombre,
            codigo: asignacion.ruta.codigo,
            cobrador: asignacion.ruta.cobrador,
          }
        : null,
      creditos,
      metricas,
      historialVisitas: (cliente.registrosVisitas || []).map((registro: any) => ({
        id: registro.id,
        fechaVisita: registro.fechaVisita,
        estadoVisita: registro.estadoVisita,
        notas: registro.notas,
        ruta: registro.ruta,
        cobrador: registro.cobrador,
      })),
      evidencias: (cliente.archivos || []).map((archivo: any) => ({
        id: archivo.id,
        tipoContenido: archivo.tipoContenido,
        url: archivo.url,
        descripcion: archivo.descripcion,
      })),
    };
  }

  private async getClienteParaSnapshot(clienteId: string) {
    const cliente = await (this.prisma as any).cliente.findUnique({
      where: { id: clienteId },
      include: {
        asignacionesRuta: {
          where: { activa: true },
          take: 1,
          include: {
            ruta: {
              select: {
                id: true,
                nombre: true,
                codigo: true,
                cobrador: { select: { id: true, nombres: true, apellidos: true } },
              },
            },
          },
        },
        prestamos: {
          where: {
            estado: {
              in: ['ACTIVO', 'EN_MORA', 'INCUMPLIDO', 'PENDIENTE_APROBACION'],
            },
          },
          include: {
            cuotas: {
              orderBy: { numeroCuota: 'asc' },
              take: 12,
            },
            pagos: {
              orderBy: { fechaPago: 'desc' },
              take: 5,
            },
          },
        },
        archivos: {
          take: 10,
          orderBy: { creadoEn: 'desc' },
        },
        registrosVisitas: {
          take: 10,
          orderBy: { creadoEn: 'desc' },
          include: {
            ruta: { select: { id: true, nombre: true } },
            cobrador: { select: { id: true, nombres: true, apellidos: true } },
          },
        },
      },
    });

    if (!cliente) throw new NotFoundException('Cliente no encontrado');
    return cliente;
  }

  async reportarClienteNoUbicado(
    dto: CrearAlertaClienteDto,
    actor: ActorAlerta,
  ) {
    this.assertPuedeEmitir(actor);
    this.validateText(dto.clienteId, 'clienteId');
    this.validateText(dto.motivo, 'motivo');
    this.validateText(dto.descripcion, 'descripcion');
    this.validateText(dto.observacionesReportante, 'observacionesReportante');

    const alertaActivaExistente = await (this.prisma as any).alertaCliente.findFirst({
      where: {
        clienteId: dto.clienteId,
        estado: 'ACTIVA',
      },
      select: {
        id: true,
        creadoEn: true,
      },
    });

    if (alertaActivaExistente?.id) {
      throw new BadRequestException(
        'Este cliente ya tiene una alerta activa. Resuelva la alerta existente antes de crear una nueva.',
      );
    }

    const cliente = await this.getClienteParaSnapshot(dto.clienteId);
    const asignacion = cliente.asignacionesRuta?.[0] || null;
    const rutaIdOperacion =
      dto.rutaId?.trim() || asignacion?.rutaId || asignacion?.ruta?.id || null;
    const snapshotCliente = this.buildSnapshot(cliente);
    const evidenciaIds =
      Array.isArray(dto.evidenciaIds) && dto.evidenciaIds.length > 0
        ? dto.evidenciaIds
        : Array.isArray(snapshotCliente.evidencias)
          ? snapshotCliente.evidencias
              .map((evidencia: any) => evidencia.id)
              .filter(Boolean)
          : [];
    const usuariosNotificar = await (this.prisma as any).usuario.findMany({
      where: {
        rol: { in: ROLES_NOTIFICADOS },
        estado: 'ACTIVO',
        eliminadoEn: null,
      },
      select: { id: true, rol: true },
    });
    const clienteNombre = `${cliente.nombres || ''} ${cliente.apellidos || ''}`.trim();
    const cobradorNombre = asignacion?.ruta?.cobrador
      ? `${asignacion.ruta.cobrador.nombres || ''} ${asignacion.ruta.cobrador.apellidos || ''}`.trim()
      : null;

    const alerta = await (this.prisma as any).$transaction(async (tx: any) => {
      const creada = await tx.alertaCliente.create({
        data: {
          clienteId: dto.clienteId,
          rutaId: rutaIdOperacion,
          cobradorId: asignacion?.cobradorId || asignacion?.ruta?.cobrador?.id || null,
          reportadoPorId: actor.id,
          estado: 'ACTIVA',
          motivo: dto.motivo.trim(),
          descripcion: dto.descripcion.trim(),
          ultimaUbicacionConocida: dto.ultimaUbicacionConocida?.trim() || null,
          observacionesReportante: dto.observacionesReportante.trim(),
          snapshotCliente,
          evidenciaIds,
          notificadosCount: usuariosNotificar.length,
        },
      });

      if (usuariosNotificar.length > 0) {
        await tx.notificacion.createMany({
          data: usuariosNotificar.map((usuario: any) => ({
            usuarioId: usuario.id,
            titulo: 'Alerta: cliente no ubicado',
            mensaje: `${cliente.nombres} ${cliente.apellidos} · Doc. ${cliente.dni || 'S/N'} · Ruta ${asignacion?.ruta?.nombre || 'S/R'}`,
            tipo: 'ALERTA_CLIENTE_NO_UBICADO',
            entidad: 'AlertaCliente',
            entidadId: creada.id,
            metadata: {
              tipoAlerta: 'CLIENTE_NO_UBICADO',
              tipoRevision: 'ALERTA_CLIENTE_NO_UBICADO',
              alertaId: creada.id,
              clienteId: cliente.id,
              clienteNombre,
              documento: cliente.dni,
              telefono: cliente.telefono,
              direccion: cliente.direccion,
              rutaId: rutaIdOperacion,
              rutaNombre: asignacion?.ruta?.nombre || null,
              cobradorId:
                asignacion?.cobradorId ||
                asignacion?.ruta?.cobrador?.id ||
                null,
              cobradorNombre,
              motivo: dto.motivo.trim(),
              descripcion: dto.descripcion.trim(),
              ultimaUbicacionConocida: dto.ultimaUbicacionConocida?.trim() || null,
              observacionesReportante: dto.observacionesReportante.trim(),
              estadoAlerta: 'ACTIVA',
              prioridad: 'ALTA',
              saldoPendienteTotal:
                snapshotCliente.metricas?.saldoPendienteTotal ?? 0,
              cuotasVencidas: snapshotCliente.metricas?.cuotasVencidas ?? 0,
              saldoVencidoTotal: snapshotCliente.metricas?.saldoVencidoTotal ?? 0,
              deepLink: `/admin/revisiones?tab=alertas-clientes&alertaId=${creada.id}`,
            },
          })),
          skipDuplicates: true,
        });
      }

      return creada;
    });

    this.emitirCambios(alerta.id, dto.clienteId);

    // Enviar push notifications a todos los usuarios notificados
    await this.enviarPushAlertaClienteNoUbicado({
      usuarios: usuariosNotificar,
      alertaId: alerta.id,
      clienteId: cliente.id,
      clienteNombre,
      documento: cliente.dni,
      rutaNombre: asignacion?.ruta?.nombre || null,
      motivo: dto.motivo.trim(),
    });

    return alerta;
  }

  async listarAlertas(filters: {
    estado?: string;
    rutaId?: string;
    cobradorId?: string;
    clienteId?: string;
    q?: string;
  }) {
    const where: any = {};
    if (filters.estado) where.estado = filters.estado;
    if (filters.rutaId) where.rutaId = filters.rutaId;
    if (filters.cobradorId) where.cobradorId = filters.cobradorId;
    if (filters.clienteId) where.clienteId = filters.clienteId;
    if (filters.q?.trim()) {
      const q = filters.q.trim();
      where.OR = [
        { motivo: { contains: q, mode: 'insensitive' } },
        { descripcion: { contains: q, mode: 'insensitive' } },
        { observacionesReportante: { contains: q, mode: 'insensitive' } },
        { cliente: { nombres: { contains: q, mode: 'insensitive' } } },
        { cliente: { apellidos: { contains: q, mode: 'insensitive' } } },
        { cliente: { dni: { contains: q, mode: 'insensitive' } } },
        { cliente: { telefono: { contains: q, mode: 'insensitive' } } },
      ];
    }

    return (this.prisma as any).alertaCliente.findMany({
      where,
      orderBy: { creadoEn: 'desc' },
      include: {
        cliente: {
          select: { id: true, nombres: true, apellidos: true, dni: true },
        },
        reportadoPor: {
          select: { id: true, nombres: true, apellidos: true, rol: true },
        },
        resueltoPor: {
          select: { id: true, nombres: true, apellidos: true, rol: true },
        },
      },
    });
  }

  async obtenerDetalleAlerta(id: string) {
    const alerta = await (this.prisma as any).alertaCliente.findUnique({
      where: { id },
      include: {
        cliente: {
          select: {
            id: true,
            codigo: true,
            dni: true,
            nombres: true,
            apellidos: true,
            telefono: true,
            direccion: true,
            nivelRiesgo: true,
            enListaNegra: true,
            razonListaNegra: true,
          },
        },
        reportadoPor: {
          select: {
            id: true,
            nombres: true,
            apellidos: true,
            rol: true,
          },
        },
        resueltoPor: {
          select: {
            id: true,
            nombres: true,
            apellidos: true,
            rol: true,
          },
        },
      },
    });

    if (!alerta) {
      throw new NotFoundException('Alerta no encontrada.');
    }

    return alerta;
  }

  async resolverAlerta(
    id: string,
    dto: ResolverAlertaClienteDto,
    actor: ActorAlerta,
  ) {
    this.assertPuedeEmitir(actor);
    this.validateText(dto.motivoResolucion, 'motivoResolucion');

    const alerta = await (this.prisma as any).alertaCliente.findUnique({
      where: { id },
    });
    if (!alerta) throw new NotFoundException('Alerta no encontrada');
    if (alerta.estado === 'RESUELTA') {
      throw new BadRequestException('La alerta ya fue resuelta.');
    }

    const actualizada = await (this.prisma as any).$transaction(async (tx: any) =>
      tx.alertaCliente.update({
        where: { id },
        data: {
          estado: 'RESUELTA',
          resueltoPorId: actor.id,
          resueltoEn: new Date(),
          motivoResolucion: dto.motivoResolucion.trim(),
        },
      }),
    );

    this.emitirCambios(id, alerta.clienteId);
    return actualizada;
  }

  private emitirCambios(alertaId: string, clienteId: string) {
    try {
      this.notificacionesGateway.broadcastClientesActualizados({
        accion: 'ALERTA_CLIENTE_NO_UBICADO',
        alertaId,
        clienteId,
      });
      (this.notificacionesGateway as any).broadcastNotificacionesActualizadas?.({
        accion: 'ALERTA_CLIENTE_NO_UBICADO',
        alertaId,
        clienteId,
      });
    } catch (error) {
      this.logger.warn(
        `No se pudo emitir actualización realtime de alerta ${alertaId}: ${(error as Error)?.message || error}`,
      );
    }
  }

  private async enviarPushAlertaClienteNoUbicado(params: {
    usuarios: Array<{ id: string }>;
    alertaId: string;
    clienteId: string;
    clienteNombre: string;
    documento?: string | null;
    rutaNombre?: string | null;
    motivo: string;
  }) {
    if (!this.pushService) return;

    const title = 'Alerta: cliente no ubicado';

    const body = [
      params.clienteNombre || 'Cliente sin nombre',
      params.documento ? `Doc. ${params.documento}` : null,
      params.rutaNombre ? `Ruta: ${params.rutaNombre}` : null,
    ]
      .filter(Boolean)
      .join(' · ');

    await Promise.allSettled(
      params.usuarios.map((usuario) =>
        this.pushService!.sendPushNotification({
          title,
          body,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/badge-72x72.png',
          tag: `alerta-cliente-no-ubicado-${params.alertaId}`,
          userId: usuario.id,
          data: {
            tipo: 'ALERTA_CLIENTE_NO_UBICADO',
            tipoRevision: 'ALERTA_CLIENTE_NO_UBICADO',
            alertaId: params.alertaId,
            clienteId: params.clienteId,
            motivo: params.motivo,
            url: `/admin/revisiones?tab=alertas-clientes&alertaId=${params.alertaId}`,
          },
        }),
      ),
    );
  }
}
