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
  @IsOptional()
  tipoArchivo?: string;

  @IsString()
  @IsOptional()
  nombreOriginal?: string;

  @IsString()
  @IsOptional()
  nombreAlmacenamiento?: string;

  @IsString()
  @IsOptional()
  ruta?: string;

  @IsNumber()
  @IsOptional()
  tamanoBytes?: number;
}

export class CreateClientDto {
  @IsString()
  @IsNotEmpty()
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



  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMultimediaDto)
  archivos?: CreateMultimediaDto[];
}
