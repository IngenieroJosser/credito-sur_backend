import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma, RolUsuario } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacionesGateway } from '../notificaciones/notificaciones.gateway';
import { PushService } from '../push/push.service';
import { CrearAlertaClienteDto } from './dto/crear-alerta-cliente.dto';
import { ResolverAlertaClienteDto } from './dto/resolver-alerta-cliente.dto';
import { textoRecortado } from '../common/texto.util';

type ActorAlerta = { id?: string; rol?: RolUsuario };

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

/**
 * Alertas de "cliente no ubicado".
 *
 * Cuando un cobrador no encuentra a un cliente en la direccion registrada, se
 * levanta una alerta para que oficina la gestione. Solo emiten roles de mando
 * (ver `ROLES_EMISORES`), pero se notifica tambien al cobrador, que es quien
 * vuelve a pasar por la direccion.
 *
 * La alerta guarda un SNAPSHOT del cliente al momento de reportarlo, no una
 * referencia viva: ver `buildSnapshot`.
 */
/**
 * El `include` del cliente que se fotografia al abrir una alerta, y el tipo que sale de el.
 *
 * Esta aparte y no escrito a mano dos veces: `Prisma.validator` deja que la consulta y el
 * tipo salgan de la MISMA definicion, asi que no pueden separarse. Antes `buildSnapshot`
 * recibia `cliente: any`, y de ahi colgaban otros ocho `any` (cada `.map((x) => ...)`
 * sobre prestamos, cuotas, pagos, archivos y visitas): 197 hallazgos de lectura insegura.
 */
