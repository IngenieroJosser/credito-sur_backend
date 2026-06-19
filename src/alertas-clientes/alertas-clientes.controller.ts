import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SWAGGER_JWT_AUTH } from '../auth/constants/swagger-auth.constants';
import { AlertasClientesService } from './alertas-clientes.service';
import { CrearAlertaClienteDto } from './dto/crear-alerta-cliente.dto';
import { ResolverAlertaClienteDto } from './dto/resolver-alerta-cliente.dto';

@ApiTags('alertas-clientes')
@ApiBearerAuth(SWAGGER_JWT_AUTH)
@Controller('alertas-clientes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AlertasClientesController {
  constructor(private readonly service: AlertasClientesService) {}

  @Post('cliente-no-ubicado')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
    RolUsuario.SUPERVISOR,
  )
  @ApiOperation({ summary: 'Reportar cliente no ubicado' })
  reportarClienteNoUbicado(
    @Body() dto: CrearAlertaClienteDto,
    @Request() req,
  ) {
    return this.service.reportarClienteNoUbicado(dto, req.user);
  }

  @Get()
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
    RolUsuario.SUPERVISOR,
    RolUsuario.COBRADOR,
  )
  @ApiOperation({ summary: 'Listar alertas de clientes' })
  listar(
    @Query('estado') estado?: string,
    @Query('rutaId') rutaId?: string,
    @Query('cobradorId') cobradorId?: string,
    @Query('clienteId') clienteId?: string,
    @Query('q') q?: string,
  ) {
    return this.service.listarAlertas({
      estado,
      rutaId,
      cobradorId,
      clienteId,
      q,
    });
  }

  @Get(':id')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
    RolUsuario.SUPERVISOR,
    RolUsuario.COBRADOR,
  )
  @ApiOperation({ summary: 'Obtener detalle completo de una alerta de cliente' })
  obtenerDetalle(@Param('id') id: string) {
    return this.service.obtenerDetalleAlerta(id);
  }

  @Patch(':id/resolver')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
    RolUsuario.SUPERVISOR,
  )
  @ApiOperation({ summary: 'Resolver una alerta de cliente' })
  resolver(
    @Param('id') id: string,
    @Body() dto: ResolverAlertaClienteDto,
    @Request() req,
  ) {
    return this.service.resolverAlerta(id, dto, req.user);
  }
}
