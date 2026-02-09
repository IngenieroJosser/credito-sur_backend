import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsDateString,
  Min,
  IsNotEmpty,
  ValidateIf,
} from 'class-validator';
import { FrecuenciaPago, TipoAprobacion } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateLoanDto {
  @IsString()
  @IsNotEmpty()
  clienteId: string;

  @IsString()
  @IsOptional()
  productoId?: string;

  @IsString()
  @IsOptional()
  precioProductoId?: string;

  @IsString()
  @IsNotEmpty()
  tipoPrestamo: string; // 'prestamo' o 'articulo'

  @IsNumber()
  @Min(0)
  monto: number;

  @IsNumber()
  @Min(0)
  @ValidateIf(o => o.tipoPrestamo === 'prestamo')
  tasaInteres: number;

  @IsNumber()
  @Min(0)
  tasaInteresMora: number;

  @IsNumber()
  @Min(1)
  plazoMeses: number;

  @IsEnum(FrecuenciaPago)
  frecuenciaPago: FrecuenciaPago;

  @IsDateString()
  fechaInicio: string;

  @IsString()
  @IsNotEmpty()
  creadoPorId: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  cuotaInicial?: number;

  @IsString()
  @IsOptional()
  notas?: string;

  @IsString()
  @IsOptional()
  fechaPrimerCobro?: string;
}
