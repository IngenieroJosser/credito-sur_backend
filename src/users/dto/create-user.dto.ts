import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MinLength,
} from 'class-validator';
import { RolUsuario, EstadoUsuario } from '@prisma/client';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  nombres: string;

  @IsString()
  @IsNotEmpty()
  apellidos: string;

  @IsEmail()
  @IsNotEmpty()
  correo: string;

  @IsString()
  @IsNotEmpty()
  @Length(3, 50)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message:
      'El nombre de usuario solo puede contener letras, números, punto, guion y guion bajo.',
  })
  nombreUsuario: string;

  @IsString()
  @MinLength(6)
  @IsNotEmpty()
  password: string;

  @IsEnum(RolUsuario)
  @IsNotEmpty()
  rol: RolUsuario;

  @IsString()
  @IsOptional()
  telefono?: string;

  @IsEnum(EstadoUsuario)
  @IsOptional()
  estado?: EstadoUsuario;
}
