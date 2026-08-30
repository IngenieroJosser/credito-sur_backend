import { Module, Global, forwardRef } from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificacionesController } from './notificaciones.controller';
import { NotificacionesGateway } from './notificaciones.gateway';
import { PushModule } from '../push/push.module';
import { RoutesModule } from '../routes/routes.module';
import { JwtModule } from '@nestjs/jwt';
import { jwtConstants } from '../auth/constants';

@Global() // Hacemos el módulo global para no tener que importarlo en todos lados
@Module({
  imports: [
    PrismaModule,
    PushModule,
    forwardRef(() => RoutesModule),
    // El gateway verifica el token del socket, por eso necesita JwtService.
    JwtModule.registerAsync({
      useFactory: () => ({ secret: jwtConstants.secret }),
    }),
  ],
  controllers: [NotificacionesController],
  providers: [NotificacionesService, NotificacionesGateway],
  exports: [NotificacionesService, NotificacionesGateway],
})
export class NotificacionesModule {}
