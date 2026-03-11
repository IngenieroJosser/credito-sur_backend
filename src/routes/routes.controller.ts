import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RoutesService } from './routes.service';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '@prisma/client';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';

@ApiTags('routes')
@ApiBearerAuth()
@Controller('routes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Post()
  @Roles(
    RolUsuario.SUPERVISOR,
    RolUsuario.COORDINADOR,
    RolUsuario.ADMIN,
    RolUsuario.SUPER_ADMINISTRADOR,
  )
  @ApiOperation({ summary: 'Crear una nueva ruta' })
  @ApiResponse({ status: 201, description: 'Ruta creada exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 409, description: 'El código de ruta ya existe' })
  create(@Body() createRouteDto: CreateRouteDto) {
    return this.routesService.create(createRouteDto);
  }

  @Get()
  @Roles(
    RolUsuario.SUPERVISOR,
    RolUsuario.COORDINADOR,
    RolUsuario.ADMIN,
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.COBRADOR,
    RolUsuario.PUNTO_DE_VENTA,
    RolUsuario.CONTADOR,
  )
  @ApiOperation({ summary: 'Obtener todas las rutas' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'activa', required: false, type: Boolean })
  @ApiQuery({ name: 'cobradorId', required: false, type: String })
  @ApiQuery({ name: 'supervisorId', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Lista de rutas obtenida exitosamente',
  })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('activa') activa?: string,
    @Query('cobradorId') cobradorId?: string,
    @Query('supervisorId') supervisorId?: string,
  ) {
    const skip =
      page && limit ? (parseInt(page) - 1) * parseInt(limit) : undefined;
    const take = limit ? parseInt(limit) : undefined;
    const activaBool = activa ? activa === 'true' : undefined;

    return this.routesService.findAll({
      skip,
      take,
      search,
      activa: activaBool,
      cobradorId,
      supervisorId,
    });
  }

  @Get('statistics')
  @Roles(
    RolUsuario.SUPERVISOR,
    RolUsuario.COORDINADOR,
    RolUsuario.ADMIN,
    RolUsuario.SUPER_ADMINISTRADOR,
  )
  @ApiOperation({ summary: 'Obtener estadísticas de rutas' })
  @ApiResponse({
    status: 200,
    description: 'Estadísticas obtenidas exitosamente',
  })
  getStatistics() {
    return this.routesService.getStatistics();
  }

  @Get('cobradores')
  @Roles(
    RolUsuario.SUPERVISOR,
    RolUsuario.COORDINADOR,
    RolUsuario.ADMIN,
    RolUsuario.SUPER_ADMINISTRADOR,
  )
  @ApiOperation({ summary: 'Obtener lista de cobradores disponibles' })
  @ApiResponse({
    status: 200,
    description: 'Lista de cobradores obtenida exitosamente',
  })
  getCobradores() {
    return this.routesService.getCobradores();
  }

  @Get('supervisores')
  @Roles(
    RolUsuario.SUPERVISOR,
    RolUsuario.COORDINADOR,
    RolUsuario.ADMIN,
    RolUsuario.SUPER_ADMINISTRADOR,
  )
  @ApiOperation({ summary: 'Obtener lista de supervisores disponibles' })
  @ApiResponse({
    status: 200,
    description: 'Lista de supervisores obtenida exitosamente',
  })
  getSupervisores() {
    return this.routesService.getSupervisores();
  }

  @Get(':id')
  @Roles(
    RolUsuario.SUPERVISOR,
    RolUsuario.COORDINADOR,
    RolUsuario.ADMIN,
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.COBRADOR,
  )
  @ApiOperation({ summary: 'Obtener una ruta por ID' })
  @ApiResponse({ status: 200, description: 'Ruta obtenida exitosamente' })
  @ApiResponse({ status: 404, description: 'Ruta no encontrada' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.routesService.findOne(id);
  }

  @Patch(':id')
  @Roles(
    RolUsuario.SUPERVISOR,
    RolUsuario.COORDINADOR,
    RolUsuario.ADMIN,
    RolUsuario.SUPER_ADMINISTRADOR,
  )
  @ApiOperation({ summary: 'Actualizar una ruta' })
  @ApiResponse({ status: 200, description: 'Ruta actualizada exitosamente' })
  @ApiResponse({ status: 404, description: 'Ruta no encontrada' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateRouteDto: UpdateRouteDto,
  ) {
    return this.routesService.update(id, updateRouteDto);
  }

  @Delete(':id')
  @Roles(
    RolUsuario.SUPERVISOR,
    RolUsuario.COORDINADOR,
    RolUsuario.ADMIN,
    RolUsuario.SUPER_ADMINISTRADOR,
  )
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar una ruta (soft delete)' })
  @ApiResponse({ status: 204, description: 'Ruta eliminada exitosamente' })
  @ApiResponse({ status: 404, description: 'Ruta no encontrada' })
  @ApiResponse({
    status: 400,
    description: 'No se puede eliminar una ruta con clientes asignados',
  })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.routesService.remove(id);
  }

  @Patch(':id/toggle-active')
  @Roles(
    RolUsuario.SUPERVISOR,
    RolUsuario.COORDINADOR,
    RolUsuario.ADMIN,
    RolUsuario.SUPER_ADMINISTRADOR,
  )
  @ApiOperation({ summary: 'Activar/desactivar una ruta' })
  @ApiResponse({
    status: 200,
    description: 'Estado de ruta cambiado exitosamente',
  })
  @ApiResponse({ status: 404, description: 'Ruta no encontrada' })
  toggleActive(@Param('id', ParseUUIDPipe) id: string) {
    return this.routesService.toggleActive(id);
  }

  @Post(':id/assign-client')
  @Roles(
    RolUsuario.SUPERVISOR,
    RolUsuario.COORDINADOR,
    RolUsuario.ADMIN,
    RolUsuario.SUPER_ADMINISTRADOR,
  )
  @ApiOperation({ summary: 'Asignar cliente a una ruta' })
  @ApiResponse({ status: 201, description: 'Cliente asignado exitosamente' })
  @ApiResponse({ status: 404, description: 'Ruta o cliente no encontrado' })
  @ApiResponse({
    status: 409,
    description: 'El cliente ya está asignado a esta ruta',
  })
  assignClient(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('clienteId', ParseUUIDPipe) clienteId: string,
    @Body('cobradorId', ParseUUIDPipe) cobradorId: string,
  ) {
    return this.routesService.assignClient(id, clienteId, cobradorId);
  }

  @Delete(':id/remove-client/:clienteId')
  @Roles(
    RolUsuario.SUPERVISOR,
    RolUsuario.COORDINADOR,
    RolUsuario.ADMIN,
    RolUsuario.SUPER_ADMINISTRADOR,
  )
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover cliente de una ruta' })
  @ApiResponse({ status: 204, description: 'Cliente removido exitosamente' })
  @ApiResponse({ status: 404, description: 'Asignación no encontrada' })
  removeClient(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('clienteId', ParseUUIDPipe) clienteId: string,
  ) {
    return this.routesService.removeClient(id, clienteId);
  }

  @Post('move-client')
  @Roles(
    RolUsuario.SUPERVISOR,
    RolUsuario.COORDINADOR,
    RolUsuario.ADMIN,
    RolUsuario.SUPER_ADMINISTRADOR,
  )
  @ApiOperation({ summary: 'Mover cliente entre rutas' })
  @ApiResponse({ status: 200, description: 'Cliente movido exitosamente' })
  @ApiResponse({ status: 404, description: 'Ruta o cliente no encontrado' })
  @ApiResponse({
    status: 409,
    description: 'El cliente ya está asignado a la ruta destino',
  })
  moveClient(
    @Body('clienteId', ParseUUIDPipe) clienteId: string,
    @Body('fromRutaId', ParseUUIDPipe) fromRutaId: string,
    @Body('toRutaId', ParseUUIDPipe) toRutaId: string,
  ) {
    return this.routesService.moveClient(clienteId, fromRutaId, toRutaId);
  }

  @Post('move-loan')
  @Roles(
    RolUsuario.SUPERVISOR,
    RolUsuario.COORDINADOR,
    RolUsuario.ADMIN,
    RolUsuario.SUPER_ADMINISTRADOR,
  )
  @ApiOperation({ summary: 'Asignar un crédito específico a otra ruta' })
  @ApiResponse({ status: 200, description: 'Crédito asignado a la nueva ruta' })
  moveLoan(
    @Body('prestamoId', ParseUUIDPipe) prestamoId: string,
    @Body('toRutaId', ParseUUIDPipe) toRutaId: string,
  ) {
    return this.routesService.moveLoan(prestamoId, toRutaId);
  }

  @Get(':id/daily-visits')
  @Roles(
    RolUsuario.COBRADOR,
    RolUsuario.SUPERVISOR,
    RolUsuario.COORDINADOR,
    RolUsuario.ADMIN,
    RolUsuario.SUPER_ADMINISTRADOR,
  )
  @ApiOperation({ summary: 'Obtener visitas del día para una ruta' })
  @ApiQuery({ name: 'fecha', required: false, type: String, description: 'Fecha en formato YYYY-MM-DD' })
  @ApiResponse({ status: 200, description: 'Visitas del día obtenidas exitosamente' })
  @ApiResponse({ status: 404, description: 'Ruta no encontrada' })
  getDailyVisits(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('fecha') fecha?: string,
  ) {
    return this.routesService.getDailyVisits(id, fecha);
  }

  @Patch(':id/reorder')
  @Roles(
    RolUsuario.COBRADOR,
    RolUsuario.SUPERVISOR,
    RolUsuario.COORDINADOR,
    RolUsuario.ADMIN,
    RolUsuario.SUPER_ADMINISTRADOR,
  )
  @ApiOperation({ summary: 'Actualizar orden de clientes en una ruta (drag & drop)' })
  @ApiResponse({ status: 200, description: 'Orden actualizado exitosamente' })
  @ApiResponse({ status: 404, description: 'Ruta no encontrada' })
  updateClientOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('orden') orden: Array<{ clienteId: string; orden: number }>,
  ) {
    return this.routesService.updateClientOrder(id, orden);
  }
}
