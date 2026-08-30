import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Res,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  UnauthorizedException,
} from '@nestjs/common';
import { Response } from 'express';
import { InventoryService } from './inventory.service';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '@prisma/client';

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('stats')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
    RolUsuario.SUPERVISOR,
    RolUsuario.COBRADOR,
    RolUsuario.PUNTO_DE_VENTA,
    RolUsuario.CONTADOR,
  )
  getInventoryStats() {
    return this.inventoryService.getInventoryStats();
  }

  @Get('archived')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
    RolUsuario.SUPERVISOR,
    RolUsuario.COBRADOR,
    RolUsuario.PUNTO_DE_VENTA,
    RolUsuario.CONTADOR,
  )
  findArchived() {
    return this.inventoryService.findArchived();
  }

  @Post()
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
    RolUsuario.PUNTO_DE_VENTA,
  )
  create(@Request() req, @Body() createInventoryDto: CreateInventoryDto) {
    // El asiento de inventario necesita saber quien lo registro.
    return this.inventoryService.create(createInventoryDto, this.actor(req));
  }

  @Get('export')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
    RolUsuario.SUPERVISOR,
    RolUsuario.COBRADOR,
    RolUsuario.PUNTO_DE_VENTA,
    RolUsuario.CONTADOR,
  )
  @HttpCode(HttpStatus.OK)
  async exportInventario(
    @Res() res: Response,
    @Query('format', new DefaultValuePipe('excel')) format: 'excel' | 'pdf',
  ) {
    const result = await this.inventoryService.exportarInventario(format);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    res.send(result.data);
  }

  @Get()
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
    RolUsuario.SUPERVISOR,
    RolUsuario.COBRADOR,
    RolUsuario.PUNTO_DE_VENTA,
    RolUsuario.CONTADOR,
  )
  findAll() {
    return this.inventoryService.findAll();
  }

  @Get(':id')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
    RolUsuario.SUPERVISOR,
    RolUsuario.COBRADOR,
    RolUsuario.PUNTO_DE_VENTA,
    RolUsuario.CONTADOR,
  )
  findOne(@Param('id') id: string) {
    return this.inventoryService.findOne(id);
  }

  @Patch(':id')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
    RolUsuario.PUNTO_DE_VENTA,
  )
  update(
    @Request() req,
    @Param('id') id: string,
    @Body() updateInventoryDto: UpdateInventoryDto,
  ) {
    return this.inventoryService.update(id, updateInventoryDto, this.actor(req));
  }

  private actor(req: any): string {
    if (!req?.user?.id) {
      throw new UnauthorizedException('Usuario no autenticado o token invalido');
    }
    return req.user.id;
  }

  @Patch(':id/restore')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
    RolUsuario.PUNTO_DE_VENTA,
  )
  restore(@Param('id') id: string) {
    return this.inventoryService.restore(id);
  }

  @Patch(':id/hide-archived')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
    RolUsuario.PUNTO_DE_VENTA,
  )
  hideArchived(@Param('id') id: string) {
    return this.inventoryService.hideArchived(id);
  }

  @Delete(':id')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
    RolUsuario.PUNTO_DE_VENTA,
  )
  remove(@Param('id') id: string) {
    return this.inventoryService.remove(id);
  }
}
