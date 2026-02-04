import { Controller, Post, Body, Param, UseGuards } from '@nestjs/common';
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
  @Roles(RolUsuario.COORDINADOR)
  async approveItem(@Param('id') id: string, @Body() body: { type: TipoAprobacion }) {
    return this.approvalsService.approveItem(id, body.type as TipoAprobacion);
  }

  @Post(':id/reject')
  @Roles(RolUsuario.COORDINADOR)
  async rejectItem(@Param('id') id: string, @Body() body: { type: TipoAprobacion }) {
    return this.approvalsService.rejectItem(id, body.type as TipoAprobacion);
  }
}