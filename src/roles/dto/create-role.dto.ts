import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsBoolean()
  @IsOptional()
  esSistema?: boolean;
}
