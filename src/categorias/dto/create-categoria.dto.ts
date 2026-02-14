import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateCategoriaDto {
  @IsString()
  nombre: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsString()
  tipo: string;

  @IsOptional()
  @IsString()
  color?: string;
}

export class UpdateCategoriaDto extends CreateCategoriaDto {
  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}
