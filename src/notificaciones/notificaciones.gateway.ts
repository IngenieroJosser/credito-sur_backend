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
}
