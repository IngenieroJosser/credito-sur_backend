import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

class CreatePrecioDto {
  @IsNumber()
  @Min(1)
  meses: number;

  @IsNumber()
  @Min(0)
  precio: number;
}

export class CreateInventoryDto {
  @IsString()
  @IsNotEmpty()
  codigo: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsString()
  @IsOptional()
  categoria?: string;

  @IsString()
  @IsOptional()
  categoriaId?: string;

  @IsString()
  @IsOptional()
  marca?: string;

  @IsString()
  @IsOptional()
  modelo?: string;

  @IsNumber()
  @Min(0)
  costo: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  precioContado?: number; // Optional until schema supports it or we use logic

  @IsNumber()
  @Min(0)
  stock: number;

  @IsNumber()
  @Min(0)
  stockMinimo: number;

  @IsBoolean()
  @IsOptional()
  activo?: boolean;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreatePrecioDto)
  precios?: CreatePrecioDto[];
}
