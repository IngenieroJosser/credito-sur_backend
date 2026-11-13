import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MirrorEnvioService } from './mirror-envio.service';
import { MirrorReceptorController } from './mirror-receptor.controller';

/**
 * La replica al espejo, sin Redis.
 *
 * Reemplaza a `MirrorSyncModule`, que registraba una cola de BullMQ y traia
 * con ella el unico motivo por el que este proyecto necesitaba un Redis. La
 * cola duradera ya estaba en Postgres —`OutboxEvent`—; Redis era una segunda
 * cola delante de la primera. El detalle de por que se puede quitar esta en
 * `mirror-envio.service.ts`.
 *
 * El modulo se carga SIEMPRE, y eso tambien cambia. Antes `app.module` lo
 * montaba solo si `MIRROR_SYNC_ENABLED` estaba en `true` y las variables del
 * VPS existian, lo cual dejaba fuera tambien el CONTROLADOR que RECIBE: para
 * que el espejo pudiera recibir habia que encenderle la replica a el tambien,
 * que es justo lo que no tiene que hacer. Ahora el receptor esta siempre
 * disponible —y su propia firma HMAC es lo que lo protege— y el que ENVIA se
 * queda quieto si no hay a donde.
 */
@Module({
  imports: [PrismaModule],
  controllers: [MirrorReceptorController],
  providers: [MirrorEnvioService],
  exports: [MirrorEnvioService],
})
export class MirrorModule {}
