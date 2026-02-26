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
import { Logger } from '@nestjs/common';

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
  handleRutaCompletadaEmit(
    @MessageBody() data: { rutaNombre: string, cobradorNombre: string, recaudo: number, efectividad: number, clientesFaltantes: number },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(`El cobrador completó la ruta: ${data.rutaNombre}`);
    
    // Alerta al Coordinador/Supervisor
    this.server.emit('nueva_notificacion_global', {
      id: `rta-comp-${Date.now()}`,
      titulo: 'Cierre de Ruta Completo',
      mensaje: `Cobrador: ${data.cobradorNombre} cerró la ruta ${data.rutaNombre}. Recaudo Final: $${data.recaudo.toLocaleString('es-CO')} (${data.efectividad}% META). Visitó faltantes: ${data.clientesFaltantes > 0 ? 'Faltaron ' + data.clientesFaltantes : 'Todos visitados'}.`,
      tipo: 'SISTEMA',
      fecha: new Date().toISOString(),
      leida: false,
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
}
