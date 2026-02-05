import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Controlador de Auditoría
 * Los registros de auditoría NO deben ser editables ni eliminables por diseño
 * Solo se pueden crear y consultar
 */
@Controller('audit')
@UseGuards(JwtAuthGuard)
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
   * Obtener un registro de auditoría por ID
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.auditService.findOne(id);
  }
}
