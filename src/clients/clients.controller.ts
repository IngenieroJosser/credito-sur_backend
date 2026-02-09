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
} from '@nestjs/common';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { NivelRiesgo, RolUsuario } from '@prisma/client';
import { Roles } from 'src/auth/decorators/roles.decorator';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  create(@Body() createClientDto: CreateClientDto) {
    return this.clientsService.create(createClientDto);
  }

  @Get()
  findAll() {
    return this.clientsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.clientsService.findOne(id);
  }

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
    RolUsuario.COORDINADOR,
    RolUsuario.SUPERVISOR,
    RolUsuario.COBRADOR,
    RolUsuario.CONTADOR,
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
    RolUsuario.COORDINADOR,
    RolUsuario.SUPERVISOR,
    RolUsuario.COBRADOR,
    RolUsuario.CONTADOR,
  )
  async getClientById(@Param('id') id: string) {
    return this.clientsService.getClientById(id);
  }

  @Post()
  @Roles(RolUsuario.COORDINADOR)
  async createClient(
    @Body()
    body: {
      dni: string;
      nombres: string;
      apellidos: string;
      telefono: string;
      correo?: string;
      direccion?: string;
      referencia?: string;
      creadoPorId: string;
      archivos?: any[];
    },
  ) {
    return this.clientsService.createClient(body);
  }

  @Post('approve/:id')
  @Roles(RolUsuario.COORDINADOR)
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

  @Put(':id')
  @Roles(RolUsuario.COORDINADOR)
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
