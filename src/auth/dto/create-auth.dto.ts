import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  IsEnum,
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
