import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, forwardRef, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificacionesService } from './notificaciones.service';
import { PrismaService } from '../prisma/prisma.service';
import { getBogotaStartEndOfDay } from '../utils/date-utils';

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://credito-sur-frontend.onrender.com',
      'https://creditos-del-sur.vercel.app',
    ],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class NotificacionesGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    @Inject(forwardRef(() => NotificacionesService))
    private notificacionesService: NotificacionesService,
    private prisma: PrismaService,
  ) {}

  private logger: Logger = new Logger('NotificacionesGateway');
  // Almacenar el mapeo de userId -> socketId(s)
  private userSockets = new Map<string, Set<string>>();

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway Inicializado');
  }

  handleConnection(client: Socket, ...args: any[]) {
    // Al principio, no sabemos quién es. Esperamos a que el cliente lo diga.
    this.logger.log(`Cliente conectado: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Cliente desconectado: ${client.id}`);
    
    // Limpiar el socket de los registros de usuario
    for (const [userId, sockets] of this.userSockets.entries()) {
      if (sockets.has(client.id)) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.userSockets.delete(userId);
        }
        break;
      }
    }
  }

  /**
   * El frontend debe emitir esto al conectar, pasándole su ID de usuario
   */
  @SubscribeMessage('register')
  handleRegister(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { userId } = data;
    if (!userId) return;

    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(client.id);
    
    // Opcional: unirlo a una sala con su propio ID para emisiones directas
    client.join(`user_${userId}`);
    
    this.logger.log(`Usuario ${userId} registrado con socket ${client.id}`);
    return { success: true };
  }

  /**
   * Recibir evento del cobrador al finalizar ruta y alertar a todos
   */
  @SubscribeMessage('ruta_completada_emit')
  async handleRutaCompletadaEmit(
    @MessageBody() data: { rutaNombre: string, cobradorNombre: string, recaudo: number, meta: number, efectividad: number, clientesFaltantes: number, rutaId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(`El cobrador completó la ruta: ${data.rutaNombre}`);

    const clientesFaltantesNum = Number(data.clientesFaltantes || 0);

    // 1. Registrar el cierre de ruta en BD (trazabilidad de descuadre)
    try {
      if (data.rutaId) {
        // Regla: registrar "CIERRE_RUTA" cuando el cobrador completa la ruta.
        // Si aún faltan clientes por cobrar/visitar, se registra igual el cierre para
        // indicar que el cobrador cerró su jornada.
        const cajaDeLaRuta = await this.prisma.caja.findFirst({
          where: { rutaId: data.rutaId, tipo: 'RUTA' },
        });
        if (cajaDeLaRuta) {
          const { startDate: inicioHoy, endDate: finHoy } = getBogotaStartEndOfDay(new Date());

          const yaCerroHoy = await this.prisma.transaccion.findFirst({
            where: {
              cajaId: cajaDeLaRuta.id,
              tipoReferencia: 'CIERRE_RUTA',
              fechaTransaccion: { gte: inicioHoy, lte: finHoy },
            },
            select: { id: true },
          });

          if (yaCerroHoy?.id) {
            this.logger.warn(
              `Cierre de ruta duplicado ignorado: rutaId=${data.rutaId} cajaId=${cajaDeLaRuta.id} transaccionId=${yaCerroHoy.id}`,
            );
            return;
          }

          const saldoAlCierre = Number(cajaDeLaRuta.saldoActual || 0);
          const hayDescuadre = saldoAlCierre > 0;
          
          // Codificamos los datos en referenciaId agregando SD
          const referenciaId = `RC:${data.recaudo}|MT:${data.meta || 0}|EF:${data.efectividad}|CF:${data.clientesFaltantes}|CO:${data.cobradorNombre}|SD:${saldoAlCierre}`;
          
          await this.prisma.transaccion.create({
            data: {
              numeroTransaccion: `CR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              cajaId: cajaDeLaRuta.id,
              tipo: 'TRANSFERENCIA',
              monto: 0,
              descripcion: hayDescuadre
                ? `Cierre de ruta con descuadre: el cobrador completó la ruta con $${saldoAlCierre.toLocaleString('es-CO')} retenidos (sin recolectar por el admin). Recaudó reportado: $${data.recaudo.toLocaleString('es-CO')}.`
                : `Cierre de ruta exitoso: entregó todo el efectivo. Recaudó $${data.recaudo.toLocaleString('es-CO')} (${data.efectividad}% META).`,
              tipoReferencia: 'CIERRE_RUTA',
              referenciaId,
              creadoPorId: cajaDeLaRuta.responsableId, 
            },
          });

          // Regla de negocio: si hay descuadre de caja (dinero no entregado), se registra la deuda formal.
          if (hayDescuadre) {
            const deuda = saldoAlCierre;
            const refDeuda = `DD:${deuda}|${referenciaId}`;
            await this.prisma.transaccion.create({
              data: {
                numeroTransaccion: `DC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                cajaId: cajaDeLaRuta.id,
                tipo: 'TRANSFERENCIA',
                monto: 0,
                descripcion: `Deuda del cobrador por cerrar ruta sin entregar el dinero recolectado: $${deuda.toLocaleString('es-CO')}`,
                tipoReferencia: 'DEUDA_COBRADOR',
                referenciaId: refDeuda,
                creadoPorId: cajaDeLaRuta.responsableId,
              },
            });
          }
          this.logger.log(`Cierre de ruta registrado en caja ${cajaDeLaRuta.id} — descuadre: ${hayDescuadre}`);
        }
      }
    } catch (err) {
      this.logger.error('Error registrando cierre de ruta en BD:', err);
    }

    // 2. Alerta al Coordinador/Supervisor (Sistematizado + Push)
    await this.notificacionesService.notifyApprovers({
      titulo: 'Cierre de Ruta Completo',
      mensaje: `Cobrador: ${data.cobradorNombre} cerró la ruta ${data.rutaNombre}. Recaudo Final: $${data.recaudo.toLocaleString('es-CO')} (${data.efectividad}% META). ${data.clientesFaltantes > 0 ? 'Faltaron ' + data.clientesFaltantes + ' clientes' : 'Todos visitados'}.`,
      tipo: 'SISTEMA',
    });
  }

  /**
   * Enviar notificación a un usuario específico
   */
  enviarNotificacionAUsuario(userId: string, notificacion: any) {
    this.logger.log(`Emitiendo notificación a user_${userId}: ${notificacion.titulo}`);
    // Emitimos a la sala específica del usuario
    this.server.to(`user_${userId}`).emit('nueva_notificacion', notificacion);
  }

  /**
   * Enviar evento estructurado a un usuario para indicar que la cuenta de notificaciones no leidas cambió
   */
  notificarActualizacion(userId: string) {
    this.server.to(`user_${userId}`).emit('notificaciones_actualizadas', { timestamp: new Date() });
  }

  /**
   * Enviar a todos los usuarios
   */
  enviarNotificacionATodos(notificacion: any) {
    this.server.emit('nueva_notificacion_global', notificacion);
  }

  broadcastUsuariosActualizados(payload?: any) {
    this.logger.log('Emitiendo evento usuarios_actualizados');
    this.server.emit('usuarios_actualizados', {
      timestamp: new Date(),
      ...(payload || {}),
    });
  }

  broadcastClientesActualizados(payload?: any) {
    this.logger.log('Emitiendo evento clientes_actualizados');
    this.server.emit('clientes_actualizados', {
      timestamp: new Date(),
      ...(payload || {}),
    });
  }

  broadcastAprobacionesActualizadas(payload?: any) {
    this.logger.log('Emitiendo evento aprobaciones_actualizadas');
    this.server.emit('aprobaciones_actualizadas', {
      timestamp: new Date(),
      ...(payload || {}),
    });
  }

  broadcastPrestamosActualizados(payload?: any) {
    this.logger.log('Emitiendo evento prestamos_actualizados');
    this.server.emit('prestamos_actualizados', {
      timestamp: new Date(),
      ...(payload || {}),
    });
  }

  broadcastPagosActualizados(payload?: any) {
    this.logger.log('Emitiendo evento pagos_actualizados');
    this.server.emit('pagos_actualizados', {
      timestamp: new Date(),
      ...(payload || {}),
    });
  }

  broadcastRutasActualizadas(payload?: any) {
    this.logger.log('Emitiendo evento rutas_actualizadas');
    this.server.emit('rutas_actualizadas', {
      timestamp: new Date(),
      ...(payload || {}),
    });
  }

  broadcastDashboardsActualizados(payload?: any) {
    this.logger.log('Emitiendo evento dashboards_actualizados');
    this.server.emit('dashboards_actualizados', {
      timestamp: new Date(),
      ...(payload || {}),
    });
  }

  broadcastInventarioActualizado(payload?: any) {
    this.logger.log('Emitiendo evento inventario_actualizado');
    this.server.emit('inventario_actualizado', {
      timestamp: new Date(),
      ...(payload || {}),
    });
  }

  /**
   * Listener universal: cada vez que PrismaService crea una Aprobacion
   * (sin importar el endpoint que la origine), se emite automáticamente
   * el evento WebSocket a todos los clientes conectados.
   * Esto actualiza el badge de revisiones pendientes en el sidebar en tiempo real.
   */
  @OnEvent('aprobacion.created')
  @OnEvent('aprobacion.updated')
  handleAprobacionChanged(payload: any) {
    this.logger.log('Aprobacion creada/actualizada → broadcastAprobacionesActualizadas (via EventEmitter)');
    this.broadcastAprobacionesActualizadas(payload?.data || {});
  }
}
