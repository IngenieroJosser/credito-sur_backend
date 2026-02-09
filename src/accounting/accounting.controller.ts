import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AccountingService } from './accounting.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TipoCaja, TipoTransaccion } from '@prisma/client';

@Controller('accounting')
@UseGuards(JwtAuthGuard)
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  // =====================
  // CAJAS
  // =====================

  @Get('cajas')
  getCajas() {
    return this.accountingService.getCajas();
  }

  @Get('cajas/:id')
  getCajaById(@Param('id') id: string) {
    return this.accountingService.getCajaById(id);
  }

  @Post('cajas')
  createCaja(
    @Body() body: {
      nombre: string;
      tipo: TipoCaja;
      rutaId?: string;
      responsableId: string;
      saldoInicial?: number;
    }
  ) {
    return this.accountingService.createCaja(body);
  }

  @Patch('cajas/:id')
  updateCaja(
    @Param('id') id: string,
    @Body() body: {
      nombre?: string;
      responsableId?: string;
      activa?: boolean;
      saldoActual?: number;
    }
  ) {
    return this.accountingService.updateCaja(id, body);
  }

  // =====================
  // TRANSACCIONES / MOVIMIENTOS
  // =====================

  @Get('transacciones')
  getTransacciones(
    @Query('cajaId') cajaId?: string,
    @Query('tipo') tipo?: TipoTransaccion,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.accountingService.getTransacciones({
      cajaId,
      tipo,
      fechaInicio,
      fechaFin,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50
    });
  }

  @Post('transacciones')
  createTransaccion(
    @Request() req,
    @Body() body: {
      cajaId: string;
      tipo: TipoTransaccion;
      monto: number;
      descripcion: string;
      tipoReferencia?: string;
      referenciaId?: string;
    }
  ) {
    return this.accountingService.createTransaccion({
      ...body,
      creadoPorId: req.user.userId
    });
  }

  // =====================
  // RESUMEN FINANCIERO
  // =====================

  @Get('resumen')
  getResumenFinanciero(
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
  ) {
    return this.accountingService.getResumenFinanciero(fechaInicio, fechaFin);
  }

  // =====================
  // GASTOS
  // =====================

  @Get('gastos')
  getGastos(
    @Query('rutaId') rutaId?: string,
    @Query('estado') estado?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.accountingService.getGastos({
      rutaId,
      estado,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50
    });
  }
}
