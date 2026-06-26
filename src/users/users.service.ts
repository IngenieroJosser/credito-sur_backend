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
import { EstadoAprobacion, EstadoUsuario, RolUsuario, Prisma } from '@prisma/client';
import { UnauthorizedException } from '@nestjs/common';
import { ChangePasswordDto } from './dto/change-password.dto';
import { NotificacionesGateway } from '../notificaciones/notificaciones.gateway';
import { getBogotaStartEndOfDay } from '../utils/date-utils';

type UsuarioDetalleMetricas = {
  dineroCaja: number;
  recaudoDia: number;
  metaDiaria: number;
  porcentajeMeta: number;
  rutaNombre: string;
  zona: string;
  progreso: number;
  enMora: number;
  gastosHoy: number;
  actividadReciente: Array<{
    time: string;
    action: string;
    detail: string;
    amount?: string;
    type: 'in' | 'out' | 'neutral';
  }>;
  ingresosDia: number;
  egresosDia: number;
  balanceDia: number;
  gastosCategorias: Array<{ categoria: string; monto: number }>;
  rutasActivas: number;
  rutasTotal: number;
  rutasInactivas: number;
  usuariosActivos: number;
};

const USUARIO_PUBLIC_SELECT = {
  id: true,
  nombres: true,
  apellidos: true,
  correo: true,
  nombreUsuario: true,
  rol: true,
  esPrincipal: true,
  estado: true,
  telefono: true,
  creadoEn: true,
  ultimoIngreso: true,
  eliminadoEn: true,
} as const;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificacionesGateway: NotificacionesGateway,
  ) {}

  private normalizarNombreUsuario(valor: unknown) {
    return String(valor ?? '')
      .trim()
      .toLowerCase();
  }

  private validarYNormalizarNombreUsuario(valor: unknown) {
    const nombreUsuario = this.normalizarNombreUsuario(valor);

    if (!nombreUsuario) {
      throw new BadRequestException('El nombre de usuario es obligatorio');
    }

    if (nombreUsuario.length < 3 || nombreUsuario.length > 50) {
      throw new BadRequestException(
        'El nombre de usuario debe tener entre 3 y 50 caracteres',
      );
    }

    if (!/^[a-zA-Z0-9._-]+$/.test(nombreUsuario)) {
      throw new BadRequestException(
        'El nombre de usuario solo puede contener letras, números, punto, guion y guion bajo.',
      );
    }

    return nombreUsuario;
  }

  async crear(usuarioDto: CreateUserDto, usuarioCreadorId?: string) {
    const correo = usuarioDto.correo.trim().toLowerCase();
    const nombreUsuario = this.validarYNormalizarNombreUsuario(
      usuarioDto.nombreUsuario,
    );

    const usuarioExistente = await this.prisma.usuario.findUnique({
      where: { correo },
    });

    if (usuarioExistente) {
      throw new ConflictException('El correo ya está registrado');
    }

    const usuarioConNombre = await this.prisma.usuario.findFirst({
      where: { nombreUsuario } as any,
    });

    if (usuarioConNombre) {
      throw new ConflictException('El nombre de usuario ya está registrado');
    }

    // VALIDACIÓN: Solo SUPER_ADMINISTRADOR puede crear otro SUPER_ADMINISTRADOR
    // EXCEPCIÓN: Permitir crear el primer superadministrador desde endpoints públicos (Swagger) si no existe ninguno.
    if (usuarioDto.rol === RolUsuario.SUPER_ADMINISTRADOR) {
      const superadminsExistentes = await this.prisma.usuario.count({
        where: {
          rol: RolUsuario.SUPER_ADMINISTRADOR,
          estado: EstadoUsuario.ACTIVO,
        },
      });

      if (superadminsExistentes > 0) {
        if (!usuarioCreadorId) {
          throw new ForbiddenException(
            'Se requiere autenticación para crear un Superadministrador adicional. Usa el token de un Superadmin.',
          );
        }

        const usuarioCreador = await this.prisma.usuario.findUnique({
          where: { id: usuarioCreadorId },
        });

        if (
          !usuarioCreador ||
          usuarioCreador.rol !== RolUsuario.SUPER_ADMINISTRADOR
        ) {
          throw new ForbiddenException(
            'Solo un Superadministrador puede crear otro Superadministrador',
          );
        }
      }
    }

    const {
      password,
      correo: _correo,
      nombreUsuario: _nombreUsuario,
      ...datosUsuario
    } = usuarioDto;

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
          correo,
          nombreUsuario,
          rol: datosUsuario.rol,
          telefono: datosUsuario.telefono,
          estado: datosUsuario.estado,
          hashContrasena,
          esPrincipal:
            esPrimerUsuario &&
            usuarioDto.rol === RolUsuario.SUPER_ADMINISTRADOR,
          ...(usuarioCreadorId
            ? { creadoPor: { connect: { id: usuarioCreadorId } } }
            : {}),
        },
        select: {
          id: true,
          nombres: true,
          apellidos: true,
          correo: true,
          nombreUsuario: true,
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
            nombreUsuario: nuevoUsuario.nombreUsuario,
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

  async obtenerTodos(includeArchived = false) {
    const usuarios = (await this.prisma.usuario.findMany({
      where: {
        eliminadoEn: null,
        ...(includeArchived
          ? {}
          : { estado: { not: EstadoUsuario.ARCHIVADO } }),
      },
      select: {
        id: true,
        nombres: true,
        apellidos: true,
        correo: true,
        nombreUsuario: true,
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
    })) as unknown as any[];

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
    const requested = (permisos || [])
      .map((p) => String(p || '').trim())
      .filter(Boolean);
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

    return this.prisma
      .$transaction(async (tx: Prisma.TransactionClient) => {
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
          `Permisos actualizados para usuario ${usuarioId}: ${permisosDb.length} asignados de ${permisos.length} solicitados.`,
        );

        return {
          mensaje: 'Permisos actualizados correctamente',
          asignados: permisosDb.length,
        };
      })
      .then((result) => {
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
        nombreUsuario: true,
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

  async actualizar(
    id: string,
    updateUserDto: UpdateUserDto,
    usuarioModificadorId?: string,
  ) {
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
    if (
      usuario.esPrincipal &&
      updateUserDto.rol &&
      updateUserDto.rol !== RolUsuario.SUPER_ADMINISTRADOR
    ) {
      throw new ForbiddenException(
        'No se puede cambiar el rol del Superadministrador principal',
      );
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
        where: { nombre: updateUserDto.rol },
      });

      if (nuevoRol) {
        await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          // Eliminar asignación anterior
          await tx.asignacionRolUsuario.deleteMany({
            where: { usuarioId: id },
          });
          // Crear nueva
          await tx.asignacionRolUsuario.create({
            data: {
              usuarioId: id,
              rolId: nuevoRol.id,
            },
          });
        });
      }
    }

    let nombreUsuario: string | undefined;
    if (updateUserDto.nombreUsuario !== undefined) {
      nombreUsuario = this.validarYNormalizarNombreUsuario(
        updateUserDto.nombreUsuario,
      );
      const usuarioConNombre = await this.prisma.usuario.findFirst({
        where: {
          nombreUsuario,
          NOT: { id },
        } as any,
      });

      if (usuarioConNombre) {
        throw new ConflictException('El nombre de usuario ya está registrado');
      }
    }

    const {
      password,
      nombreUsuario: _nombreUsuario,
      correo: correoDto,
      ...datos
    } = updateUserDto;

    const usuarioActualizado = await this.prisma.usuario.update({
      where: { id },
      data: {
        ...datos,
        ...(correoDto !== undefined && {
          correo: correoDto.trim().toLowerCase(),
        }),
        ...(nombreUsuario !== undefined && { nombreUsuario }),
        ...(hashContrasena && { hashContrasena }),
      } as any,
      select: {
        id: true,
        nombres: true,
        apellidos: true,
        correo: true,
        nombreUsuario: true,
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
          nombreUsuario: (usuario as any).nombreUsuario,
          rol: usuario.rol,
          estado: usuario.estado,
          telefono: usuario.telefono,
        },
        datosNuevos: {
          nombres: usuarioActualizado.nombres,
          apellidos: usuarioActualizado.apellidos,
          correo: usuarioActualizado.correo,
          nombreUsuario: usuarioActualizado.nombreUsuario,
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

    // Eliminar aquí no borra físicamente: oculta el usuario archivado para conservar trazabilidad.
    if (usuario.esPrincipal) {
      throw new ForbiddenException(
        'El Superadministrador principal no puede eliminarse ni ocultarse',
      );
    }

    const eliminado = await this.prisma.usuario.update({
      where: { id },
      data: {
        eliminadoEn: new Date(),
        estado: EstadoUsuario.ARCHIVADO,
      },
      select: USUARIO_PUBLIC_SELECT as any,
    });

    if (usuarioEliminadorId) {
      await this.auditService.create({
        usuarioId: usuarioEliminadorId,
        accion: 'OCULTAR_USUARIO_ARCHIVADO',
        entidad: 'Usuario',
        entidadId: id,
        datosAnteriores: {
          estado: usuario.estado,
          eliminadoEn: usuario.eliminadoEn,
        },
        datosNuevos: {
          estado: EstadoUsuario.ARCHIVADO,
          eliminadoEn: eliminado.eliminadoEn,
        },
      });
    }

    this.notificacionesGateway.broadcastUsuariosActualizados({
      accion: 'ELIMINAR',
      usuarioId: id,
    });

    return eliminado;
  }

  async archivar(id: string, usuarioArchivadorId?: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
    });

    if (!usuario || usuario.eliminadoEn) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    if (usuario.esPrincipal) {
      throw new ForbiddenException(
        'El Superadministrador principal no puede ser archivado',
      );
    }

    const archivado = await this.prisma.usuario.update({
      where: { id },
      data: {
        estado: EstadoUsuario.ARCHIVADO,
        eliminadoEn: null,
      },
      select: USUARIO_PUBLIC_SELECT as any,
    });

    if (usuarioArchivadorId) {
      await this.auditService.create({
        usuarioId: usuarioArchivadorId,
        accion: 'ARCHIVAR_USUARIO',
        entidad: 'Usuario',
        entidadId: id,
        datosAnteriores: {
          estado: usuario.estado,
          eliminadoEn: usuario.eliminadoEn,
        },
        datosNuevos: {
          estado: archivado.estado,
          eliminadoEn: archivado.eliminadoEn,
        },
      });
    }

    this.notificacionesGateway.broadcastUsuariosActualizados({
      accion: 'ARCHIVAR',
      usuarioId: id,
    });

    return archivado;
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
      select: USUARIO_PUBLIC_SELECT as any,
    });

    if (usuarioRestauradorId) {
      await this.auditService.create({
        usuarioId: usuarioRestauradorId,
        accion: 'RESTAURAR_USUARIO',
        entidad: 'Usuario',
        entidadId: id,
        datosAnteriores: {
          estado: usuario.estado,
          eliminadoEn: usuario.eliminadoEn,
        },
        datosNuevos: {
          estado: EstadoUsuario.ACTIVO,
          eliminadoEn: null,
        },
      });
    }

    this.notificacionesGateway.broadcastUsuariosActualizados({
      accion: 'RESTAURAR',
      usuarioId: id,
    });

    return restaurado;
  }

  async obtenerDetalleOperativo(id: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      select: {
        id: true,
        nombres: true,
        apellidos: true,
        rol: true,
      },
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    const metricas = this.buildMetricasBase();

    if (usuario.rol === RolUsuario.COBRADOR) {
      Object.assign(metricas, await this.buildMetricasCobrador(usuario.id));
    } else if (usuario.rol === RolUsuario.SUPERVISOR) {
      Object.assign(metricas, await this.buildMetricasRutas({ supervisorId: usuario.id }));
    } else if (usuario.rol === RolUsuario.COORDINADOR) {
      Object.assign(metricas, await this.buildMetricasRutas({}));
    } else if (usuario.rol === RolUsuario.CONTADOR) {
      Object.assign(metricas, await this.buildMetricasContables());
    } else if (usuario.rol === RolUsuario.PUNTO_DE_VENTA) {
      Object.assign(metricas, await this.buildMetricasPuntoVenta(usuario.id));
    } else if (
      usuario.rol === RolUsuario.ADMIN ||
      usuario.rol === RolUsuario.SUPER_ADMINISTRADOR
    ) {
      const [rutas, contable, usuariosActivos] = await Promise.all([
        this.buildMetricasRutas({}),
        this.buildMetricasContables(),
        this.prisma.usuario.count({
          where: { estado: EstadoUsuario.ACTIVO, eliminadoEn: null },
        }),
      ]);
      Object.assign(metricas, rutas, {
        dineroCaja: contable.dineroCaja,
        ingresosDia: contable.ingresosDia,
        egresosDia: contable.egresosDia,
        balanceDia: contable.balanceDia,
        usuariosActivos,
      });
    }

    const actividadAuditoria = await this.getActividadReciente(usuario.id);
    if (actividadAuditoria.length > 0) {
      metricas.actividadReciente = [
        ...metricas.actividadReciente,
        ...actividadAuditoria,
      ].slice(0, 20);
    }

    return {
      usuarioId: usuario.id,
      rol: usuario.rol,
      metricas,
    };
  }

  private buildMetricasBase(): UsuarioDetalleMetricas {
    return {
      dineroCaja: 0,
      recaudoDia: 0,
      metaDiaria: 0,
      porcentajeMeta: 0,
      rutaNombre: '',
      zona: '',
      progreso: 0,
      enMora: 0,
      gastosHoy: 0,
      actividadReciente: [],
      ingresosDia: 0,
      egresosDia: 0,
      balanceDia: 0,
      gastosCategorias: [],
      rutasActivas: 0,
      rutasTotal: 0,
      rutasInactivas: 0,
      usuariosActivos: 0,
    };
  }

  private toNumber(value: unknown): number {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private getPorcentaje(recaudo: number, meta: number) {
    return meta > 0 ? Math.round((recaudo / meta) * 100) : 0;
  }

  private getHoyRange() {
    return getBogotaStartEndOfDay(new Date());
  }

  private async buildMetricasCobrador(usuarioId: string): Promise<Partial<UsuarioDetalleMetricas>> {
    const { startDate, endDate } = this.getHoyRange();
    const rutas = await this.prisma.ruta.findMany({
      where: {
        cobradorId: usuarioId,
        activa: true,
        eliminadoEn: null,
      },
      select: { id: true, nombre: true, zona: true },
    });
    const rutaIds = rutas.map((ruta) => ruta.id);

    if (rutaIds.length === 0) {
      return this.buildMetricasBase();
    }

    const [recaudoAgg, metaAgg, gastosAgg, cajaAgg, enMora, pagosRecientes] =
      await Promise.all([
        this.prisma.pago.aggregate({
          where: {
            cobradorId: usuarioId,
            rutaId: { in: rutaIds },
            fechaPago: { gte: startDate, lte: endDate },
            OR: [{ origenGestion: null }, { origenGestion: { not: 'CIERRE_PENDIENTE' } }],
          },
          _sum: { montoTotal: true },
        }),
        this.prisma.cuota.aggregate({
          where: this.buildCuotasRutaWhere(rutaIds, endDate),
          _sum: { monto: true, montoInteresMora: true },
        }),
        this.prisma.gasto.aggregate({
          where: {
            cobradorId: usuarioId,
            rutaId: { in: rutaIds },
            fechaGasto: { gte: startDate, lte: endDate },
            estadoAprobacion: EstadoAprobacion.APROBADO,
          },
          _sum: { monto: true },
        }),
        this.prisma.caja.aggregate({
          where: { responsableId: usuarioId, activa: true },
          _sum: { saldoActual: true },
        }),
        this.prisma.prestamo.count({
          where: {
            estado: 'EN_MORA',
            eliminadoEn: null,
            cliente: {
              asignacionesRuta: {
                some: { rutaId: { in: rutaIds }, activa: true },
              },
            },
          },
        }),
        this.prisma.pago.findMany({
          where: {
            cobradorId: usuarioId,
            rutaId: { in: rutaIds },
            fechaPago: { gte: startDate, lte: endDate },
          },
          take: 8,
          orderBy: { fechaPago: 'desc' },
          select: {
            fechaPago: true,
            montoTotal: true,
            cliente: { select: { nombres: true, apellidos: true } },
          },
        }),
      ]);

    const recaudoDia = this.toNumber(recaudoAgg._sum.montoTotal);
    const metaDiaria =
      this.toNumber(metaAgg._sum.monto) +
      this.toNumber(metaAgg._sum.montoInteresMora);
    const porcentajeMeta = this.getPorcentaje(recaudoDia, metaDiaria);
    const primeraRuta = rutas[0];

    return {
      dineroCaja: this.toNumber(cajaAgg._sum.saldoActual),
      recaudoDia,
      metaDiaria,
      porcentajeMeta,
      rutaNombre: rutas.length === 1 ? primeraRuta.nombre : `${rutas.length} rutas asignadas`,
      zona: rutas.length === 1 ? primeraRuta.zona : '',
      progreso: porcentajeMeta,
      enMora,
      gastosHoy: this.toNumber(gastosAgg._sum.monto),
      rutasActivas: rutas.length,
      rutasTotal: rutas.length,
      rutasInactivas: 0,
      actividadReciente: pagosRecientes.map((p) => ({
        time: p.fechaPago.toISOString(),
        action: 'Pago registrado',
        detail: `Cliente: ${`${p.cliente.nombres} ${p.cliente.apellidos}`.trim()}`,
        amount: `+$${this.toNumber(p.montoTotal).toLocaleString('es-CO')}`,
        type: 'in' as const,
      })),
    };
  }

  private async buildMetricasRutas(filters: { supervisorId?: string }): Promise<Partial<UsuarioDetalleMetricas>> {
    const { startDate, endDate } = this.getHoyRange();
    const routeWhere: Prisma.RutaWhereInput = {
      eliminadoEn: null,
      ...(filters.supervisorId ? { supervisorId: filters.supervisorId } : {}),
    };
    const [rutas, rutasActivas, rutasInactivas] = await Promise.all([
      this.prisma.ruta.findMany({
        where: routeWhere,
        select: { id: true, nombre: true, zona: true, activa: true },
      }),
      this.prisma.ruta.count({ where: { ...routeWhere, activa: true } }),
      this.prisma.ruta.count({ where: { ...routeWhere, activa: false } }),
    ]);
    const rutaIds = rutas.map((ruta) => ruta.id);

    if (rutaIds.length === 0) {
      return {
        rutasActivas: 0,
        rutasTotal: 0,
        rutasInactivas: 0,
      };
    }

    const [recaudoAgg, metaAgg, gastosAgg, enMora] = await Promise.all([
      this.prisma.pago.aggregate({
        where: {
          rutaId: { in: rutaIds },
          fechaPago: { gte: startDate, lte: endDate },
          OR: [{ origenGestion: null }, { origenGestion: { not: 'CIERRE_PENDIENTE' } }],
        },
        _sum: { montoTotal: true },
      }),
      this.prisma.cuota.aggregate({
        where: this.buildCuotasRutaWhere(rutaIds, endDate),
        _sum: { monto: true, montoInteresMora: true },
      }),
      this.prisma.gasto.aggregate({
        where: {
          rutaId: { in: rutaIds },
          fechaGasto: { gte: startDate, lte: endDate },
          estadoAprobacion: EstadoAprobacion.APROBADO,
        },
        _sum: { monto: true },
      }),
      this.prisma.prestamo.count({
        where: {
          estado: 'EN_MORA',
          eliminadoEn: null,
          cliente: {
            asignacionesRuta: {
              some: { rutaId: { in: rutaIds }, activa: true },
            },
          },
        },
      }),
    ]);

    const recaudoDia = this.toNumber(recaudoAgg._sum.montoTotal);
    const metaDiaria =
      this.toNumber(metaAgg._sum.monto) +
      this.toNumber(metaAgg._sum.montoInteresMora);
    const porcentajeMeta = this.getPorcentaje(recaudoDia, metaDiaria);

    return {
      recaudoDia,
      metaDiaria,
      porcentajeMeta,
      rutaNombre:
        rutas.length === 1 ? rutas[0].nombre : `${rutas.length} rutas`,
      zona: rutas.length === 1 ? rutas[0].zona : '',
      progreso: porcentajeMeta,
      enMora,
      gastosHoy: this.toNumber(gastosAgg._sum.monto),
      rutasActivas,
      rutasTotal: rutas.length,
      rutasInactivas,
    };
  }

  private buildCuotasRutaWhere(rutaIds: string[], endDate: Date): Prisma.CuotaWhereInput {
    return {
      estado: { in: ['PENDIENTE', 'PARCIAL', 'VENCIDA'] as any },
      fechaVencimiento: { lte: endDate },
      prestamo: {
        estado: { in: ['ACTIVO', 'EN_MORA'] as any },
        eliminadoEn: null,
        cliente: {
          asignacionesRuta: {
            some: { rutaId: { in: rutaIds }, activa: true },
          },
        },
      },
    };
  }

  private async buildMetricasContables(): Promise<Partial<UsuarioDetalleMetricas>> {
    const { startDate, endDate } = this.getHoyRange();
    const [ingresosAgg, egresosAgg, cajaAgg, gastosCategorias] =
      await Promise.all([
        this.prisma.journalLine.aggregate({
          where: {
            accountCode: { startsWith: '3.' },
            NOT: { accountCode: { startsWith: '3.4' } },
            journalEntry: { createdAt: { gte: startDate, lte: endDate } },
          },
          _sum: { creditAmount: true, debitAmount: true },
        }),
        this.prisma.journalLine.aggregate({
          where: {
            accountCode: { startsWith: '4.' },
            journalEntry: { createdAt: { gte: startDate, lte: endDate } },
          },
          _sum: { debitAmount: true, creditAmount: true },
        }),
        this.prisma.caja.aggregate({
          where: { activa: true },
          _sum: { saldoActual: true },
        }),
        this.prisma.gasto.groupBy({
          by: ['tipoGasto'],
          where: {
            fechaGasto: { gte: startDate, lte: endDate },
            estadoAprobacion: EstadoAprobacion.APROBADO,
          },
          _sum: { monto: true },
        }),
      ]);

    const ingresosDia =
      this.toNumber(ingresosAgg._sum.creditAmount) -
      this.toNumber(ingresosAgg._sum.debitAmount);
    const egresosDia =
      this.toNumber(egresosAgg._sum.debitAmount) -
      this.toNumber(egresosAgg._sum.creditAmount);

    return {
      dineroCaja: this.toNumber(cajaAgg._sum.saldoActual),
      ingresosDia,
      egresosDia,
      balanceDia: ingresosDia - egresosDia,
      gastosHoy: egresosDia,
      gastosCategorias: gastosCategorias
        .map((g) => ({
          categoria: String(g.tipoGasto || 'OTRO'),
          monto: this.toNumber(g._sum.monto),
        }))
        .sort((a, b) => b.monto - a.monto)
        .slice(0, 5),
    };
  }

  private async buildMetricasPuntoVenta(usuarioId: string): Promise<Partial<UsuarioDetalleMetricas>> {
    const { startDate, endDate } = this.getHoyRange();
    const [creditosAgg, clientesCreados, cuotaInicialAgg] = await Promise.all([
      this.prisma.prestamo.aggregate({
        where: {
          creadoPorId: usuarioId,
          creadoEn: { gte: startDate, lte: endDate },
          eliminadoEn: null,
          OR: [{ productoId: { not: null } }, { tipoPrestamo: 'ARTICULO' }],
        },
        _count: { id: true },
        _sum: { monto: true },
      }),
      this.prisma.cliente.count({
        where: {
          creadoPorId: usuarioId,
          creadoEn: { gte: startDate, lte: endDate },
        },
      }),
      this.prisma.prestamo.aggregate({
        where: {
          creadoPorId: usuarioId,
          creadoEn: { gte: startDate, lte: endDate },
          eliminadoEn: null,
          OR: [{ productoId: { not: null } }, { tipoPrestamo: 'ARTICULO' }],
        },
        _sum: { cuotaInicial: true },
      }),
    ]);

    const ingresosDia = this.toNumber(creditosAgg._sum.monto);

    return {
      ingresosDia,
      recaudoDia: this.toNumber(cuotaInicialAgg._sum.cuotaInicial),
      metaDiaria: ingresosDia,
      porcentajeMeta: ingresosDia > 0 ? 100 : 0,
      progreso: ingresosDia > 0 ? 100 : 0,
      rutasActivas: this.toNumber(creditosAgg._count.id),
      rutasTotal: clientesCreados,
      rutaNombre: 'Punto de venta',
    };
  }

  private async getActividadReciente(usuarioId: string): Promise<UsuarioDetalleMetricas['actividadReciente']> {
    const audit = await this.prisma.registroAuditoria.findMany({
      where: { usuarioId },
      take: 12,
      orderBy: { creadoEn: 'desc' },
      select: {
        creadoEn: true,
        accion: true,
        entidad: true,
        entidadId: true,
      },
    });

    return audit.map((item) => ({
      time: item.creadoEn.toISOString(),
      action: item.accion,
      detail: `${item.entidad || ''} ${item.entidadId || ''}`.trim(),
      type: 'neutral' as const,
    }));
  }

  async toggleEstado(
    id: string,
    nuevoEstado: EstadoUsuario,
    usuarioModificadorId?: string,
  ) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    if (nuevoEstado === EstadoUsuario.ARCHIVADO) {
      throw new BadRequestException(
        'Use el flujo de archivar usuario para cambiar a estado ARCHIVADO',
      );
    }

    // PROTECCIÓN: El Superadmin principal no puede ser desactivado por otros
    if (usuario.esPrincipal && nuevoEstado !== EstadoUsuario.ACTIVO) {
      if (!usuarioModificadorId || usuarioModificadorId !== id) {
        throw new ForbiddenException(
          'El Superadministrador principal no puede ser desactivado por otros usuarios',
        );
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
    if (
      !changePasswordDto.contrasenaNueva ||
      changePasswordDto.contrasenaNueva.trim().length < 6
    ) {
      throw new BadRequestException(
        'La nueva contraseña debe tener al menos 6 caracteres',
      );
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Si se proporciona contraseña actual, validarla
    if (
      changePasswordDto.contrasenaActual &&
      changePasswordDto.contrasenaActual.trim() !== ''
    ) {
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
        this.logger.error(
          `Error al verificar contraseña actual para usuario ${id}`,
          error instanceof Error ? error.stack : error,
        );
        throw new BadRequestException('Error al validar la contraseña actual');
      }
    } else {
      this.logger.log(`Cambio de contraseña administrativo para usuario ${id}`);
    }

    try {
      const hashContrasena = await argon2.hash(
        changePasswordDto.contrasenaNueva,
      );

      await this.prisma.usuario.update({
        where: { id },
        data: { hashContrasena },
      });

      this.logger.log(`Contraseña actualizada para usuario ${id}`);
      return { message: 'Contraseña actualizada correctamente' };
    } catch (error) {
      this.logger.error(
        `Error al actualizar contraseña para usuario ${id}`,
        error instanceof Error ? error.stack : error,
      );
      throw new BadRequestException('Error al actualizar la contraseña');
    }
  }
}
