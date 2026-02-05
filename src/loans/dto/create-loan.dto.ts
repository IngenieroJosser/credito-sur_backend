import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsDateString,
  Min,
} from 'class-validator';
import { FrecuenciaPago } from '@prisma/client';

export class CreateLoanDto {
  @IsString()
  clienteId: string;

  @IsString()
  @IsOptional()
  productoId?: string;

  @IsString()
  @IsOptional()
  precioProductoId?: string;

  @IsString()
  tipoPrestamo: string;

  @IsNumber()
  @Min(0)
  monto: number;

  @IsNumber()
  @Min(0)
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
  creadoPorId: string;
}
