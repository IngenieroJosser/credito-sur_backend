import { ApiProperty } from '@nestjs/swagger';
import { NivelRiesgo, EstadoPrestamo } from '@prisma/client';
import { IsString, IsNumber, IsEnum, IsOptional, IsDateString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ClienteInfoDto {
  @ApiProperty()
  @IsString()
  nombre: string;

  @ApiProperty()
  @IsString()
  documento: string;

  @ApiProperty()
  @IsString()
  telefono: string;

  @ApiProperty()
  @IsString()
  direccion: string;
}

export class PrestamoMoraDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsString()
  numeroPrestamo: string;

  @ApiProperty()
  cliente: ClienteInfoDto;

  @ApiProperty()
  @IsNumber()
  diasMora: number;

  @ApiProperty()
  @IsNumber()
  montoMora: number;

  @ApiProperty()
  @IsNumber()
  montoTotalDeuda: number;

  @ApiProperty()
  @IsNumber()
  cuotasVencidas: number;

  @ApiProperty()
  @IsString()
  ruta: string;

  @ApiProperty()
  @IsString()
  cobrador: string;

  @ApiProperty({ enum: NivelRiesgo })
  @IsEnum(NivelRiesgo)
  nivelRiesgo: NivelRiesgo;

  @ApiProperty({ enum: EstadoPrestamo })
  @IsEnum(EstadoPrestamo)
  estado: EstadoPrestamo;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  ultimoPago?: string;
}

export class PrestamosMoraFiltrosDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  busqueda?: string;

  @ApiProperty({ required: false, enum: NivelRiesgo })
  @IsOptional()
  @IsEnum(NivelRiesgo)
  nivelRiesgo?: NivelRiesgo;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  rutaId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  cobradorId?: string;

  @ApiProperty({ required: false, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  pagina?: number = 1;

  @ApiProperty({ required: false, default: 50, minimum: 1, maximum: 1000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(1000)
  limite?: number = 50;
}

export class TotalesMoraDto {
  @ApiProperty()
  @IsNumber()
  totalMora: number;

  @ApiProperty()
  @IsNumber()
  totalDeuda: number;

  @ApiProperty()
  @IsNumber()
  totalCasosCriticos: number;

  @ApiProperty()
  @IsNumber()
  totalRegistros: number;
}