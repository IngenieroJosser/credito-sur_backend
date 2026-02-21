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
} from '@nestjs/common';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { NivelRiesgo, RolUsuario } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator'; 

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateClientDto: UpdateClientDto) {
    return this.clientsService.update(id, updateClientDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.clientsService.remove(id);
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
