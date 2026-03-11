import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsDateString,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { MetodoPago } from '@prisma/client';

export class CreatePaymentDto {
  @IsString()
  @IsOptional()
  clienteId?: string;

  @IsString()
  @IsOptional()
  prestamoId?: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => value?.toString().trim())
  cobradorId?: string;

  @IsNumber({}, { message: 'montoTotal debe ser un número válido' })
  @Min(1, { message: 'montoTotal debe ser mayor a 0' })
  @Type(() => Number)
  @Transform(({ value }) => {
    if (typeof value === 'string') return parseFloat(value);
    return value;
  })
  montoTotal: number;

  @IsOptional()
  @Transform(({ value }) => value?.toString().toUpperCase())
  @IsEnum(MetodoPago, { message: 'metodoPago debe ser EFECTIVO o TRANSFERENCIA' })
  metodoPago?: MetodoPago;

  @IsDateString()
  @IsOptional()
  fechaPago?: string;

  @IsString()
  @IsOptional()
  numeroReferencia?: string;

  @IsString()
  @IsOptional()
  notas?: string;
}
