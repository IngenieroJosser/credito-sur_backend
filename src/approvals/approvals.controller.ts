import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { ApprovalsService } from './approvals.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario, TipoAprobacion } from '@prisma/client';

@Controller('approvals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Get('my-requests')
  @Roles(
    RolUsuario.COBRADOR,
    RolUsuario.PUNTO_DE_VENTA,
    RolUsuario.SUPERVISOR,
    RolUsuario.COORDINADOR,
    RolUsuario.CONTADOR,
    RolUsuario.ADMIN,
    RolUsuario.SUPER_ADMINISTRADOR,
  )
  async getMyRequests(@Request() req: any) {
    const usuarioId = req.user?.id || req.user?.sub;
    return this.approvalsService.getMyRequests(usuarioId);
  }

  /**
   * Obtener todas las aprobaciones pendientes, agrupadas por tipo.
   * Alimenta el módulo de Revisiones del frontend.
   */
  @Get('pending')
  @Roles(
    RolUsuario.COORDINADOR,
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.SUPERVISOR,
  )
  async getPending(@Query('tipo') tipo?: string) {
    return this.approvalsService.getPendingApprovals(
      tipo as TipoAprobacion | undefined,
    );
  }

  /**
   * Obtener items escalados para revisión final del SuperAdmin.
   * Incluye rechazos y eliminaciones que requieren confirmación.
   */
  @Get('superadmin-review')
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.ADMIN)
  async getSuperadminReview() {
    return this.approvalsService.getSuperadminReviewItems();
  }

  @Get(':id/context')
  @Roles(
    RolUsuario.COORDINADOR,
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.SUPERVISOR,
  )
  async getApprovalContext(@Param('id') id: string) {
    return this.approvalsService.getApprovalContext(id);
  }

  @Post(':id/approve')
  @Roles(
    RolUsuario.COORDINADOR,
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.SUPERVISOR,
  )
  async approveItem(
    @Param('id') id: string,
    @Body() body: { type: TipoAprobacion; notas?: string; editedData?: any },
    @Request() req: any,
  ) {
    const aprobadoPorId = req.user?.id || req.user?.sub;
    return this.approvalsService.approveItem(
      id,
      body.type,
      aprobadoPorId,
      body.notas,
      body.editedData,
    );
  }

  @Post(':id/reject')
  @Roles(
    RolUsuario.COORDINADOR,
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.SUPERVISOR,
  )
  async rejectItem(
    @Param('id') id: string,
    @Body() body: { type: TipoAprobacion; motivoRechazo?: string; resultadoRevision?: 'RECHAZADO_CON_DEUDA' | 'RECHAZADO_CON_REINTEGRO' },
    @Request() req: any,
  ) {
    const rechazadoPorId = req.user?.id || req.user?.sub;
    return this.approvalsService.rejectItem(
      id,
      body.type,
      rechazadoPorId,
      body.motivoRechazo,
      body.resultadoRevision,
    );
  }

  @Post(':id/confirm-deletion')
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.ADMIN)
  async confirmDeletion(
    @Param('id') id: string,
    @Body() body: { accion: 'CONFIRMAR' | 'REVERTIR'; notas?: string },
    @Request() req: any,
  ) {
    const userId = req.user?.id || req.user?.sub;
    return this.approvalsService.confirmSuperadminAction(
      id,
      body.accion,
      userId,
      body.notas,
    );
  }

  @Post('history')
  @Roles(
    RolUsuario.COORDINADOR,
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.CONTADOR,
  )
  async getHistory(@Body() body: { entidadId: string; tabla: string }) {
    return this.approvalsService.getHistory(body.entidadId, body.tabla);
  }
}
