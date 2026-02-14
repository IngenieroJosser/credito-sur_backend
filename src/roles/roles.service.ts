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
      include: {
        _count: {
          select: { asignacionesUsuario: true },
        },
        permisos: {
          include: {
            permiso: true,
          },
        },
      },
    });
  }

  async obtenerPorId(id: string) {
    const rol = await this.prisma.rol.findUnique({
      where: { id },
      include: {
        permisos: {
          include: {
            permiso: true,
          },
        },
      },
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

  async asignarPermisos(id: string, permisosIds: string[]) {
    const rol = await this.prisma.rol.findUnique({ where: { id } });
    if (!rol) {
      throw new NotFoundException(`Rol con ID ${id} no encontrado`);
    }

    // Verificar que los permisos existan
    const permisosExistentes = await this.prisma.permiso.findMany({
      where: { id: { in: permisosIds } },
    });

    if (permisosExistentes.length !== permisosIds.length) {
      throw new NotFoundException('Uno o más permisos no existen');
    }

    // Actualizar permisos usando transacción implícita de Prisma
    // Primero eliminamos las relaciones existentes
    await this.prisma.rolPermiso.deleteMany({
      where: { rolId: id },
    });

    // Luego creamos las nuevas relaciones
    const nuevasRelaciones = permisosIds.map((permisoId) => ({
      rolId: id,
      permisoId: permisoId,
    }));

    await this.prisma.rolPermiso.createMany({
      data: nuevasRelaciones,
    });

    return this.prisma.rol.findUnique({
      where: { id },
      include: { permisos: { include: { permiso: true } } },
    });
  }
}
