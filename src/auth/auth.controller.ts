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
import { ApiTags, ApiOperation, ApiOkResponse, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Publico } from './decorators/public.decorator';

@ApiTags('Gestión de autenticación')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
  login(@Body() loginAuthDto: LoginAuthDto) {
    return this.authService.login(loginAuthDto);
  }

  @Publico()
  @Post('register')
  @ApiOperation({ summary: 'Registrar usuario' })
  @ApiBody({ type: CreateAuthDto })
  registrar(@Body() dto: CreateAuthDto) {
    return this.authService.registrarUsuario(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('perfil')
  @ApiOperation({ summary: 'Obtener perfil del usuario autenticado' })
  obtenerPerfil(@Request() req: { user: unknown }) {
    return req.user;
  }
}
