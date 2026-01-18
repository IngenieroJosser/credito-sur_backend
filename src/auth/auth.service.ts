import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { LoginAuthDto } from './dto/login-auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validarUsuario(correo: string, pass: string): Promise<any> {
    const usuario = await this.usersService.obtenerPorCorreo(correo);
    if (usuario && (await argon2.verify(usuario.hashContrasena, pass))) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { hashContrasena, ...resultado } = usuario;
      return resultado;
    }
    return null;
  }

  async login(loginAuthDto: LoginAuthDto) {
    const usuario = await this.validarUsuario(
      loginAuthDto.correo,
      loginAuthDto.password,
    );

    if (!usuario) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (usuario.estado !== 'ACTIVO') {
      throw new UnauthorizedException('Usuario inactivo o suspendido');
    }

    const payload = {
      email: usuario.correo,
      sub: usuario.id,
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
}
