import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { LoginAuthDto } from './dto/login-auth.dto';
import { CreateAuthDto } from './dto/create-auth.dto';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async validarUsuario(nombres: string, contrasena: string) {
    console.log('[VALIDAR] Buscando usuario con nombres:', nombres);
    
    const usuario = await this.usersService.obtenerPorNombres(nombres);
    
    console.log('[VALIDAR] Usuario encontrado:', usuario ? JSON.stringify(usuario, null, 2) : 'No');

    if (usuario && (await argon2.verify(usuario.hashContrasena, contrasena))) {
      console.log('[VALIDAR] Contraseña correcta');
      const { hashContrasena, ...resultado } = usuario;
      return resultado;
    }

    console.log('[VALIDAR] Contraseña incorrecta o usuario no existe');
    return null;
  }

  async login(loginAuthDto: LoginAuthDto) {
    console.log('[AUTH] Intento de login con nombres:', loginAuthDto.nombres);
    
    const usuario = await this.validarUsuario(
      loginAuthDto.nombres,
      loginAuthDto.contrasena,
    );

    console.log('[AUTH] Usuario encontrado:', usuario ? 'Sí' : 'No');

    if (!usuario) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (usuario.estado !== 'ACTIVO') {
      throw new UnauthorizedException('Usuario inactivo o suspendido');
    }

    const payload = {
      sub: usuario.id,
      nombres: usuario.nombres,
      rol: usuario.rol,
    };

    return {
      access_token: this.jwtService.sign(payload),
      usuario: {
        id: usuario.id,
        nombres: usuario.nombres,
        apellidos: usuario.apellidos,
        correo: usuario.correo,
        rol: usuario.rol,
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
