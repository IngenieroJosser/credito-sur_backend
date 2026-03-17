import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Put,
  Logger,
  Request,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { NivelRiesgo, RolUsuario } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('clients')
@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateClientDto: UpdateClientDto) {
    return this.clientsService.update(id, updateClientDto);
  }

  @Delete(':id')
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.ADMIN, RolUsuario.COORDINADOR)
  remove(@Param('id') id: string, @Request() req: any) {
    const userId = req.user.id;
    return this.clientsService.remove(id, userId);
  }

  @Patch(':id/restore')
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.ADMIN, RolUsuario.COORDINADOR)
  restore(@Param('id') id: string, @Request() req: any) {
    const userId = req.user.id;
    return this.clientsService.restore(id, userId);
  }

  @Get()
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
    RolUsuario.SUPERVISOR,
    RolUsuario.COBRADOR,
    RolUsuario.CONTADOR,
    RolUsuario.PUNTO_DE_VENTA,
  )
  async getAllClients(
    @Query('nivelRiesgo') nivelRiesgo: string,
    @Query('ruta') ruta: string,
    @Query('search') search: string,
  ) {
    return this.clientsService.getAllClients({
      nivelRiesgo: nivelRiesgo || 'all',
      ruta: ruta || '',
      search: search || '',
    });
  }

  /**
   * GET /clients/export?format=excel|pdf
   * Exporta el listado completo de clientes con filtros opcionales.
   * IMPORTANTE: Esta ruta debe estar ANTES de @Get(':id') para evitar conflictos.
   */
  @Get('export')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
    RolUsuario.CONTADOR,
  )
  @ApiOperation({ summary: 'Exportar listado de clientes en Excel o PDF' })
  @ApiQuery({ name: 'format', enum: ['excel', 'pdf'], required: true })
  @ApiQuery({ name: 'nivelRiesgo', required: false })
  @ApiQuery({ name: 'ruta', required: false })
  @ApiQuery({ name: 'search', required: false })
  @HttpCode(HttpStatus.OK)
  async exportarClientes(
    @Res() res: Response,
    @Query('format') format: 'excel' | 'pdf',
    @Query('nivelRiesgo') nivelRiesgo?: string,
    @Query('ruta') ruta?: string,
    @Query('search') search?: string,
  ) {
    const result = await this.clientsService.exportarClientes(
      format === 'pdf' ? 'pdf' : 'excel',
      { nivelRiesgo, ruta, search },
    );
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.data);
  }

  @Get(':id')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
    RolUsuario.SUPERVISOR,
    RolUsuario.COBRADOR,
    RolUsuario.CONTADOR,
    RolUsuario.PUNTO_DE_VENTA,
  )
  async getClientById(@Param('id') id: string) {
    return this.clientsService.getClientById(id);
  }

  private readonly logger = new Logger(ClientsController.name);

  @Post()
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
    RolUsuario.PUNTO_DE_VENTA,
  )
  async createClient(@Body() body: CreateClientDto) {
    this.logger.log(`Creando cliente con datos: ${JSON.stringify(body)}`);
    // Si viene creadoPorId en el body, lo usamos, si no el service intentará buscar uno (hack actual)
    return this.clientsService.createClient(body);
  }

  @Post('approve/:id')
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.ADMIN, RolUsuario.COORDINADOR)
  async approveClient(
    @Param('id') id: string,
    @Body() body: { aprobadoPorId: string; datosAprobados?: any },
  ) {
    return this.clientsService.approveClient(
      id,
      body.aprobadoPorId,
      body.datosAprobados,
    );
  }

  @Post('reject/:id')
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.ADMIN, RolUsuario.COORDINADOR)
  async rejectClient(
    @Param('id') id: string,
    @Body() body: { rechazadoPorId: string; razon?: string },
  ) {
    return this.clientsService.rejectClient(
      id,
      body.rechazadoPorId,
      body.razon,
    );
  }

  @Put(':id')
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.ADMIN, RolUsuario.COORDINADOR)
  async updateClient(
    @Param('id') id: string,
    @Body()
    body: {
      nombres?: string;
      apellidos?: string;
      telefono?: string;
      correo?: string;
      direccion?: string;
      referencia?: string;
      nivelRiesgo?: string;
      puntaje?: number;
      archivos?: any[];
      creadoPorId?: string;
    },
  ) {
    return this.clientsService.updateClient(id, {
      nombres: body.nombres,
      apellidos: body.apellidos,
      telefono: body.telefono,
      correo: body.correo,
      direccion: body.direccion,
      referencia: body.referencia,
      nivelRiesgo: body.nivelRiesgo as NivelRiesgo,
      archivos: body.archivos,
    });
  }

  @Post(':id/blacklist')
  @Roles(RolUsuario.COORDINADOR)
  async addToBlacklist(
    @Param('id') id: string,
    @Body() body: { razon: string; agregadoPorId: string },
  ) {
    return this.clientsService.addToBlacklist(
      id,
      body.razon,
      body.agregadoPorId,
    );
  }

  @Delete(':id/blacklist')
  @Roles(RolUsuario.COORDINADOR)
  async removeFromBlacklist(@Param('id') id: string) {
    return this.clientsService.removeFromBlacklist(id);
  }

  @Post(':id/assign-route')
  @Roles(RolUsuario.COORDINADOR)
  async assignToRoute(
    @Param('id') clienteId: string,
    @Body() body: { rutaId: string; cobradorId: string; diaSemana?: number },
  ) {
    return this.clientsService.assignToRoute(
      clienteId,
      body.rutaId,
      body.cobradorId,
      body.diaSemana,
    );
  }
}
