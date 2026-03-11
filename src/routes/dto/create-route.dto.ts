import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRouteDto {
  @ApiProperty({ description: 'Código único de la ruta', example: 'RT-CEN-01' })
  @IsString()
  @IsNotEmpty()
  codigo: string;

  @ApiProperty({
    description: 'Nombre de la ruta',
    example: 'Ruta Centro - Comercial',
  })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiProperty({
    description: 'Descripción de la ruta',
    example: 'Zona comercial del centro',
    required: false,
  })
  @IsString()
  @IsOptional()
  descripcion?: string;

  @ApiProperty({ description: 'Zona geográfica', example: 'Centro' })
  @IsString()
  @IsNotEmpty()
  zona: string;

  @ApiProperty({
    description: 'ID del cobrador asignado',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsNotEmpty()
  cobradorId: string;

  @ApiProperty({
    description: 'ID del supervisor',
    example: '550e8400-e29b-41d4-a716-446655440001',
    required: false,
  })
  @IsString()
  @IsOptional()
  supervisorId?: string;
}
