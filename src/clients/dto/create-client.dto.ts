import { IsString, IsOptional, IsEmail, IsEnum, IsBoolean, IsNumber, Min, Max } from 'class-validator';
import { NivelRiesgo } from '@prisma/client';

export class CreateClientDto {
  @IsString()
  dni: string;

  @IsString()
  nombres: string;

  @IsString()
  apellidos: string;

  @IsString()
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

  @IsOptional()
  archivos?: {
    tipoContenido: 'FOTO_PERFIL' | 'DOCUMENTO_IDENTIDAD_FRENTE' | 'DOCUMENTO_IDENTIDAD_REVERSO' | 'COMPROBANTE_DOMICILIO';
    tipoArchivo: string;
    nombreOriginal: string;
    nombreAlmacenamiento: string;
    ruta: string;
    tamanoBytes: number;
  }[];
}
