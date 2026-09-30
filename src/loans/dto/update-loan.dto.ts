import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  EstadoPrestamo,
  FrecuenciaPago,
  TipoAmortizacion,
  TipoContenidoMultimedia,
} from '@prisma/client';

/**
 * Un adjunto de un credito.
 *
 * NO se reutiliza el `CreateMultimediaDto` de clientes, aunque los campos coincidan: su
 * `tipoContenido` valida contra `TIPOS_CONTENIDO_CLIENTE`, que son cuatro valores de
 * cliente (foto de perfil, cedula por los dos lados, comprobante de domicilio). Un
 * adjunto de credito usa otros del mismo enum —`CONTRATO_PRESTAMO`, `FOTO_PRODUCTO`,
 * `OTRO_DOCUMENTO`— y habrian sido RECHAZADOS. Se detecto al correr la prueba del cuerpo
 * completo, que es justo para lo que estaba.
 *
 * Aqui se valida contra el enum completo de Prisma, que es el tipo de la columna donde
 * este valor acaba.
 */
export class ArchivoPrestamoDto {
  @ApiProperty({ enum: TipoContenidoMultimedia })
  @IsEnum(TipoContenidoMultimedia)
  tipoContenido: TipoContenidoMultimedia;

  @ApiProperty()
  @IsString()
  tipoArchivo: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  nombreOriginal?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  nombreAlmacenamiento?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  ruta?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  url?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  tamanoBytes?: number;

  @ApiProperty({
    required: false,
    description: 'Extension; se deriva si no viene',
  })
  @IsString()
  @IsOptional()
  formato?: string;

  /**
   * El nombre que le pone Multer al fichero recien subido. No es columna: la de verdad es
   * `ruta`. Se lee en la cadena `url || path || ruta`.
   */
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  path?: string;
}

/**
 * El cuerpo de `PATCH /loans/:id`.
 *
 * Antes este archivo era `class UpdateLoanDto extends PartialType(CreateLoanDto) {}` y
 * el controlador NO lo usaba: recibia `@Body() updateData: any`. Sin un DTO el
 * ValidationPipe no tiene contra que validar, asi que ese endpoint aceptaba cualquier
 * cuerpo, de cualquier forma y con cualquier tipo, y lo pasaba al servicio tal cual. Un
 * `monto` con texto o un `estado` inventado llegaban hasta Prisma.
 *
 * Los campos son EXACTAMENTE los catorce que `updateLoan` lee de ese cuerpo (se
 * inventariaron uno por uno sobre las 352 lineas del metodo). Dos cosas importantes de
 * por que se declara asi y no con `PartialType(CreateLoanDto)`:
 *
 *  - `PartialType(CreateLoanDto)` NO trae `estado` ni `archivos`, que el servicio si usa.
 *    Con `whitelist: true` se habrian descartado en silencio y la edicion habria dejado
 *    de poder cambiar el estado o los adjuntos.
 *  - Trae en cambio una docena que la edicion ignora (`clienteId`, `productoId`,
 *    `idempotencyKey`, `esContado`...). Aceptar campos que no se usan invita a creer que
 *    sirven.
 *
 * `version` va incluida a proposito: el frontend la manda
 * (`EditarPrestamoModal`: `if (versionRef.current != null) payload.version = ...`) y de
 * ella depende el control de conflictos por bloqueo optimista. Si no estuviera declarada,
 * el whitelist la borraria y ese control dejaria de funcionar sin que nada avisara.
 */
export class UpdateLoanDto {
  @ApiProperty({ required: false, description: 'Monto financiado' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  monto?: number;

  @ApiProperty({ required: false, description: 'Tasa de interés' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  tasaInteres?: number;

  @ApiProperty({ required: false, description: 'Tasa de interés por mora' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  tasaInteresMora?: number;

  @ApiProperty({ required: false, description: 'Plazo en meses' })
  @IsNumber()
  @Min(0.01)
  @IsOptional()
  plazoMeses?: number;

  @ApiProperty({ required: false, description: 'Cantidad de cuotas' })
  @IsNumber()
  @Min(1)
  @IsOptional()
  cantidadCuotas?: number;

  @ApiProperty({ required: false, enum: FrecuenciaPago })
  @IsEnum(FrecuenciaPago)
  @IsOptional()
  frecuenciaPago?: FrecuenciaPago;

  /**
   * El servicio ya comprueba que sea un miembro del enum antes de escribirlo
   * (`estadosValidos.includes(...)`); aqui se rechaza de entrada, con un mensaje claro.
   */
  @ApiProperty({ required: false, enum: EstadoPrestamo })
  @IsEnum(EstadoPrestamo)
  @IsOptional()
  estado?: EstadoPrestamo;

  @ApiProperty({ required: false, enum: TipoAmortizacion })
  @IsEnum(TipoAmortizacion)
  @IsOptional()
  tipoAmortizacion?: TipoAmortizacion;

  @ApiProperty({ required: false, description: 'Cuota inicial' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  cuotaInicial?: number;

  @ApiProperty({ required: false, description: 'Fecha de inicio (ISO)' })
  @IsDateString()
  @IsOptional()
  fechaInicio?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notas?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  garantia?: string;

  /**
   * Version para el bloqueo optimista. Ver la nota de arriba: sin declararla, el
   * whitelist la borraria y el control de conflictos quedaria inerte.
   */
  @ApiProperty({
    required: false,
    description: 'Versión para control de conflictos',
  })
  @IsNumber()
  @IsOptional()
  version?: number;

  /** Adjuntos del credito. Ver `ArchivoPrestamoDto` arriba. */
  @ApiProperty({ required: false, type: [ArchivoPrestamoDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ArchivoPrestamoDto)
  @IsOptional()
  archivos?: ArchivoPrestamoDto[];
}
