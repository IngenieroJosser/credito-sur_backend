import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpStatus,
  DefaultValuePipe,
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '@prisma/client';
import { PrestamosMoraFiltrosDto } from './dto/prestamo-mora.dto';
import {
  ExportRequestDto,
  PrestamosMoraResponseDto,
} from './dto/responses.dto';
import {
  CuentasVencidasFiltrosDto,
  DecisionCastigoDto,
} from './dto/cuentas-vencidas.dto';
import { CuentasVencidasResponseDto } from './dto/responses-cuentas-vencidas.dto';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('financial/summary')
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.ADMIN, RolUsuario.CONTADOR)
  getFinancialSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate
      ? new Date(startDate)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate ? new Date(endDate) : new Date();
    return this.reportsService.getFinancialSummary(start, end);
  }

  @Get('financial/monthly')
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.ADMIN, RolUsuario.CONTADOR)
  getMonthlyEvolution(@Query('year') year?: string) {
    const y = year ? parseInt(year) : new Date().getFullYear();
    return this.reportsService.getMonthlyEvolution(y);
  }

  @Get('financial/expenses')
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.ADMIN, RolUsuario.CONTADOR)
  getExpenseDistribution(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate
      ? new Date(startDate)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate ? new Date(endDate) : new Date();
    return this.reportsService.getExpenseDistribution(start, end);
  }

  @Get('prestamos-mora')
  @Roles(
    RolUsuario.COORDINADOR,
    RolUsuario.SUPERVISOR,
    RolUsuario.SUPER_ADMINISTRADOR,
  )
  @ApiOperation({ summary: 'Obtener préstamos en mora' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista de préstamos en mora',
    type: PrestamosMoraResponseDto,
  })
  @ApiQuery({ name: 'pagina', required: false, type: Number })
  @ApiQuery({ name: 'limite', required: false, type: Number })
  async obtenerPrestamosMora(
    @Query() filtros: PrestamosMoraFiltrosDto,
    @Query('pagina', new DefaultValuePipe(1), ParseIntPipe) pagina: number,
    @Query('limite', new DefaultValuePipe(50), ParseIntPipe) limite: number,
  ) {
    return this.reportsService.obtenerPrestamosEnMora(filtros, pagina, limite);
  }

  @Post('exportar-mora')
  @Roles(
    RolUsuario.COORDINADOR,
    RolUsuario.SUPERVISOR,
    RolUsuario.SUPER_ADMINISTRADOR,
  )
  @ApiOperation({ summary: 'Exportar reporte de mora' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Reporte exportado exitosamente',
  })
  async exportarReporteMora(@Body() exportRequest: ExportRequestDto) {
    return this.reportsService.generarReporteMora(
      exportRequest.filtros,
      exportRequest.formato,
    );
  }

  @Get('estadisticas-mora')
  @Roles(
    RolUsuario.COORDINADOR,
    RolUsuario.SUPERVISOR,
    RolUsuario.SUPER_ADMINISTRADOR,
  )
  @ApiOperation({ summary: 'Obtener estadísticas de mora' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Estadísticas de préstamos en mora',
  })
  async obtenerEstadisticasMora() {
    return this.reportsService.obtenerEstadisticasMora();
  }

  @Get('cuentas-vencidas')
  @Roles(
    RolUsuario.COORDINADOR,
    RolUsuario.SUPERVISOR,
    RolUsuario.SUPER_ADMINISTRADOR,
  )
  @ApiOperation({ summary: 'Obtener cuentas vencidas' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista de cuentas vencidas',
    type: CuentasVencidasResponseDto,
  })
  async obtenerCuentasVencidas(@Query() filtros: CuentasVencidasFiltrosDto) {
    const pagina = filtros.pagina || 1;
    const limite = filtros.limite || 50;

    return this.reportsService.obtenerCuentasVencidas(filtros, pagina, limite);
  }

  @Post('cuentas-vencidas/decision')
  @Roles(RolUsuario.COORDINADOR, RolUsuario.SUPER_ADMINISTRADOR)
  @ApiOperation({ summary: 'Procesar decisión sobre cuenta vencida' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Decisión procesada exitosamente',
  })
  async procesarDecisionCastigo(
    @Body() decisionDto: DecisionCastigoDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.reportsService.procesarDecisionCastigo(
      decisionDto,
      req.user.id,
    );
  }

  @Post('cuentas-vencidas/exportar')
  @Roles(
    RolUsuario.COORDINADOR,
    RolUsuario.SUPERVISOR,
    RolUsuario.SUPER_ADMINISTRADOR,
  )
  @ApiOperation({ summary: 'Exportar reporte de cuentas vencidas' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Reporte exportado exitosamente',
  })
  async exportarCuentasVencidas(@Body() exportRequest: ExportRequestDto) {
    return this.reportsService.exportarCuentasVencidas(
      exportRequest.formato,
      exportRequest.filtros as CuentasVencidasFiltrosDto,
    );
  }
}
