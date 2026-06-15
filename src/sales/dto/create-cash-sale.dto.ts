import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { MetodoPago } from '@prisma/client';

export class CreateCashSaleDto {
  @IsString()
  clienteId: string;

  @IsString()
  productoId: string;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(1)
  precioVenta: number;

  @IsString()
  cajaId: string;

  @IsString()
  creadoPorId: string;

  @IsEnum(MetodoPago)
  @IsOptional()
  metodoPago?: MetodoPago;

  @IsString()
  @IsOptional()
  notas?: string;
}
