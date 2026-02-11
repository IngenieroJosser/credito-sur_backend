import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from 'prisma/prisma.service';
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

    return this.prisma.usuario.create({
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
  }

  obtenerTodos() {
    return this.prisma.usuario.findMany({
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
      },
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

  async actualizar(id: string, usuarioDto: UpdateUserDto) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id } });
    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    const { password, ...restoDatos } = usuarioDto;

    type DatosActualizadosUsuario = typeof restoDatos & {
      hashContrasena?: string;
    };

    const datosActualizados: DatosActualizadosUsuario = { ...restoDatos };

    if (password) {
      datosActualizados.hashContrasena = await argon2.hash(password);
    }

    return this.prisma.usuario.update({
      where: { id },
      data: datosActualizados,
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
        actualizadoEn: true,
      },
    });
  }

  async eliminar(id: string) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id } });
    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    return this.prisma.usuario.update({
      where: { id },
      data: {
        estado: EstadoUsuario.INACTIVO,
        eliminadoEn: new Date(),
      },
    });
  }

  async cambiarContrasena(
    id: string,
    dto: ChangePasswordDto,
    actorRol?: string,
    actorId?: string,
  ) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id } });
    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    if (usuario.rol === 'SUPER_ADMINISTRADOR' && actorId !== usuario.id) {
      throw new UnauthorizedException(
        'No se puede cambiar la contraseña del superadministrador',
      );
    }

    const esAdmin = actorRol === 'SUPER_ADMINISTRADOR' || actorRol === 'ADMIN';

    if (!esAdmin) {
      if (!dto.contrasenaActual) {
        throw new UnauthorizedException('Contraseña actual requerida');
      }
      const ok = await argon2.verify(
        usuario.hashContrasena,
        dto.contrasenaActual,
      );
      if (!ok) {
        throw new UnauthorizedException('Contraseña actual inválida');
      }
      if (actorId !== usuario.id) {
        throw new UnauthorizedException(
          'Solo puedes cambiar tu propia contraseña',
        );
      }
    }

    const nuevoHash = await argon2.hash(dto.contrasenaNueva);
    await this.prisma.usuario.update({
      where: { id },
      data: {
        hashContrasena: nuevoHash,
        debeCambiarContrasena: false,
      },
    });

    return { mensaje: 'Contraseña actualizada' };
  }

  async resetearContrasena(id: string, actorRol?: string, _actorId?: string) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id } });
    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }
    const esAdmin = actorRol === 'SUPER_ADMINISTRADOR' || actorRol === 'ADMIN';
    if (!esAdmin) {
      throw new UnauthorizedException('No autorizado');
    }
    if (usuario.rol === 'SUPER_ADMINISTRADOR') {
      throw new UnauthorizedException(
        'No se puede resetear la contraseña del superadministrador',
      );
    }

    const temporal =
      Math.random().toString(36).slice(2, 7) +
      Math.random().toString(36).slice(2, 3).toUpperCase() +
      Math.floor(10 + Math.random() * 90).toString();

    const nuevoHash = await argon2.hash(temporal);
    await this.prisma.usuario.update({
      where: { id },
      data: {
        hashContrasena: nuevoHash,
        debeCambiarContrasena: true,
      },
    });

    return { contrasenaTemporal: temporal };
  }
}
