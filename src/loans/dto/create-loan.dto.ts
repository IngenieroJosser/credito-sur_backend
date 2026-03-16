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
import { FrecuenciaPago, TipoAmortizacion } from '@prisma/client';
import { Transform } from 'class-transformer';

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

  @Transform(({ value }) => (value === null || value === undefined || value === '') ? undefined : parseFloat(value))
  @IsNumber()
  @Min(0)
  monto: number;

  @Transform(({ value }) => (value === null || value === undefined || value === '') ? undefined : parseFloat(value))
  @IsNumber()
  @Min(0)
  @ValidateIf((o) => o.tipoPrestamo === 'prestamo')
  tasaInteres: number;

  @Transform(({ value }) => (value === null || value === undefined || value === '') ? undefined : parseFloat(value))
  @IsNumber()
  @Min(0)
  tasaInteresMora: number;

  @Transform(({ value }) => (value === null || value === undefined || value === '') ? undefined : parseFloat(value))
  @IsNumber()
  @Min(0.01)
  plazoMeses: number;

  @Transform(({ value }) => (value === null || value === undefined || value === '') ? undefined : parseInt(value))
  @IsNumber()
  @Min(1)
  @IsOptional()
  cantidadCuotas?: number;

  @Transform(({ value }) => (value === null || value === undefined || value === '') ? undefined : parseInt(value))
  @IsNumber()
  @Min(1)
  @IsOptional()
  cuotas?: number;

  @Transform(({ value }) => (value === null || value === undefined || value === '') ? undefined : parseInt(value))
  @IsNumber()
  @Min(1)
  @IsOptional()
  cuotasTotales?: number;

  @IsEnum(FrecuenciaPago)
  frecuenciaPago: FrecuenciaPago;

  @IsDateString()
  fechaInicio: string;

  @IsString()
  @IsNotEmpty()
  creadoPorId: string;

  @Transform(({ value }) => (value === null || value === undefined || value === '') ? undefined : parseFloat(value))
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

  @IsEnum(TipoAmortizacion)
  @IsOptional()
  tipoAmortizacion?: TipoAmortizacion;

  @IsString()
  @IsOptional()
  garantia?: string;

  @IsOptional()
  esContado?: boolean;
}
