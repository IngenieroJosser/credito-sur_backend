import { ApiProperty } from '@nestjs/swagger';
import { NivelRiesgo, EstadoPrestamo } from '@prisma/client';
import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CuentaVencidaDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsString()
  numeroPrestamo: string;

  @ApiProperty()
  cliente: {
    nombre: string;
    documento: string;
    telefono?: string;
    direccion?: string;
  };

  @ApiProperty()
  @IsString()
  fechaVencimiento: string;

  @ApiProperty()
  @IsNumber()
  diasVencidos: number;

  @ApiProperty()
  @IsNumber()
  saldoPendiente: number;

  @ApiProperty()
  @IsNumber()
  montoOriginal: number;

  @ApiProperty()
  @IsString()
  ruta: string;

  @ApiProperty({ enum: NivelRiesgo })
  @IsEnum(NivelRiesgo)
  nivelRiesgo: NivelRiesgo;

  @ApiProperty({ enum: EstadoPrestamo })
  @IsEnum(EstadoPrestamo)
  estado: EstadoPrestamo;
}

export class CuentasVencidasFiltrosDto {
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

export class TotalesVencidasDto {
  @ApiProperty()
  @IsNumber()
  totalVencido: number;

  @ApiProperty()
  @IsNumber()
  totalRegistros: number;

  @ApiProperty()
  @IsNumber()
  diasPromedioVencimiento: number;
}

export class DecisionCastigoDto {
  @ApiProperty()
  @IsString()
  prestamoId: string;

  @ApiProperty()
  @IsString()
  decision: 'CASTIGAR' | 'PRORROGAR' | 'JURIDICO';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  montoInteres?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  comentarios?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  nuevaFechaVencimiento?: string;
}
