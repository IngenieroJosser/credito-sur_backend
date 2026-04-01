import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import * as argon2 from 'argon2';
import { EstadoUsuario, RolUsuario, Prisma } from '@prisma/client';
import { UnauthorizedException } from '@nestjs/common';
import { ChangePasswordDto } from './dto/change-password.dto';
import { NotificacionesGateway } from '../notificaciones/notificaciones.gateway';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificacionesGateway: NotificacionesGateway,
  ) {}

  async crear(usuarioDto: CreateUserDto, usuarioCreadorId?: string) {
    const usuarioExistente = await this.prisma.usuario.findUnique({
      where: { correo: usuarioDto.correo },
    });

    if (usuarioExistente) {
      throw new ConflictException('El correo ya está registrado');
    }

    // VALIDACIÓN: Solo SUPER_ADMINISTRADOR puede crear otro SUPER_ADMINISTRADOR
    // EXCEPCIÓN: Permitir crear el primer superadministrador desde endpoints públicos (Swagger) si no existe ninguno.
    if (usuarioDto.rol === RolUsuario.SUPER_ADMINISTRADOR) {
      const superadminsExistentes = await this.prisma.usuario.count({
        where: { rol: RolUsuario.SUPER_ADMINISTRADOR, estado: EstadoUsuario.ACTIVO }
      });

      if (superadminsExistentes > 0) {
        if (!usuarioCreadorId) {
          throw new ForbiddenException('Se requiere autenticación para crear un Superadministrador adicional. Usa el token de un Superadmin.');
        }

        const usuarioCreador = await this.prisma.usuario.findUnique({
          where: { id: usuarioCreadorId },
        });

        if (!usuarioCreador || usuarioCreador.rol !== RolUsuario.SUPER_ADMINISTRADOR) {
          throw new ForbiddenException('Solo un Superadministrador puede crear otro Superadministrador');
        }
      }
    }

    const { password, ...datosUsuario } = usuarioDto;

    const hashContrasena = await argon2.hash(password);

    // Buscar el rol dinámico correspondiente
    const rolDinamico = await this.prisma.rol.findUnique({
      where: { nombre: usuarioDto.rol },
    });

    const nuevoUsuario = await this.prisma.$transaction(async (tx) => {
      // Si es el primer usuario del sistema, marcarlo como principal
      const totalUsuarios = await tx.usuario.count();
      const esPrimerUsuario = totalUsuarios === 0;

      const nuevoUsuario = await tx.usuario.create({
        data: {
          nombres: datosUsuario.nombres,
          apellidos: datosUsuario.apellidos,
          correo: datosUsuario.correo,
          rol: datosUsuario.rol,
          telefono: datosUsuario.telefono,
          estado: datosUsuario.estado,
          hashContrasena,
          esPrincipal: esPrimerUsuario && usuarioDto.rol === RolUsuario.SUPER_ADMINISTRADOR,
          ...(usuarioCreadorId ? { creadoPor: { connect: { id: usuarioCreadorId } } } : {}),
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

    this.notificacionesGateway.broadcastUsuariosActualizados({
      accion: 'CREAR',
      usuarioId: nuevoUsuario.id,
    });

    return nuevoUsuario;
  }

  async obtenerTodos() {
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
    // Prisma no soporta select + include anidados con tipos estáticos; cast necesario
    }) as unknown as any[];

    return usuarios.map((usuario) => {
      // 1. Permisos del Rol (default)
      const permisosRol = usuario.asignacionesRoles.flatMap(
        (asignacion: {
          rol: { permisos: { permiso: { accion: string } }[] };
        }) =>
          asignacion.rol.permisos.map(
            (rp: { permiso: { accion: string } }) => rp.permiso.accion,
          ),
      );

      // 2. Permisos Personalizados (overrides)
      const permisosCustom = usuario.permisosPersonalizados.map(
        (p: { permiso: { accion: string } }) => p.permiso.accion,
      );

      // Si tiene permisos personalizados, tienen precedencia total.
      // Si no, se usan los del rol.
      const permisosFinales =
        permisosCustom.length > 0 ? permisosCustom : permisosRol;

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

    // 2. Buscar permisos por 'accion' o por 'id'.
    // En instalaciones reales puede venir una mezcla, y si no se encuentran todos
    // no debemos "simular" éxito asignando 0.
    const requested = (permisos || []).map((p) => String(p || '').trim()).filter(Boolean);
    const permisosDb = await this.prisma.permiso.findMany({
      where: {
        OR: [{ accion: { in: requested } }, { id: { in: requested } }],
      },
      select: { id: true, accion: true },
    });

    const encontrados = new Set<string>();
    permisosDb.forEach((p) => {
      encontrados.add(p.id);
      encontrados.add(p.accion);
    });
    const faltantes = requested.filter((p) => !encontrados.has(p));
    if (faltantes.length > 0) {
      throw new BadRequestException(
        `Uno o más permisos no existen en base de datos: ${faltantes.join(', ')}`,
      );
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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

      this.logger.log(
        `Permisos actualizados para usuario ${usuarioId}: ${permisosDb.length} asignados de ${permisos.length} solicitados.`
      );

      return {
        mensaje: 'Permisos actualizados correctamente',
        asignados: permisosDb.length,
      };
    }).then((result) => {
      // Notificar en tiempo real que el usuario fue actualizado (para refresh de sesión)
      this.notificacionesGateway.broadcastUsuariosActualizados({
        accion: 'PERMISOS_ACTUALIZADOS',
        usuarioId,
      });
      return result;
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
        },
        eliminadoEn: null,
      },
    });
  }

  async obtenerPorCorreo(correo: string) {
    return this.prisma.usuario.findFirst({
      where: { 
        correo,
        eliminadoEn: null,
      },
    });
  }

  async actualizar(id: string, updateUserDto: UpdateUserDto, usuarioModificadorId?: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    // PROTECCIÓN: Un SUPER_ADMINISTRADOR solo puede ser modificado por:
    //   1. Sí mismo (auto-modificación)
    //   2. El SUPER_ADMINISTRADOR principal (tiene esPrincipal = true)
    if (usuario.rol === RolUsuario.SUPER_ADMINISTRADOR) {
      // Auto-modificación siempre permitida
      const esSelfEdit = usuarioModificadorId === id;

      // Verificar si el modificador es el superadmin principal
      let esPrincipalModificando = false;
      if (usuarioModificadorId && !esSelfEdit) {
        const modificador = await this.prisma.usuario.findUnique({
          where: { id: usuarioModificadorId },
          select: { rol: true, esPrincipal: true },
        });
        esPrincipalModificando =
          modificador?.rol === RolUsuario.SUPER_ADMINISTRADOR &&
          (modificador?.esPrincipal ?? false);
      }

      if (!esSelfEdit && !esPrincipalModificando) {
        throw new ForbiddenException(
          'Un Superadministrador solo puede ser modificado por sí mismo o por el Superadministrador principal',
        );
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
    }

    // Si cambia el rol, actualizar también la tabla relacional
    if (updateUserDto.rol && updateUserDto.rol !== usuario.rol) {
       // Buscar el nuevo rol dinámico
       const nuevoRol = await this.prisma.rol.findUnique({
         where: { nombre: updateUserDto.rol }
       });
       
       if (nuevoRol) {
         await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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

    this.notificacionesGateway.broadcastUsuariosActualizados({
      accion: 'ACTUALIZAR',
      usuarioId: usuarioActualizado.id,
    });

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
      const eliminado = await this.prisma.$transaction(async (tx) => {
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

      this.notificacionesGateway.broadcastUsuariosActualizados({
        accion: 'ELIMINAR',
        usuarioId: id,
      });

      return eliminado;
    }

    const eliminado = await this.prisma.usuario.update({
      where: { id },
      data: {
        eliminadoEn: new Date(),
        estado: EstadoUsuario.INACTIVO,
      },
    });

    this.notificacionesGateway.broadcastUsuariosActualizados({
      accion: 'ELIMINAR',
      usuarioId: id,
    });

    return eliminado;
  }

  async restaurar(id: string, usuarioRestauradorId?: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    const restaurado = await this.prisma.usuario.update({
      where: { id },
      data: {
        eliminadoEn: null,
        estado: EstadoUsuario.ACTIVO,
      },
    });

    if (usuarioRestauradorId) {
      await this.auditService.create({
        usuarioId: usuarioRestauradorId,
        accion: 'RESTAURAR_USUARIO',
        entidad: 'Usuario',
        entidadId: id,
        datosAnteriores: { eliminadoEn: usuario.eliminadoEn },
        datosNuevos: { eliminadoEn: null },
      });
    }

    this.notificacionesGateway.broadcastUsuariosActualizados({
      accion: 'RESTAURAR',
      usuarioId: id,
    });

    return restaurado;
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

    const usuarioActualizado = await this.prisma.usuario.update({
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

    this.notificacionesGateway.broadcastUsuariosActualizados({
      accion: 'TOGGLE_ESTADO',
      usuarioId: usuarioActualizado.id,
    });

    return usuarioActualizado;
  }

  async changePassword(id: string, changePasswordDto: ChangePasswordDto) {
    // Validar que se tenga la nueva contraseña
    if (!changePasswordDto.contrasenaNueva || changePasswordDto.contrasenaNueva.trim().length < 6) {
      throw new BadRequestException('La nueva contraseña debe tener al menos 6 caracteres');
    }
    
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Si se proporciona contraseña actual, validarla
    if (changePasswordDto.contrasenaActual && changePasswordDto.contrasenaActual.trim() !== '') {
      try {
        const passwordValid = await argon2.verify(
          usuario.hashContrasena,
          changePasswordDto.contrasenaActual,
        );

        if (!passwordValid) {
          throw new UnauthorizedException('La contraseña actual es incorrecta');
        }
      } catch (error) {
        if (error instanceof UnauthorizedException) throw error;
        this.logger.error(`Error al verificar contraseña actual para usuario ${id}`, error instanceof Error ? error.stack : error);
        throw new BadRequestException('Error al validar la contraseña actual');
      }
    } else {
      this.logger.log(`Cambio de contraseña administrativo para usuario ${id}`);
    }

    try {
      const hashContrasena = await argon2.hash(changePasswordDto.contrasenaNueva);

      await this.prisma.usuario.update({
        where: { id },
        data: { hashContrasena },
      });

      this.logger.log(`Contraseña actualizada para usuario ${id}`);
      return { message: 'Contraseña actualizada correctamente' };
    } catch (error) {
      this.logger.error(`Error al actualizar contraseña para usuario ${id}`, error instanceof Error ? error.stack : error);
      throw new BadRequestException('Error al actualizar la contraseña');
    }
  }
}
