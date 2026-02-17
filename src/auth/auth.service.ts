import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { LoginAuthDto } from './dto/login-auth.dto';
import { CreateAuthDto } from './dto/create-auth.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async validarUsuario(nombreUsuario: string, contrasena: string) {
    console.log(`[AUTH] Intentando validar usuario: ${nombreUsuario}`);
    // TODO: Después de ejecutar migración, descomentar línea siguiente y comentar las dos siguientes
    // const usuario = (await this.usersService.obtenerPorNombreUsuario(nombreUsuario)) || (await this.usersService.obtenerPorCorreo(nombreUsuario));
    const usuario =
      (await this.usersService.obtenerPorNombres(nombreUsuario)) ||
      (await this.usersService.obtenerPorCorreo(nombreUsuario));

    if (!usuario) {
      console.log(`[AUTH] Usuario no encontrado: ${nombreUsuario}`);
      return null;
    }

    // TODO: Después de ejecutar migración, descomentar para mostrar nombreUsuario
    // console.log(`[AUTH] Usuario encontrado: ${usuario.nombreUsuario} - ${usuario.nombres} (ID: ${usuario.id})`);
    console.log(`[AUTH] Usuario encontrado: ${usuario.nombres} (ID: ${usuario.id})`);
    console.log(`[AUTH] Hash en BD: ${usuario.hashContrasena.substring(0, 30)}...`);
    console.log(`[AUTH] Contraseña recibida: "${contrasena.substring(0, 3)}***" (longitud: ${contrasena.length})`);

    try {
      const matches = await argon2.verify(usuario.hashContrasena, contrasena);
      console.log(`[AUTH] Coincidencia de contraseña para ${nombreUsuario}: ${matches}`);

      if (matches) {
        const { hashContrasena: _hashContrasena, ...resultado } = usuario;
        return resultado;
      }
    } catch (error) {
      console.error(`[AUTH] Error al verificar contraseña:`, error);
    }

    return null;
  }

  async login(loginAuthDto: LoginAuthDto) {
    const usuario = await this.validarUsuario(
      loginAuthDto.nombres,
      loginAuthDto.contrasena,
    );

    if (!usuario) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (usuario.estado !== 'ACTIVO') {
      throw new UnauthorizedException('Usuario inactivo o suspendido');
    }

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoIngreso: new Date() },
    });

    // Obtener permisos dinámicos del usuario
    const asignaciones = await this.prisma.asignacionRolUsuario.findMany({
      where: { usuarioId: usuario.id },
      include: {
        rol: true,
      },
    });

    // Obtener rutaDefault del primer rol asignado
    const rolDinamico = asignaciones[0]?.rol;
    const rutaDefault = rolDinamico?.rutaDefault || '/admin';

    // Permisos personalizados del usuario (si existen, tienen precedencia)
    const permisosPersonalizados = await this.prisma.asignacionPermisoUsuario.findMany({
      where: { usuarioId: usuario.id },
      include: { permiso: true },
    });

    // Obtener permisos completos con metadata de sidebar
    const rolPermisos = await this.prisma.rolPermiso.findMany({
      where: {
        rolId: { in: asignaciones.map((a) => a.rolId) },
      },
      include: {
        permiso: true,
      },
    });

    const permisosEfectivos =
      permisosPersonalizados.length > 0
        ? permisosPersonalizados.map((p) => p.permiso)
        : rolPermisos.map((rp) => rp.permiso);

    // Aplanar permisos (solo acciones para JWT)
    const uniquePermisos = [...new Set(permisosEfectivos.map((p) => p.accion))];

    // Construir sidebar agrupado por módulo
    const permisosConMeta = permisosEfectivos;
    const permisosUnicos = permisosConMeta.filter(
      (p, i, arr) => arr.findIndex((x) => x.id === p.id) === i,
    );

    // Agrupar por módulo para el sidebar
    const modulosMap = new Map<
      string,
      { nombre: string; permisos: typeof permisosUnicos }
    >();
    for (const p of permisosUnicos) {
      if (!p.esNavegable) continue;
      const grupo = modulosMap.get(p.modulo) || {
        nombre: p.modulo,
        permisos: [],
      };
      grupo.permisos.push(p);
      modulosMap.set(p.modulo, grupo);
    }

    const sidebar = Array.from(modulosMap.entries()).map(
      ([modulo, grupo]) => ({
        modulo,
        items: grupo.permisos
          .sort((a, b) => a.orden - b.orden)
          .map((p) => ({
            id: p.accion,
            nombre: p.nombre,
            icono: p.icono,
            ruta: p.ruta,
            orden: p.orden,
          })),
      }),
    );

    const payload = {
      sub: usuario.id,
      nombres: usuario.nombres,
      rol: usuario.rol,
      permisos: uniquePermisos,
    };

    return {
      access_token: this.jwtService.sign(payload),
      usuario: {
        id: usuario.id,
        nombres: usuario.nombres,
        apellidos: usuario.apellidos,
        correo: usuario.correo,
        rol: usuario.rol,
        permisos: uniquePermisos,
        rutaDefault,
        sidebar,
      },
    };
  }

  async registrarUsuario(dto: CreateAuthDto) {
    const usuario = await this.usersService.crear({
      nombres: dto.nombres,
      apellidos: dto.apellidos,
      correo: dto.correo,
      password: dto.password,
      rol: dto.rol,
    });

    const payload = {
      sub: usuario.id,
      nombres: usuario.nombres,
      rol: usuario.rol,
    };

    return {
      access_token: this.jwtService.sign(payload),
      usuario,
    };
  }

  async obtenerTodosLosUsuarios() {
    const mostrarUsuarios = await this.prisma.usuario.findMany();
    return mostrarUsuarios;
  }
}