const clienteParaAlerta = Prisma.validator<Prisma.ClienteDefaultArgs>()({
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
            cobrador: {
              select: { id: true, nombres: true, apellidos: true },
            },
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

type ClienteParaAlerta = Prisma.ClienteGetPayload<typeof clienteParaAlerta>;

/**
 * Las metricas agregadas del snapshot. Estan aparte porque salen de un `reduce` y su
 * acumulador tenia que declararse: con `(acc: any, credito: any)` el tipo del snapshot
 * entero habria sido una afirmacion sin comprobar, ya que `any` se asigna a todo.
 */
export type MetricasAlertaCliente = {
  saldoPendienteTotal: number;
  saldoPendienteCarteraActiva: number;
  saldoPendientePendienteRevision: number;
  cuotasVencidas: number;
  saldoVencidoTotal: number;
  creditosActivos: number;
  creditosPendientesRevision: number;
  totalObligaciones: number;
};

/**
 * La foto del cliente que se guarda en `AlertaCliente.snapshotCliente` (columna `Json`).
 *
 * Se guarda una FOTO y no una relacion a proposito: la alerta documenta como estaba el
 * cliente cuando el cobrador no lo encontro, y eso no debe cambiar despues.
 *
 * El frontend tiene el espejo de este tipo en `services/alertas-clientes-service.ts`,
 * donde antes era `snapshotCliente?: any`, y de ahi salian las quince lecturas sin tipo
 * de `AlertaClienteDetalleModal`. Las claves son las mismas en los dos productores: este
 * y el `fallbackAlerta` que arma `NotificacionDetalleModal` con la metadata de la
 * notificacion cuando la alerta aun no ha cargado.
 */
export type SnapshotClienteAlerta = {
  cliente: {
    id: string;
    codigo: string;
    dni: string;
    nombres: string;
    apellidos: string;
    telefono: string;
    direccion: string | null;
    nivelRiesgo: string;
    enListaNegra: boolean;
  };
  referencias: Array<{
    tipo: string;
    nombre: string | null;
    telefono: string | null;
  }>;
  ruta: {
    id: string;
    nombre: string;
    codigo: string;
    cobrador: { id: string; nombres: string; apellidos: string };
  } | null;
  creditos: Array<{
    id: string;
    numeroPrestamo: string;
    estado: string;
    estadoAprobacion: string;
    esCarteraActiva: boolean;
    saldoPendiente: number;
    monto: number;
    tipoPrestamo: string;
    frecuenciaPago: string;
    cuotasVencidas: number;
    saldoVencido: number;
    cuotas: Array<{
      id: string;
      numeroCuota: number;
      estado: string;
      monto: number;
      montoPagado: number;
      fechaVencimiento: Date;
    }>;
    pagosRecientes: Array<{
      id: string;
      montoTotal: number;
      fechaPago: Date;
      metodoPago: string;
    }>;
  }>;
  metricas: MetricasAlertaCliente;
  historialVisitas: Array<{
    id: string;
    fechaVisita: string;
    estadoVisita: string;
    notas: string | null;
    ruta: { id: string; nombre: string };
    cobrador: { id: string; nombres: string; apellidos: string };
  }>;
  evidencias: Array<{
    id: string;
    tipoContenido: string;
    url: string | null;
    descripcion: string | null;
  }>;
};

@Injectable()
export class AlertasClientesService {
  private readonly logger = new Logger(AlertasClientesService.name);

  constructor(
    private prisma: PrismaService,
    private notificacionesGateway: NotificacionesGateway,
    @Optional()
    private readonly pushService?: PushService,
  ) {}

  /**
   * Firma de asercion: ademas de lanzar, le DICE al compilador que despues de esta llamada
   * `actor.id` existe. Sin esto, cada uso de `actor.id` mas abajo parecia opcional aunque
   * esta misma guarda ya lo garantiza, y habia que castear al escribir en la base.
   */
  private assertPuedeEmitir(
    actor: ActorAlerta,
  ): asserts actor is ActorAlerta & { id: string } {
    const rol = String(actor?.rol || '').toUpperCase();
    if (!actor?.id || !ROLES_EMISORES.has(rol)) {
      throw new ForbiddenException(
        'No tienes permiso para reportar clientes no ubicados.',
      );
    }
  }

  private validateText(value: unknown, field: string) {
    if (!textoRecortado(value)) {
      throw new BadRequestException(`${field} es obligatorio.`);
    }
  }

  /** Acepta lo que sea porque los montos llegan como `Decimal`, texto o numero. */
  private toNumber(value: unknown) {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
  }

  /**
   * Congela el estado del cliente en el momento del reporte.
   *
   * Se guarda una copia y no una referencia a proposito: la alerta es un hecho
   * historico ("asi estaba este cliente cuando no lo encontramos"). Si se leyera
   * en vivo, una alerta de hace un mes mostraria la deuda de hoy, y quien la
   * revisa no podria saber que vio el cobrador ese dia.
   *
   * Incluye la ruta asignada, los creditos con su estado y saldo, y los pagos,
   * que es lo que oficina necesita para decidir sin abrir el perfil.
   */
  private buildSnapshot(cliente: ClienteParaAlerta): SnapshotClienteAlerta {
    const asignacion = cliente.asignacionesRuta?.[0] || null;
    const creditos = (cliente.prestamos || []).map((prestamo) => {
      const cuotas = Array.isArray(prestamo.cuotas) ? prestamo.cuotas : [];
      const pagos = Array.isArray(prestamo.pagos) ? prestamo.pagos : [];
      const estadoPrestamo = String(prestamo.estado || '').toUpperCase();
      const estadoAprobacion = String(
        prestamo.estadoAprobacion || '',
      ).toUpperCase();
      const esCarteraActiva =
        ['ACTIVO', 'EN_MORA', 'INCUMPLIDO'].includes(estadoPrestamo) &&
        !['PENDIENTE', 'RECHAZADO'].includes(estadoAprobacion);
      const cuotasVencidas = cuotas.filter(
        (cuota) => String(cuota.estado || '').toUpperCase() === 'VENCIDA',
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
          (sum: number, cuota) =>
            sum +
            Math.max(
              0,
              this.toNumber(cuota.monto) - this.toNumber(cuota.montoPagado),
            ),
          0,
        ),
        cuotas: cuotas.map((cuota) => ({
          id: cuota.id,
          numeroCuota: cuota.numeroCuota,
          estado: cuota.estado,
          monto: this.toNumber(cuota.monto),
          montoPagado: this.toNumber(cuota.montoPagado),
          fechaVencimiento: cuota.fechaVencimiento,
        })),
        pagosRecientes: pagos.map((pago) => ({
          id: pago.id,
          montoTotal: this.toNumber(pago.montoTotal),
          fechaPago: pago.fechaPago,
          metodoPago: pago.metodoPago,
        })),
      };
    });

    const metricas = creditos.reduce(
      (acc: MetricasAlertaCliente, credito: (typeof creditos)[number]) => {
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
      ]
        // `.filter(Boolean)` NO estrecha el tipo: dejaba `Array<Ref | null>` y el frontend
        // acababa con cuatro `'ref' is possibly null` sobre referencias que aqui ya no
        // pueden ser nulas. Con la guarda, el tipo dice lo que el filtro hace.
        .filter((ref): ref is NonNullable<typeof ref> => ref !== null),
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
      historialVisitas: (cliente.registrosVisitas || []).map((registro) => ({
        id: registro.id,
        fechaVisita: registro.fechaVisita,
        estadoVisita: registro.estadoVisita,
        notas: registro.notas,
        ruta: registro.ruta,
        cobrador: registro.cobrador,
      })),
      evidencias: (cliente.archivos || []).map((archivo) => ({
        id: archivo.id,
        tipoContenido: archivo.tipoContenido,
        url: archivo.url,
        descripcion: archivo.descripcion,
      })),
    };
  }

  private async getClienteParaSnapshot(clienteId: string) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id: clienteId },
      ...clienteParaAlerta,
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

    const alertaActivaExistente = await this.prisma.alertaCliente.findFirst({
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
              .map((evidencia) => evidencia.id)
              .filter(Boolean)
          : [];
    const usuariosNotificar = await this.prisma.usuario.findMany({
      where: {
        rol: { in: ROLES_NOTIFICADOS },
        estado: 'ACTIVO',
        eliminadoEn: null,
      },
      select: { id: true, rol: true },
    });
    const clienteNombre =
      `${cliente.nombres || ''} ${cliente.apellidos || ''}`.trim();
    const cobradorNombre = asignacion?.ruta?.cobrador
      ? `${asignacion.ruta.cobrador.nombres || ''} ${asignacion.ruta.cobrador.apellidos || ''}`.trim()
      : null;

    const alerta = await this.prisma.$transaction(async (tx) => {
      const creada = await tx.alertaCliente.create({
        data: {
          clienteId: dto.clienteId,
          rutaId: rutaIdOperacion,
          cobradorId:
            asignacion?.cobradorId || asignacion?.ruta?.cobrador?.id || null,
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
          data: usuariosNotificar.map((usuario) => ({
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
              ultimaUbicacionConocida:
                dto.ultimaUbicacionConocida?.trim() || null,
              observacionesReportante: dto.observacionesReportante.trim(),
              estadoAlerta: 'ACTIVA',
              prioridad: 'ALTA',
              saldoPendienteTotal:
                snapshotCliente.metricas?.saldoPendienteTotal ?? 0,
              cuotasVencidas: snapshotCliente.metricas?.cuotasVencidas ?? 0,
              saldoVencidoTotal:
                snapshotCliente.metricas?.saldoVencidoTotal ?? 0,
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
    const where: Prisma.AlertaClienteWhereInput = {};
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

    return this.prisma.alertaCliente.findMany({
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
    const alerta = await this.prisma.alertaCliente.findUnique({
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

    const alerta = await this.prisma.alertaCliente.findUnique({
      where: { id },
    });
    if (!alerta) throw new NotFoundException('Alerta no encontrada');
    if (alerta.estado === 'RESUELTA') {
      throw new BadRequestException('La alerta ya fue resuelta.');
    }

    const actualizada = await this.prisma.$transaction(async (tx) =>
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
      // Aqui habia una segunda llamada, a `broadcastNotificacionesActualizadas`, que el
      // gateway NO tiene. Iba con `?.()`, asi que no lanzaba: simplemente no hacia nada.
      // El broadcast que si funciona es el de arriba.
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
