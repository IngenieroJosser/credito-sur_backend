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
  @IsOptional()
  cajaId?: string;

  @IsString()
  @IsOptional()
  creadoPorId?: string;

  @IsEnum(MetodoPago)
  @IsOptional()
  metodoPago?: MetodoPago;

  @IsString()
  @IsOptional()
  notas?: string;

  // Clave de idempotencia: si la venta se registró offline y se reintenta al
  // sincronizar, la misma clave evita duplicar el movimiento de dinero.
  @IsString()
  @IsOptional()
  idempotencyKey?: string;
}
