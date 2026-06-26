import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginAuthDto {
  @ApiProperty({
    example: 'erick.manuel',
    description:
      'Nombre de usuario, correo o nombre completo del usuario.',
    required: false,
  })
  @IsString()
  @IsOptional()
  identificador?: string;

  @ApiProperty({
    example: 'erick.manuel',
    description: 'Compatibilidad con el payload anterior del frontend.',
    required: false,
  })
  @IsString()
  @IsOptional()
  nombres?: string;

  @ApiProperty({
    example: 'usuario@credisur.com',
    description: 'Correo del usuario. Se acepta por compatibilidad.',
    required: false,
  })
  @IsString()
  @IsOptional()
  correo?: string;

  @ApiProperty({
    example: 'usuario@credisur.com',
    description: 'Alias de correo para clientes que envían email.',
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
