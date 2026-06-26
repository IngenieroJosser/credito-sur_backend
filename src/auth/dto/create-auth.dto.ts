import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  IsEnum,
  Length,
  Matches,
} from 'class-validator';
import { RolUsuario } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAuthDto {
  @ApiProperty({ example: 'Pepito' })
  @IsString()
  @IsNotEmpty()
  nombres: string;

  @ApiProperty({ example: 'Perez' })
  @IsString()
  @IsNotEmpty()
  apellidos: string;

  @ApiProperty({ example: 'pepito-perez@credisur.com' })
  @IsEmail()
  correo: string;

  @ApiProperty({ example: 'pepito.perez' })
  @IsString()
  @IsNotEmpty()
  @Length(3, 50)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message:
      'El nombre de usuario solo puede contener letras, números, punto, guion y guion bajo.',
  })
  nombreUsuario: string;

  @ApiProperty({
    example: 'Password123!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({
    enum: RolUsuario,
    example: RolUsuario.COORDINADOR,
  })
  @IsEnum(RolUsuario)
  rol: RolUsuario;
}
