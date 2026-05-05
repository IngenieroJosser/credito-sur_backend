import { Controller, Get, Put, Body, UseGuards, Req, Optional } from '@nestjs/common';
import { ConfiguracionService } from './configuracion.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '@prisma/client';
import { InjectQueue } from '@nestjs/bullmq';
import type { Job, Queue } from 'bullmq';
import { formatBogotaOffsetIso } from '../utils/date-utils';

@Controller('configuracion')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConfiguracionController {
  constructor(
    private readonly configuracionService: ConfiguracionService,
    @Optional()
    @InjectQueue('mirror-sync-queue')
    private readonly mirrorSyncQueue?: Queue,
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
    @Req() req: any,
  ) {
    return this.configuracionService.updateConfiguracion(data, req.user?.userId);
  }

  @Get('colas/status')
  @Roles(RolUsuario.SUPER_ADMINISTRADOR)
  async getColasStatus() {
    if (!this.mirrorSyncQueue) {
      return {
        queue: 'mirror-sync-queue',
        enabled: false,
        reason: 'BullMQ/MirrorSync no está habilitado en este entorno (MIRROR_SYNC_ENABLED=false o faltan variables).',
        timestamp: formatBogotaOffsetIso(new Date()),
      };
    }

    const mirrorSyncQueue = this.mirrorSyncQueue;

    const counts = await this.mirrorSyncQueue.getJobCounts(
      'waiting',
      'active',
      'delayed',
      'failed',
      'completed',
      'paused',
    );

    const take = 10;
    const states = ['failed', 'delayed', 'active', 'waiting'] as const;

    const jobsByState = await Promise.all(
      states.map(async (state) => {
        const jobs = await mirrorSyncQueue.getJobs([state], 0, take - 1, true);

        return jobs.map((job: Job) => ({
          id: String(job.id),
          name: job.name,
          state,
          timestamp: job.timestamp,
          processedOn: job.processedOn ?? null,
          finishedOn: job.finishedOn ?? null,
          attemptsMade: job.attemptsMade,
          failedReason: job.failedReason ?? null,
          stacktrace: Array.isArray(job.stacktrace) ? job.stacktrace.slice(0, 3) : [],
          data: job.data ?? null,
          model: (job.data as any)?.model ?? null,
          action: (job.data as any)?.action ?? null,
        }));
      }),
    );

    const jobs = jobsByState
      .flat()
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, take);

    return {
      queue: 'mirror-sync-queue',
      counts,
      jobs,
      timestamp: formatBogotaOffsetIso(new Date()),
    };
  }
}
