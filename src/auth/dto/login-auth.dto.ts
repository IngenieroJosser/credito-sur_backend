import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginAuthDto {
  @ApiProperty({
    example: 'Erick Manuel',
    description: 'Nombres del usuario (campo "nombres" del registro)',
  })
  @IsString()
  @IsNotEmpty()
  nombres: string;

  @ApiProperty({
    example: 'miContrasena123',
    description: 'Contraseña del usuario',
  })
  @IsString()
  @IsNotEmpty()
  contrasena: string;
}
