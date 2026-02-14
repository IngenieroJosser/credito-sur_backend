import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '@prisma/client';
import { Response } from 'express';

/**
 * Controlador de Auditoría
 * Los registros de auditoría NO deben ser editables ni eliminables por diseño
 * Solo se pueden crear y consultar
 */
@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * Crear un registro de auditoría manualmente (poco común)
   * Normalmente se crean automáticamente desde otros servicios
   */
  @Post()
  create(
    @Body()
    data: {
      usuarioId: string;
      accion: string;
      entidad: string;
      entidadId: string;
      datosAnteriores?: any;
      datosNuevos?: any;
      metadata?: any;
    },
  ) {
    return this.auditService.create(data);
  }

  /**
   * Listar todos los registros de auditoría
   */
  @Get()
  findAll() {
    return this.auditService.findAll();
  }

  /**
   * Obtener historial de auditoría por usuario
   */
  @Get('user/:id')
  findByUser(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const p = page ? parseInt(page) : 1;
    const l = limit ? parseInt(limit) : 20;
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.auditService.findByUserId(id, l, p, start, end);
  }

  /**
   * Obtener un registro de auditoría por ID
   */
  @Get('export')
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.ADMIN, RolUsuario.SUPERVISOR)
  @HttpCode(HttpStatus.OK)
  async exportAuditLog(
    @Query('format') format: 'excel' | 'pdf',
    @Query('startDate', new DefaultValuePipe('')) startDate: string,
    @Query('endDate', new DefaultValuePipe('')) endDate: string,
    @Res() res: Response,
  ) {
    const result = await this.auditService.exportAuditLog(format, {
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.data);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.auditService.findOne(id);
  }
}
