import { Module } from '@nestjs/common';
import { ConfiguracionService } from './configuracion.service';
import { ConfiguracionController } from './configuracion.controller';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * Aqui se registraba la cola `mirror-sync-queue` de BullMQ, detras del mismo
 * interruptor de tres variables que `app.module`. El estado de la replica se
 * consulta ahora en la tabla del outbox, asi que basta con Prisma.
 */
@Module({
  imports: [PrismaModule],
  controllers: [ConfiguracionController],
  providers: [ConfiguracionService],
  exports: [ConfiguracionService],
})
export class ConfiguracionModule {}
