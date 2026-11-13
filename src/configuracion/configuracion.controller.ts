import { Controller, Get, Put, Body, UseGuards, Req } from '@nestjs/common';
import { ConfiguracionService } from './configuracion.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '@prisma/client';
import { formatBogotaOffsetIso } from '../utils/date-utils';
import { PrismaService } from '../prisma/prisma.service';

import { RequestConUsuario } from '../common/types';

@Controller('configuracion')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConfiguracionController {
  constructor(
    private readonly configuracionService: ConfiguracionService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.ADMIN)
  getConfiguracion() {
    return this.configuracionService.getConfiguracion();
  }

  @Put()
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.ADMIN)
  updateConfiguracion(
    @Body()
    data: {
      autoAprobarClientes?: boolean;
      autoAprobarCreditos?: boolean;
    },
    @Req() req: RequestConUsuario,
  ) {
    // Antes decía `req.user?.userId`, un campo que el JWT nunca devuelve (pone
    // `id`), así que siempre llegaba undefined y la configuración se guardaba
    // sin dejar constancia de quién la cambió.
    return this.configuracionService.updateConfiguracion(data, req.user?.id);
  }

  /**
   * El estado de la replica al espejo.
   *
   * La ruta se queda igual —`colas/status`— para no romper la pantalla de
   * sincronizacion que ya la consulta, pero lo que mira es otra cosa: antes
   * preguntaba a BullMQ por sus trabajos; ahora cuenta las filas del outbox,
   * que es la tabla de Postgres donde vive la cola desde que se quito Redis.
   *
   * Es la misma informacion y con una ventaja: se puede mirar con SQL, y ya
   * no hace falta un panel aparte con su propia contraseña.
   */
  @Get('colas/status')
  @Roles(RolUsuario.SUPER_ADMINISTRADOR)
  async getColasStatus() {
    const [pendientes, procesando, fallidos, procesados] = await Promise.all([
      this.prisma.outboxEvent.count({ where: { status: 'PENDING' } }),
      this.prisma.outboxEvent.count({ where: { status: 'PROCESSING' } }),
      this.prisma.outboxEvent.count({ where: { status: 'FAILED' } }),
      this.prisma.outboxEvent.count({ where: { status: 'PROCESSED' } }),
    ]);

    // Los que fallaron, con su motivo: es lo unico que hace falta mirar
    // cuando la replica se atrasa.
    const ultimosFallidos = await this.prisma.outboxEvent.findMany({
      where: { status: 'FAILED' },
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        eventType: true,
        aggregateType: true,
        aggregateId: true,
        attempts: true,
        lastError: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      queue: 'outbox_events',
      // El nombre de antes, para que la pantalla no tenga que cambiar de
      // golpe: son los mismos estados con los nombres de BullMQ.
      counts: {
        waiting: pendientes,
        active: procesando,
        failed: fallidos,
        completed: procesados,
        delayed: 0,
        paused: 0,
      },
      jobs: ultimosFallidos.map((evento) => ({
        id: evento.id,
        name: evento.eventType,
        state: 'failed' as const,
        timestamp: evento.createdAt.getTime(),
        processedOn: null,
        finishedOn: evento.updatedAt.getTime(),
        attemptsMade: evento.attempts,
        failedReason: evento.lastError,
        stacktrace: [],
        data: null,
        model: evento.aggregateType,
        action: null,
      })),
      timestamp: formatBogotaOffsetIso(new Date()),
    };
  }
}
