import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsDateString,
  Min,
  IsNotEmpty,
} from 'class-validator';
import { MetodoPago } from '@prisma/client';

export class CreatePaymentDto {
  @IsString()
  @IsNotEmpty()
  clienteId: string;

  @IsString()
  @IsNotEmpty()
  prestamoId: string;

  @IsString()
  @IsNotEmpty()
  cobradorId: string;

  @IsNumber()
  @Min(1)
  montoTotal: number;

  @IsEnum(MetodoPago)
  @IsOptional()
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
