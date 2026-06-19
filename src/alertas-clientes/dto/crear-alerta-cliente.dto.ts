import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CrearAlertaClienteDto {
  @IsUUID()
  clienteId: string;

  @IsUUID()
  @IsOptional()
  rutaId?: string;

  @IsString()
  @IsNotEmpty()
  motivo: string;

  @IsString()
  @IsNotEmpty()
  descripcion: string;

  @IsString()
  @IsNotEmpty()
  observacionesReportante: string;

  @IsString()
  @IsOptional()
  ultimaUbicacionConocida?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  evidenciaIds?: string[];
}
