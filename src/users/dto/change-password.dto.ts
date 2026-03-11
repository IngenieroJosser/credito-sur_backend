import { IsString, MinLength, IsOptional, IsNotEmpty } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @IsOptional()
  @IsNotEmpty({ message: 'La contraseña actual no puede estar vacía si se proporciona' })
  contrasenaActual?: string;

  @IsString()
  @MinLength(6, { message: 'La nueva contraseña debe tener al menos 6 caracteres' })
  @IsNotEmpty({ message: 'La nueva contraseña es requerida' })
  contrasenaNueva!: string;
}
