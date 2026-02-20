import { Controller, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApprovalsService } from './approvals.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario, TipoAprobacion } from '@prisma/client';

@Controller('approvals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Post(':id/approve')
  @Roles(
    RolUsuario.COORDINADOR,
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
  )
  async approveItem(
    @Param('id') id: string,
    @Body() body: { type: TipoAprobacion; notas?: string },
    @Request() req: any,
  ) {
    const aprobadoPorId = req.user?.id || req.user?.sub;
    return this.approvalsService.approveItem(id, body.type, aprobadoPorId, body.notas);
  }

  @Post(':id/reject')
  @Roles(
    RolUsuario.COORDINADOR,
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
  )
  async rejectItem(
    @Param('id') id: string,
    @Body() body: { type: TipoAprobacion; motivoRechazo?: string },
    @Request() req: any,
  ) {
    const rechazadoPorId = req.user?.id || req.user?.sub;
    return this.approvalsService.rejectItem(id, body.type, rechazadoPorId, body.motivoRechazo);
  }
}
