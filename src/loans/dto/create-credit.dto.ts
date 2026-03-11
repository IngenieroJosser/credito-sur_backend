import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsDateString,
  Min,
  IsBoolean,
} from 'class-validator';
import { FrecuenciaPago } from '@prisma/client';
import { Transform } from 'class-transformer';

export class CreateLoanLegacyDto {
  @IsString()
  clienteId: string;

  @IsString()
  @IsOptional()
  productoId?: string;

  @IsString()
  @IsOptional()
  precioProductoId?: string;

  @IsString()
  tipoPrestamo: string; // 'EFECTIVO' o 'ARTICULO'

  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  @Min(0)
  monto: number;

  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  @Min(0)
  tasaInteres: number;

  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  @Min(0)
  @IsOptional()
  tasaInteresMora?: number;

  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  @Min(0.01)
  plazoMeses: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  cantidadCuotas?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  cuotas?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  cuotasTotales?: number;

  @IsEnum(FrecuenciaPago)
  frecuenciaPago: FrecuenciaPago;

  @IsDateString()
  fechaInicio: string;

  @IsString()
  creadoPorId: string;

  @IsString()
  @IsOptional()
  notas?: string;

  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  @Min(0)
  @IsOptional()
  cuotaInicial?: number;

  @IsBoolean()
  @IsOptional()
  generarAprobacionAutomatica?: boolean;
}

export class CreateLoanWithArticleDto extends CreateLoanLegacyDto {
  @IsString()
  @IsOptional()
  articuloNombre?: string;

  @IsString()
  @IsOptional()
  articuloDescripcion?: string;

  @IsString()
  @IsOptional()
  categoriaArticulo?: string;

  @IsString()
  @IsOptional()
  imagenArticuloUrl?: string;

  @IsNumber()
  @IsOptional()
  stockArticulo?: number;
}
