import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';

export enum ReportPeriod {
  TODAY = 'today',
  WEEK = 'week',
  MONTH = 'month',
  QUARTER = 'quarter',
  CUSTOM = 'custom',
}

export class GetOperationalReportDto {
  @ApiProperty({
    enum: ReportPeriod,
    default: ReportPeriod.MONTH,
    description: 'Período del reporte',
  })
  @IsEnum(ReportPeriod)
  @Transform(({ value }) => value || ReportPeriod.MONTH)
  period: ReportPeriod = ReportPeriod.MONTH;

  @ApiPropertyOptional({
    description: 'ID de la ruta específica (opcional)',
  })
  @IsOptional()
  @IsString()
  routeId?: string;

  @ApiPropertyOptional({
    description: 'Fecha de inicio para período personalizado (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Fecha de fin para período personalizado (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}