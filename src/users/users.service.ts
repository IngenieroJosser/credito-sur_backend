import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';
import * as argon2 from 'argon2';
import { EstadoUsuario } from '@prisma/client';
import { UnauthorizedException } from '@nestjs/common';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async crear(usuarioDto: CreateUserDto) {
    const usuarioExistente = await this.prisma.usuario.findUnique({
      where: { correo: usuarioDto.correo },
    });

    if (usuarioExistente) {
      throw new ConflictException('El correo ya está registrado');
    }

    const { password, ...datosUsuario } = usuarioDto;

    const hashContrasena = await argon2.hash(password);

    // Buscar el rol dinámico correspondiente
    const rolDinamico = await this.prisma.rol.findUnique({
      where: { nombre: usuarioDto.rol },
    });

    return this.prisma.$transaction(async (tx) => {
      const nuevoUsuario = await tx.usuario.create({
        data: {
          ...datosUsuario,
          hashContrasena,
        },
        select: {
          id: true,
          nombres: true,
          apellidos: true,
          correo: true,
          rol: true,
          estado: true,
          telefono: true,
          creadoEn: true,
        },
      });

      if (rolDinamico) {
        await tx.asignacionRolUsuario.create({
          data: {
            usuarioId: nuevoUsuario.id,
            rolId: rolDinamico.id,
          },
        });
      }

      return nuevoUsuario;
    });
  }

  async obtenerTodos() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const usuarios = await this.prisma.usuario.findMany({
      where: {
        eliminadoEn: null,
      },
      select: {
        id: true,
        nombres: true,
        apellidos: true,
        correo: true,
        rol: true,
        estado: true,
        telefono: true,
        creadoEn: true,
        ultimoIngreso: true,
        asignacionesRoles: {
          include: {
            rol: {
              include: {
                permisos: {
                  include: {
                    permiso: true,
                  },
                },
              },
            },
          },
        },
        permisosPersonalizados: {
          include: {
            permiso: true,
          },
        },
      } as any,
    }) as any[];

    return usuarios.map((usuario) => {
      // 1. Permisos del Rol (default)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const permisosRol = usuario.asignacionesRoles.flatMap((asignacion: any) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        asignacion.rol.permisos.map((rp: any) => rp.permiso.accion),
      );

      // 2. Permisos Personalizados (overrides)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const permisosCustom = usuario.permisosPersonalizados.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (p: any) => p.permiso.accion,
      );

      // Si tiene permisos personalizados, tienen precedencia total.
      // Si no, se usan los del rol.
      const permisosFinales =
        permisosCustom.length > 0 ? permisosCustom : permisosRol;

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { asignacionesRoles, permisosPersonalizados, ...userData } =
        usuario;

      return {
        ...userData,
        permisos: [...new Set(permisosFinales)],
      };
    });
  }

  async asignarPermisos(usuarioId: string, permisos: string[]) {
    // 1. Validar usuario
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
    });
    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${usuarioId} no encontrado`);
    }

    // 2. Buscar IDs de los permisos basados en 'accion' (que es lo que manda el frontend)
    const permisosDb = await this.prisma.permiso.findMany({
      where: {
        accion: { in: permisos },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.prisma.$transaction(async (tx: any) => {
      // 3. Limpiar permisos personalizados existentes
      await tx.asignacionPermisoUsuario.deleteMany({
        where: { usuarioId },
      });

      // 4. Crear nuevas asignaciones
      if (permisosDb.length > 0) {
        await tx.asignacionPermisoUsuario.createMany({
          data: permisosDb.map((p) => ({
            usuarioId,
            permisoId: p.id,
          })),
        });
      }

      return { mensaje: 'Permisos actualizados correctamente' };
    });
  }

  async obtenerPorId(id: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      select: {
        id: true,
        nombres: true,
        apellidos: true,
        correo: true,
        rol: true,
        estado: true,
        telefono: true,
        creadoEn: true,
        ultimoIngreso: true,
      },
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    return usuario;
  }

  async obtenerPorNombres(nombres: string) {
    return this.prisma.usuario.findFirst({
      where: {
        nombres: {
          equals: nombres,
          mode: 'insensitive',
        },
        eliminadoEn: null,
      },
    });
  }

  async obtenerPorCorreo(correo: string) {
    return this.prisma.usuario.findUnique({
      where: { correo },
    });
  }

  async actualizar(id: string, updateUserDto: UpdateUserDto) {
    const usuario = await this.obtenerPorId(id);

    if (updateUserDto.password) {
      updateUserDto.password = await argon2.hash(updateUserDto.password);
    }

    // Si cambia el rol, actualizar también la tabla relacional
    if (updateUserDto.rol && updateUserDto.rol !== usuario.rol) {
       // Buscar el nuevo rol dinámico
       const nuevoRol = await this.prisma.rol.findUnique({
         where: { nombre: updateUserDto.rol }
       });
       
       if (nuevoRol) {
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         await this.prisma.$transaction(async (tx: any) => {
            // Eliminar asignación anterior
            await tx.asignacionRolUsuario.deleteMany({
              where: { usuarioId: id }
            });
            // Crear nueva
            await tx.asignacionRolUsuario.create({
              data: {
                usuarioId: id,
                rolId: nuevoRol.id
              }
            });
         });
       }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...datos } = updateUserDto;

    return this.prisma.usuario.update({
      where: { id },
      data: {
        ...datos,
        ...(updateUserDto.password && { hashContrasena: updateUserDto.password }),
      },
      select: {
        id: true,
        nombres: true,
        apellidos: true,
        correo: true,
        rol: true,
        estado: true,
        telefono: true,
        creadoEn: true,
        ultimoIngreso: true,
      },
    });
  }

  async eliminar(id: string) {
    await this.obtenerPorId(id);
    return this.prisma.usuario.update({
      where: { id },
      data: {
        eliminadoEn: new Date(),
        estado: EstadoUsuario.INACTIVO
      }
    });
  }

  async toggleEstado(id: string, nuevoEstado: EstadoUsuario) {
    await this.obtenerPorId(id);

    return this.prisma.usuario.update({
      where: { id },
      data: {
        estado: nuevoEstado,
      },
      select: {
        id: true,
        nombres: true,
        estado: true,
      },
    });
  }

  async changePassword(id: string, changePasswordDto: ChangePasswordDto) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Si se proporciona contraseña actual, validarla
    if (changePasswordDto.contrasenaActual) {
      const passwordValid = await argon2.verify(
        usuario.hashContrasena,
        changePasswordDto.contrasenaActual,
      );

      if (!passwordValid) {
        throw new UnauthorizedException('La contraseña actual es incorrecta');
      }
    }

    const hashContrasena = await argon2.hash(changePasswordDto.contrasenaNueva);

    await this.prisma.usuario.update({
      where: { id },
      data: {
        hashContrasena,
      },
    });

    return { message: 'Contraseña actualizada correctamente' };
  }
}
