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
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '@prisma/client';

@ApiTags('Usuarios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('usuarios')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(RolUsuario.SUPER_ADMINISTRADOR)
  crear(@Body() usuarioDto: CreateUserDto) {
    return this.usersService.crear(usuarioDto);
  }

  @Get()
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.COORDINADOR)
  obtenerTodos() {
    return this.usersService.obtenerTodos();
  }

  @Get(':id')
  obtenerPorId(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.obtenerPorId(id);
  }

  @Patch(':id')
  @Roles(RolUsuario.SUPER_ADMINISTRADOR)
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() usuarioDto: UpdateUserDto,
  ) {
    return this.usersService.actualizar(id, usuarioDto);
  }

  @Delete(':id')
  @Roles(RolUsuario.SUPER_ADMINISTRADOR)
  eliminar(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.eliminar(id);
  }
}
