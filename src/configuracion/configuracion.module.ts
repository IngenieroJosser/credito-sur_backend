import { Module } from '@nestjs/common';
import { ConfiguracionService } from './configuracion.service';
import { ConfiguracionController } from './configuracion.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { BullModule } from '@nestjs/bullmq';

const shouldEnableMirrorSync =
  process.env.MIRROR_SYNC_ENABLED === 'true' &&
  Boolean(process.env.MIRROR_VPS_URL) &&
  Boolean(process.env.MIRROR_SYNC_TOKEN);

@Module({
  imports: [
    PrismaModule,
    ...(shouldEnableMirrorSync
      ? [
          BullModule.registerQueue({
            name: 'mirror-sync-queue',
          }),
        ]
      : []),
  ],
  controllers: [ConfiguracionController],
  providers: [ConfiguracionService],
  exports: [ConfiguracionService],
})
export class ConfiguracionModule {}
