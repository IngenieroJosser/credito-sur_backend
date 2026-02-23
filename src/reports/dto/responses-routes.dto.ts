import { ApiProperty } from '@nestjs/swagger';

export class RoutePerformanceDetail {
  @ApiProperty()
  id: string;

  @ApiProperty()
  ruta: string;

  @ApiProperty()
  cobrador: string;

  @ApiProperty()
  cobradorId: string;

  @ApiProperty()
  meta: number;

  @ApiProperty()
  recaudado: number;

  @ApiProperty()
  eficiencia: number;

  @ApiProperty()
  nuevosPrestamos: number;

  @ApiProperty()
  nuevosClientes: number;

  @ApiProperty()
  montoNuevosPrestamos: number;
}

export class OperationalMetrics {
  @ApiProperty()
  totalRecaudo: number;

  @ApiProperty()
  totalMeta: number;

  @ApiProperty()
  porcentajeGlobal: number;

  @ApiProperty()
  totalPrestamosNuevos: number;

  @ApiProperty()
  totalAfiliaciones: number;

  @ApiProperty()
  efectividadPromedio: number;

  @ApiProperty()
  totalMontoPrestamosNuevos: number;
}

export class OperationalReportResponse extends OperationalMetrics {
  @ApiProperty({ type: [RoutePerformanceDetail] })
  rendimientoRutas: RoutePerformanceDetail[];

  @ApiProperty()
  periodo: string;

  @ApiProperty()
  fechaInicio: Date;

  @ApiProperty()
  fechaFin: Date;
}
