import { ApiProperty } from '@nestjs/swagger';
import {
  PrestamoMoraDto,
  PrestamosMoraFiltrosDto,
  TotalesMoraDto,
} from './prestamo-mora.dto';
import { IsString } from 'class-validator';

export class PrestamosMoraResponseDto {
  @ApiProperty({ type: [PrestamoMoraDto] })
  prestamos: PrestamoMoraDto[];

  @ApiProperty()
  totales: TotalesMoraDto;

  @ApiProperty()
  total: number;

  @ApiProperty()
  pagina: number;

  @ApiProperty()
  limite: number;
}

export class ExportRequestDto {
  @ApiProperty()
  @IsString()
  formato: 'excel' | 'pdf';

  @ApiProperty({ type: PrestamosMoraFiltrosDto })
  filtros: PrestamosMoraFiltrosDto;
}
