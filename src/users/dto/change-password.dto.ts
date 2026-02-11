import { IsString, MinLength, IsOptional } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @IsOptional()
  contrasenaActual?: string;

  @IsString()
  @MinLength(6)
  contrasenaNueva!: string;
}
