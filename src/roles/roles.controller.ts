import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '@prisma/client';

@ApiTags('Roles')
@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.SUPER_ADMINISTRADOR)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post(':id/permisos')
  asignarPermisos(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() assignPermissionsDto: AssignPermissionsDto,
  ) {
    return this.rolesService.asignarPermisos(
      id,
      assignPermissionsDto.permisosIds,
    );
  }

  @Post()
  crear(@Body() rolDto: CreateRoleDto) {
    return this.rolesService.crear(rolDto);
  }

  @Get()
  obtenerTodos() {
    return this.rolesService.obtenerTodos();
  }

  @Get(':id')
  obtenerPorId(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.obtenerPorId(id);
  }

  @Patch(':id')
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() rolDto: UpdateRoleDto,
  ) {
    return this.rolesService.actualizar(id, rolDto);
  }

  @Delete(':id')
  eliminar(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.eliminar(id);
  }
}
