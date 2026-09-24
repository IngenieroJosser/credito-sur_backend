import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MAX_MESES_PLAZO } from '../../common/plazos';

class CreatePrecioDto {
  @IsNumber()
  @Min(1)
  // El negocio financia hasta tres meses. Sin este tope, el formulario podia
  // mandar 6, 12 o 24 y quedaban guardados: de ahi salieron los precios a 6 y
  // 12 meses que hay en la base de desarrollo.
  @Max(MAX_MESES_PLAZO, {
    message: `El plazo no puede pasar de ${MAX_MESES_PLAZO} meses`,
  })
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
