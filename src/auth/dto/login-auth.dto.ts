import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginAuthDto {
  @ApiProperty({
    example: 'erick.manuel',
    description: 'Nombre de usuario (nombreUsuario), correo o alias de correo.',
    required: false,
  })
  @IsString()
  @IsOptional()
  identificador?: string;

  @ApiProperty({
    example: 'erick.manuel',
    description: 'Nombre de usuario (nombreUsuario) del usuario.',
    required: false,
  })
  @IsString()
  @IsOptional()
  nombreUsuario?: string;

  @ApiProperty({
    example: 'usuario@credisur.com',
    description: 'Correo del usuario.',
    required: false,
  })
  @IsString()
  @IsOptional()
  correo?: string;

  @ApiProperty({
    example: 'usuario@credisur.com',
    description: 'Alias de correo (compatibilidad con clientes que envían email).',
    required: false,
  })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiProperty({
    example: 'miContrasena123',
    description: 'Contraseña del usuario',
  })
  @IsString()
  @IsNotEmpty()
  contrasena: string;
}
