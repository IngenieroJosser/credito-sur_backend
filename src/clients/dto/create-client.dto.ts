import {
  IsString,
  IsOptional,
  IsEmail,
  IsEnum,
  IsBoolean,
  IsNumber,
  Min,
  Max,
  IsArray,
  ValidateNested,
  IsNotEmpty,
  Matches,
  Length,
} from 'class-validator';
import { Type } from 'class-transformer';
import { NivelRiesgo } from '@prisma/client';

export class CreateMultimediaDto {
  @IsEnum([
    'FOTO_PERFIL',
    'DOCUMENTO_IDENTIDAD_FRENTE',
    'DOCUMENTO_IDENTIDAD_REVERSO',
    'COMPROBANTE_DOMICILIO',
  ])
  @IsNotEmpty()
  tipoContenido: string;

  @IsString()
  @IsNotEmpty()
  tipoArchivo: string;

  @IsString()
  @IsNotEmpty()
  nombreOriginal: string;

  @IsString()
  @IsOptional()
  nombreAlmacenamiento?: string;

  @IsString()
  @IsOptional()
  ruta?: string;

  @IsString()
  @IsOptional()
  url?: string;

  @IsNumber()
  @IsOptional()
  tamanoBytes?: number;

  /**
   * Extension del archivo. Es columna del modelo (schema.prisma:822) y el
   * servicio la usa; faltaba declararla aqui.
   */
  formato?: string;

  /**
   * Quien subio el archivo. Columna del modelo (schema.prisma:836).
   */
  subidoPorId?: string;

  /**
   * El nombre que le pone Multer al fichero recien subido. NO es columna del
   * modelo -la de verdad es `ruta`- pero llega cuando el archivo viene del
   * formulario en vez de la base. Se lee en cadena: `url || path || ruta`.
   */
  path?: string;
}

export class CreateClientDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+$/, { message: 'La Cédula debe contener solo números.' })
  @Length(6, 10, { message: 'La Cédula debe tener entre 6 y 10 dígitos.' })
  dni: string;

  @IsString()
  @IsNotEmpty()
  nombres: string;

  @IsString()
  @IsNotEmpty()
  apellidos: string;

  @IsString()
  @IsNotEmpty()
  telefono: string;

  @IsString()
  @IsOptional()
  direccion?: string;

  @IsString()
  @IsOptional()
  referencia?: string;

  @IsString()
  @IsOptional()
  referencia1Nombre?: string;

  @IsString()
  @IsOptional()
  referencia1Telefono?: string;

  @IsString()
  @IsOptional()
  referencia2Nombre?: string;

  @IsString()
  @IsOptional()
  referencia2Telefono?: string;

  @IsEmail()
  @IsOptional()
  correo?: string;

  @IsEnum(NivelRiesgo)
  @IsOptional()
  nivelRiesgo?: NivelRiesgo;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  puntaje?: number;

  @IsBoolean()
  @IsOptional()
  enListaNegra?: boolean;

  @IsString()
  @IsOptional()
  razonListaNegra?: string;

  @IsString()
  @IsOptional()
  rutaId?: string;

  @IsString()
  @IsOptional()
  observaciones?: string;

  @IsString()
  @IsOptional()
  creadoPorId?: string;

  @IsString()
  @IsOptional()
  idempotencyKey?: string;

  @IsNumber()
  @IsOptional()
  version?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMultimediaDto)
  archivos?: CreateMultimediaDto[];
}
