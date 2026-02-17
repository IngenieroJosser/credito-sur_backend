import { IsString, IsNotEmpty, IsOptional, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReprogramarCuotaDto {
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
  @IsString()
  @IsNotEmpty()
  nuevaFecha: string;

  @ApiProperty({
    description: 'Monto parcial a pagar (opcional)',
    example: 200000,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  montoParcial?: number;

  @ApiProperty({
    description: 'ID del usuario que realiza la reprogramación',
    example: 'user-uuid',
  })
  @IsString()
  @IsNotEmpty()
  reprogramadoPorId: string;
}
