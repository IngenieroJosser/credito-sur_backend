import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginAuthDto {
  @ApiProperty({
    example: 'Coordinador',
    description: 'Nombre de usuario',
  })
  @IsString()
  @IsNotEmpty()
  nombres: string;

  @ApiProperty({
    example: 'COORDINADOR_1234',
    description: 'Contraseña del usuario',
  })
  @IsString()
  @IsNotEmpty()
  contrasena: string;
}
