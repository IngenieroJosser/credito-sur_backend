import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async crear(rolDto: CreateRoleDto) {
    const rolExistente = await this.prisma.rol.findUnique({
      where: { nombre: rolDto.nombre },
    });

    if (rolExistente) {
      throw new ConflictException(`El rol ${rolDto.nombre} ya existe`);
    }

    return this.prisma.rol.create({
      data: rolDto,
    });
  }

  obtenerTodos() {
    return this.prisma.rol.findMany({
      where: { eliminadoEn: null },
    });
  }

  async obtenerPorId(id: string) {
    const rol = await this.prisma.rol.findUnique({
      where: { id },
    });

    if (!rol) {
      throw new NotFoundException(`Rol con ID ${id} no encontrado`);
    }
    return rol;
  }

  async actualizar(id: string, rolDto: UpdateRoleDto) {
    const rol = await this.prisma.rol.findUnique({ where: { id } });
    if (!rol) {
      throw new NotFoundException(`Rol con ID ${id} no encontrado`);
    }

    return this.prisma.rol.update({
      where: { id },
      data: rolDto,
    });
  }

  async eliminar(id: string) {
    const rol = await this.prisma.rol.findUnique({ where: { id } });
    if (!rol) {
      throw new NotFoundException(`Rol con ID ${id} no encontrado`);
    }

    return this.prisma.rol.update({
      where: { id },
      data: { eliminadoEn: new Date() },
    });
  }
}
