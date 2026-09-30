import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

/**
 * El cuerpo de `POST /loans/simular`.
 *
 * Ese endpoint es el ORIGEN UNICO de la matematica de credito: la pantalla de edicion lo
 * llama en vez de recalcular la formula en el frontend, que fue justo la fuente de
 * divergencias en pesos que ya se corrigio. Recibia `@Body() body: any`, o sea que el
 * ValidationPipe global no tenia contra que validar y cualquier cosa llegaba al calculo.
 *
 * Los campos son los nueve que el controlador lee, uno por uno.
 *
 * ── Por que este DTO es PERMISIVO a proposito ──────────────────────────
 *
 * Valida TIPOS y forma, no rangos ni enums, y eso es una decision medida:
 *
 *  - Los rangos ya los guarda el servicio: `simularCredito` empieza con
 *    `if (!(monto > 0) || !(cantidadCuotas > 0)) return` ceros. Exigir `Min(1)` aqui
 *    cambiaria esa respuesta por un 400 para el mismo dato.
 *  - Los enums los normaliza el servicio desde texto (`tipoAmortizacion`,
 *    `frecuenciaPago`, `tipoPrestamo` entran como `string` y se normalizan mas abajo).
 *    Un `@IsEnum` rechazaria valores que hoy el servicio sabe interpretar.
 *
 * Lo que SI cierra: un `monto` con texto, que antes pasaba por `Number(body?.monto) || 0`
 * y se convertia en 0 en silencio. Ahora es un 400 con mensaje.
 *
 * Se comprobo el unico llamador (`EditarPrestamoModal`) antes de escribir esto: manda los
 * nueve campos y ya se guarda solo con `if (!(monto > 0) || !(cuotas > 0)) return`, asi que
 * ninguno de sus casos cambia.
 */
export class SimularCreditoDto {
  @ApiProperty({ required: false, description: 'Un valor de TipoAmortizacion' })
  @IsString()
  @IsOptional()
  tipoAmortizacion?: string;

  @ApiProperty({ description: 'Monto a financiar' })
  @IsNumber()
  @Min(0)
  monto: number;

  @ApiProperty({ description: 'Tasa de interés MENSUAL, en porcentaje' })
  @IsNumber()
  @Min(0)
  tasaInteres: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  cantidadCuotas: number;

  @ApiProperty({
    description: 'Puede ser fraccionario: 45 cuotas diarias son 1,5 meses',
  })
  @IsNumber()
  @Min(0)
  plazoMeses: number;

  @ApiProperty({ required: false, description: 'Un valor de FrecuenciaPago' })
  @IsString()
  @IsOptional()
  frecuenciaPago?: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  fechaInicio?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  tipoPrestamo?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  cuotaInicial?: number;
}
