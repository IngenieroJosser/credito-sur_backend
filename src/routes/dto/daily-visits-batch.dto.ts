import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Las visitas del dia de VARIAS rutas en una sola peticion.
 *
 * El listado de rutas ya pedia esto: `rutas-service.ts` tiene
 * `obtenerVisitasDelDiaEnLote`, que hace `POST /routes/daily-visits/batch`. Ese
 * endpoint no existia. Medido contra el backend en marcha:
 *
 *     POST /routes/daily-visits/batch -> 404
 *     GET  /routes/:id/daily-visits   -> 401 (existe; lo frena el guard)
 *
 * Asi que `fetchDailySummaries` se caia en esa linea y las tarjetas del listado
 * mostraban las cifras del LISTADO (`ruta.metaDelDia`, `ruta.cobranzaDelDia`) en
 * vez de las operativas, mientras la pantalla de detalle mostraba las otras. La
 * misma ruta con dos metas segun donde se mirara.
 */
export class DailyVisitsBatchDto {
  @ApiProperty({
    description: 'IDs de las rutas a consultar',
    example: ['550e8400-e29b-41d4-a716-446655440000'],
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100, {
    message: 'No se pueden consultar mas de 100 rutas a la vez.',
  })
  @IsUUID('4', { each: true })
  rutaIds: string[];

  @ApiProperty({
    description: 'Fecha operativa en formato YYYY-MM-DD (hora de Bogota)',
    example: '2026-11-12',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha debe venir como YYYY-MM-DD.',
  })
  fecha?: string;
}
