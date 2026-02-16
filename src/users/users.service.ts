import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import * as argon2 from 'argon2';
import { EstadoUsuario, RolUsuario } from '@prisma/client';
import { UnauthorizedException } from '@nestjs/common';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async crear(usuarioDto: CreateUserDto, usuarioCreadorId?: string) {
    const usuarioExistente = await this.prisma.usuario.findUnique({
      where: { correo: usuarioDto.correo },
    });

    if (usuarioExistente) {
      throw new ConflictException('El correo ya está registrado');
    }

    // VALIDACIÓN: Solo SUPER_ADMINISTRADOR puede crear otro SUPER_ADMINISTRADOR
    if (usuarioDto.rol === RolUsuario.SUPER_ADMINISTRADOR) {
      if (!usuarioCreadorId) {
        throw new ForbiddenException('Se requiere autenticación para crear un Superadministrador');
      }

      const usuarioCreador = await this.prisma.usuario.findUnique({
        where: { id: usuarioCreadorId },
      });

      if (!usuarioCreador || usuarioCreador.rol !== RolUsuario.SUPER_ADMINISTRADOR) {
        throw new ForbiddenException('Solo un Superadministrador puede crear otro Superadministrador');
      }
    }

    const { password, ...datosUsuario } = usuarioDto;

    const hashContrasena = await argon2.hash(password);

    // Buscar el rol dinámico correspondiente
    const rolDinamico = await this.prisma.rol.findUnique({
      where: { nombre: usuarioDto.rol },
    });

    return this.prisma.$transaction(async (tx) => {
      // Si es el primer usuario del sistema, marcarlo como principal
      const totalUsuarios = await tx.usuario.count();
      const esPrimerUsuario = totalUsuarios === 0;

      const nuevoUsuario = await tx.usuario.create({
        data: {
          ...datosUsuario,
          hashContrasena,
          esPrincipal: esPrimerUsuario && usuarioDto.rol === RolUsuario.SUPER_ADMINISTRADOR,
          creadoPorId: usuarioCreadorId,
        },
        select: {
          id: true,
          nombres: true,
          apellidos: true,
          correo: true,
          rol: true,
          esPrincipal: true,
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

      // Registrar en auditoría
      if (usuarioCreadorId) {
        await this.auditService.create({
          usuarioId: usuarioCreadorId,
          accion: 'CREAR_USUARIO',
          entidad: 'Usuario',
          entidadId: nuevoUsuario.id,
          datosNuevos: {
            nombres: nuevoUsuario.nombres,
            apellidos: nuevoUsuario.apellidos,
            correo: nuevoUsuario.correo,
            rol: nuevoUsuario.rol,
            estado: nuevoUsuario.estado,
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
        esPrincipal: true,
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
        esPrincipal: true,
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

  async actualizar(id: string, updateUserDto: UpdateUserDto, usuarioModificadorId?: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    // PROTECCIÓN: Solo el Superadmin puede modificar su propia información
    if (usuario.rol === RolUsuario.SUPER_ADMINISTRADOR) {
      if (!usuarioModificadorId || usuarioModificadorId !== id) {
        throw new ForbiddenException('Solo el Superadministrador puede modificar su propia información');
      }
    }

    // PROTECCIÓN: No se puede cambiar el rol del Superadmin principal
    if (usuario.esPrincipal && updateUserDto.rol && updateUserDto.rol !== RolUsuario.SUPER_ADMINISTRADOR) {
      throw new ForbiddenException('No se puede cambiar el rol del Superadministrador principal');
    }

    // Hashear contraseña si se proporciona
    let hashContrasena: string | undefined;
    if (updateUserDto.password) {
      hashContrasena = await argon2.hash(updateUserDto.password);
      console.log(`[USERS] Hasheando nueva contraseña para usuario ${id}. Password recibido: "${updateUserDto.password.substring(0, 3)}***". Hash generado: ${hashContrasena.substring(0, 20)}...`);
    } else {
      console.log(`[USERS] No se recibió password para usuario ${id}. Keys recibidas: ${Object.keys(updateUserDto).join(', ')}`);
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

    const usuarioActualizado = await this.prisma.usuario.update({
      where: { id },
      data: {
        ...datos,
        ...(hashContrasena && { hashContrasena }),
      },
      select: {
        id: true,
        nombres: true,
        apellidos: true,
        correo: true,
        rol: true,
        esPrincipal: true,
        estado: true,
        telefono: true,
        creadoEn: true,
        ultimoIngreso: true,
      },
    });

    // Registrar en auditoría
    if (usuarioModificadorId) {
      await this.auditService.create({
        usuarioId: usuarioModificadorId,
        accion: 'ACTUALIZAR_USUARIO',
        entidad: 'Usuario',
        entidadId: id,
        datosAnteriores: {
          nombres: usuario.nombres,
          apellidos: usuario.apellidos,
          correo: usuario.correo,
          rol: usuario.rol,
          estado: usuario.estado,
          telefono: usuario.telefono,
        },
        datosNuevos: {
          nombres: usuarioActualizado.nombres,
          apellidos: usuarioActualizado.apellidos,
          correo: usuarioActualizado.correo,
          rol: usuarioActualizado.rol,
          estado: usuarioActualizado.estado,
          telefono: usuarioActualizado.telefono,
        },
      });
    }

    return usuarioActualizado;
  }

  async eliminar(id: string, usuarioEliminadorId?: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    // PROTECCIÓN: El Superadmin principal solo puede eliminarse a sí mismo
    if (usuario.esPrincipal) {
      if (!usuarioEliminadorId || usuarioEliminadorId !== id) {
        throw new ForbiddenException('El Superadministrador principal solo puede ser eliminado por sí mismo');
      }

      // Si se elimina el Superadmin principal, transferir el rol a otro Superadmin
      return this.prisma.$transaction(async (tx) => {
        // Buscar otro Superadmin activo
        const nuevoSuperadminPrincipal = await tx.usuario.findFirst({
          where: {
            rol: RolUsuario.SUPER_ADMINISTRADOR,
            id: { not: id },
            eliminadoEn: null,
            estado: EstadoUsuario.ACTIVO,
          },
          orderBy: {
            creadoEn: 'asc', // El más antiguo
          },
        });

        // Si hay otro Superadmin, marcarlo como principal
        if (nuevoSuperadminPrincipal) {
          await tx.usuario.update({
            where: { id: nuevoSuperadminPrincipal.id },
            data: { esPrincipal: true },
          });
        }

        // Eliminar el usuario actual
        return tx.usuario.update({
          where: { id },
          data: {
            eliminadoEn: new Date(),
            estado: EstadoUsuario.INACTIVO,
            esPrincipal: false,
          },
        });
      });
    }

    // Usuario normal - eliminar directamente
    return this.prisma.usuario.update({
      where: { id },
      data: {
        eliminadoEn: new Date(),
        estado: EstadoUsuario.INACTIVO,
      },
    });
  }

  async toggleEstado(id: string, nuevoEstado: EstadoUsuario, usuarioModificadorId?: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    // PROTECCIÓN: El Superadmin principal no puede ser desactivado por otros
    if (usuario.esPrincipal && nuevoEstado !== EstadoUsuario.ACTIVO) {
      if (!usuarioModificadorId || usuarioModificadorId !== id) {
        throw new ForbiddenException('El Superadministrador principal no puede ser desactivado por otros usuarios');
      }
    }

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
    console.log(`[USERS] changePassword llamado para usuario ${id}`);
    console.log(`[USERS] DTO recibido:`, JSON.stringify(changePasswordDto));
    
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
    });

    if (!usuario) {
      console.log(`[USERS] Usuario ${id} no encontrado`);
      throw new NotFoundException('Usuario no encontrado');
    }

    console.log(`[USERS] Usuario encontrado: ${usuario.nombres} ${usuario.apellidos}`);

    // Si se proporciona contraseña actual, validarla
    if (changePasswordDto.contrasenaActual && changePasswordDto.contrasenaActual.trim() !== '') {
      console.log(`[USERS] Validando contraseña actual...`);
      const passwordValid = await argon2.verify(
        usuario.hashContrasena,
        changePasswordDto.contrasenaActual,
      );

      if (!passwordValid) {
        console.log(`[USERS] Contraseña actual incorrecta`);
        throw new UnauthorizedException('La contraseña actual es incorrecta');
      }
      console.log(`[USERS] Contraseña actual validada correctamente`);
    } else {
      console.log(`[USERS] No se proporcionó contraseña actual - cambio administrativo`);
    }

    console.log(`[USERS] Hasheando nueva contraseña...`);
    const hashContrasena = await argon2.hash(changePasswordDto.contrasenaNueva);
    console.log(`[USERS] Hash generado: ${hashContrasena.substring(0, 20)}...`);

    await this.prisma.usuario.update({
      where: { id },
      data: {
        hashContrasena,
      },
    });

    console.log(`[USERS] Contraseña actualizada exitosamente para usuario ${id}`);

    return { message: 'Contraseña actualizada correctamente' };
  }
}
