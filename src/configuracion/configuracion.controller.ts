import { Controller, Get, Put, Body, UseGuards, Req } from '@nestjs/common';
import { ConfiguracionService } from './configuracion.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '@prisma/client';

@Controller('configuracion')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConfiguracionController {
  constructor(private readonly configuracionService: ConfiguracionService) {}

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
}
