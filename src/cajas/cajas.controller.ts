import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { CajasService } from './cajas.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '@prisma/client';

@Controller('cajas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CajasController {
  constructor(private readonly cajasService: CajasService) {}

  @Get(':cajaId/arqueo/preview')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
    RolUsuario.SUPERVISOR,
    RolUsuario.CONTADOR,
    RolUsuario.COBRADOR,
  )
  getArqueoPreview(
    @Param('cajaId') cajaId: string,
    @Query('fechaOperativa') fechaOperativa?: string,
    @Request() req?: any,
  ) {
    return this.cajasService.getArqueoPreview(
      cajaId,
      fechaOperativa,
      req?.user?.id,
    );
  }

  @Get('arqueos/:arqueoId')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
    RolUsuario.SUPERVISOR,
    RolUsuario.CONTADOR,
    RolUsuario.COBRADOR,
  )
  async getArqueoById(@Param('arqueoId') arqueoId: string) {
    return this.cajasService.getArqueoById(arqueoId);
  }

  @Post(':cajaId/arqueos')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
    RolUsuario.SUPERVISOR,
    RolUsuario.CONTADOR,
    RolUsuario.COBRADOR,
  )
  confirmarArqueo(
    @Param('cajaId') cajaId: string,
    @Body()
    body: {
      fechaOperativa: string;
      efectivoContado: number;
      recibidoPorId?: string;
      denominaciones?: any;
      observaciones?: string;
    },
    @Request() req: any,
  ) {
    return this.cajasService.confirmarArqueo(
      cajaId,
      body.fechaOperativa,
      body.efectivoContado,
      req.user.id,
      body.recibidoPorId,
      body.denominaciones,
      body.observaciones,
    );
  }
}
