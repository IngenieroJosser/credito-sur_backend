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

export enum TipoPrestamoDto {
  EFECTIVO = 'EFECTIVO',
  ARTICULO = 'ARTICULO',
}

export enum OrigenOperacionPrestamo {
  RUTA = 'RUTA',
  ADMIN = 'ADMIN',
  OFICINA = 'OFICINA',
  PUNTO_VENTA = 'PUNTO_VENTA',
}

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

  @Transform(({ value }) => {
    const normalized = String(value || '')
      .trim()
      .toUpperCase();
    if (normalized === 'PRESTAMO') return TipoPrestamoDto.EFECTIVO;
    if (normalized === 'ARTICULO') return TipoPrestamoDto.ARTICULO;
    return normalized;
  })
  @IsEnum(TipoPrestamoDto)
  @IsNotEmpty()
  tipoPrestamo: TipoPrestamoDto;

  @Transform(({ value }) =>
    value === null || value === undefined || value === ''
      ? undefined
      : parseFloat(value),
  )
  @IsNumber()
  @Min(0)
  monto: number;

  @Transform(({ value }) =>
    value === null || value === undefined || value === ''
      ? undefined
      : parseFloat(value),
  )
  @IsNumber()
  @Min(0)
  @ValidateIf((o) => String(o.tipoPrestamo || '').toUpperCase() !== 'ARTICULO')
  tasaInteres: number;

  @Transform(({ value }) =>
    value === null || value === undefined || value === ''
      ? undefined
      : parseFloat(value),
  )
  @IsNumber()
  @Min(0)
  @IsOptional()
  tasaInteresMora?: number;

  @Transform(({ value }) =>
    value === null || value === undefined || value === ''
      ? undefined
      : parseFloat(value),
  )
  @IsNumber()
  @Min(0.01)
  plazoMeses: number;

  @Transform(({ value }) =>
    value === null || value === undefined || value === ''
      ? undefined
      : parseInt(value),
  )
  @IsNumber()
  @Min(1)
  @IsOptional()
  cantidadCuotas?: number;

  @Transform(({ value }) =>
    value === null || value === undefined || value === ''
      ? undefined
      : parseInt(value),
  )
  @IsNumber()
  @Min(1)
  @IsOptional()
  cuotas?: number;

  @Transform(({ value }) =>
    value === null || value === undefined || value === ''
      ? undefined
      : parseInt(value),
  )
  @IsNumber()
  @Min(1)
  @IsOptional()
  cuotasTotales?: number;

  @IsEnum(FrecuenciaPago)
  frecuenciaPago: FrecuenciaPago;

  @IsDateString()
  fechaInicio: string;

  /**
   * Quién crea el crédito. Lo pone el servidor, no quien llama.
   *
   * Es opcional a propósito, aunque el crédito no pueda existir sin creador: el
   * controlador lo sobrescribe SIEMPRE con el id del JWT
   * (`loans.controller.ts`, «Asignar creador automáticamente desde el JWT»).
   * Siendo obligatorio, la API exigía un dato que después ignoraba: quien no lo
   * mandaba recibía «Falta indicar creado por id», y quien mandaba el de otra
   * persona veía cómo se corregía en silencio. Lo segundo está bien —no se
   * puede suplantar al creador, comprobado— pero lo primero es una trampa.
   */
  @IsOptional()
  @IsString()
  creadoPorId?: string;

  @Transform(({ value }) =>
    value === null || value === undefined || value === ''
      ? undefined
      : parseFloat(value),
  )
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

  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsOptional()
  esContado?: boolean;

  @IsString()
  @IsOptional()
  idempotencyKey?: string;

  @IsString()
  @IsOptional()
  rutaId?: string;

  @IsString()
  @IsOptional()
  cobradorId?: string;

  @IsString()
  @IsOptional()
  cajaId?: string;

  @Transform(({ value }) =>
    value === null || value === undefined || value === ''
      ? undefined
      : String(value).trim().toUpperCase(),
  )
  @IsEnum(OrigenOperacionPrestamo)
  @IsOptional()
  origenOperacion?: OrigenOperacionPrestamo;

  @Transform(({ value }) =>
    value === null || value === undefined || value === ''
      ? undefined
      : parseInt(value),
  )
  @IsNumber()
  @IsOptional()
  version?: number;
}
