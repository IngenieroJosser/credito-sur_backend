import { ApiProperty } from '@nestjs/swagger';
import { CuentaVencidaDto, TotalesVencidasDto } from './cuentas-vencidas.dto';

export class CuentasVencidasResponseDto {
  @ApiProperty({ type: [CuentaVencidaDto] })
  cuentas: CuentaVencidaDto[];

  @ApiProperty()
  totales: TotalesVencidasDto;

  @ApiProperty()
  total: number;

  @ApiProperty()
  pagina: number;

  @ApiProperty()
  limite: number;
}