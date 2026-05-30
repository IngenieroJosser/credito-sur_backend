import {
  IsDateString,
  IsIn,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ReprogramarCuotaDto {
  @ApiProperty({
    description: 'ID de la cuota a reprogramar',
    example: 'cuota-uuid',
    required: false,
  })
  @IsString()
  @IsOptional()
  cuotaId?: string;

  @ApiProperty({
    description: 'Motivo de la reprogramación',
    example: 'Cliente solicitó prórroga por dificultades económicas',
  })
  @IsString()
  @IsNotEmpty()
  motivo: string;

  @ApiProperty({
    description: 'Nueva fecha de vencimiento',
    example: '2026-03-15',
  })
  @IsDateString()
  @IsNotEmpty()
  nuevaFecha: string;

  @ApiProperty({
    description: 'Fecha operativa de la ruta asociada a la regularización',
    example: '2026-05-18',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  fechaOperativaRuta?: string;

  @ApiProperty({
    description: 'Origen de la gestión operativa',
    example: 'CIERRE_PENDIENTE',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Transform(({ value }) => value?.toString().toUpperCase())
  @IsIn(['CIERRE_PENDIENTE'])
  origenGestion?: 'CIERRE_PENDIENTE';

  @ApiProperty({
    description: 'Clave idempotente para deduplicar la solicitud',
    example:
      'REPROGRAMACION_CIERRE_PENDIENTE:ruta-1:2026-05-18:cliente-1:prestamo-1:cuota-1:2026-05-20',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Transform(({ value }) => value?.toString().trim())
  idempotencyKey?: string;

  @ApiProperty({
    description: 'Monto parcial a pagar (opcional)',
    example: 200000,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  montoParcial?: number;

  @ApiProperty({
    description: 'ID del usuario que realiza la reprogramación',
    example: 'user-uuid',
    required: false,
  })
  @IsString()
  @IsOptional()
  reprogramadoPorId?: string;
}
