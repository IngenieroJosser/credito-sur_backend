import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  UseGuards,
  Request,
} from '@nestjs/common';

import { AuthService } from './auth.service';
import { LoginAuthDto } from './dto/login-auth.dto';
import { CreateAuthDto } from './dto/create-auth.dto';
import { ForgotPasswordDto, VerifyResetCodeDto } from './dto/forgot-password.dto';

import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Publico } from './decorators/public.decorator';

@ApiTags('Gestión de autenticación')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Publico()
  @Get()
  @ApiOperation({ summary: 'Listar usuarios registrados' })
  obtenerTodosLosUsuarios() {
    return this.authService.obtenerTodosLosUsuarios();
  }

  @Publico()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión' })
  @ApiBody({ type: LoginAuthDto })
  @ApiOkResponse({
    description: 'Login exitoso',
    schema: {
      example: {
        access_token: 'jwt.token.aqui',
        usuario: {
          id: 'uuid',
          nombres: 'Coordinador',
          apellidos: 'General',
          rol: 'COORDINADOR',
        },
      },
    },
  })
  login(@Body() dto: LoginAuthDto) {
    return this.authService.login(dto);
  }

  @Publico()
  @Post('register')
  @ApiOperation({ summary: 'Registrar usuario' })
  @ApiBody({ type: CreateAuthDto })
  registrar(@Body() dto: CreateAuthDto) {
    return this.authService.registrarUsuario(dto);
  }

  // 👤 Perfil
  @UseGuards(JwtAuthGuard)
  @Get('perfil')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Perfil del usuario autenticado' })
  obtenerPerfil(@Request() req: { user: unknown }) {
    return req.user;
  }

  @UseGuards(JwtAuthGuard)
  @Get('refresh')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refrescar sesión del usuario autenticado (permisos + sidebar + token)' })
  refresh(@Request() req: { user: { id?: string } }) {
    return this.authService.refreshSession(String(req.user?.id || ''));
  }

  // Recuperacion de contrasena — acceso publico
  @Publico()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Solicitar codigo de recuperacion de contrasena (solo Superadmin)' })
  async olvidarContrasena(@Body() dto: ForgotPasswordDto) {
    return this.authService.solicitarRecuperacion(dto);
  }

  @Publico()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verificar codigo y cambiar contrasena' })
  async resetearContrasena(@Body() dto: VerifyResetCodeDto) {
    return this.authService.verificarCodigoRecuperacion(dto);
  }
}
