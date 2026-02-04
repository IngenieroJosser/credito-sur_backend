import { ApiProperty } from '@nestjs/swagger';

export class Route {
  @ApiProperty({ description: 'ID de la ruta', example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ description: 'Código único de la ruta', example: 'RT-CEN-01' })
  codigo: string;

  @ApiProperty({ description: 'Nombre de la ruta', example: 'Ruta Centro - Comercial' })
  nombre: string;

  @ApiProperty({ description: 'Descripción de la ruta', example: 'Zona comercial del centro', required: false })
  descripcion?: string;

  @ApiProperty({ description: 'Zona geográfica', example: 'Centro' })
  zona: string;

  @ApiProperty({ description: 'Estado activo/inactivo', example: true })
  activa: boolean;

  @ApiProperty({ description: 'ID del cobrador asignado', example: '550e8400-e29b-41d4-a716-446655440000' })
  cobradorId: string;

  @ApiProperty({ description: 'ID del supervisor', example: '550e8400-e29b-41d4-a716-446655440001', required: false })
  supervisorId?: string;

  @ApiProperty({ description: 'Fecha de creación', example: '2024-01-01T00:00:00.000Z' })
  creadoEn: Date;

  @ApiProperty({ description: 'Fecha de actualización', example: '2024-01-01T00:00:00.000Z' })
  actualizadoEn: Date;

  @ApiProperty({ description: 'Fecha de eliminación', example: null, required: false })
  eliminadoEn?: Date;
}