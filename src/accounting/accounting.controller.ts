import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  ParseUUIDPipe,
  UnauthorizedException,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { AccountingService } from './accounting.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TipoCaja, TipoTransaccion, TipoAprobacion } from '@prisma/client';

import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '@prisma/client';
import { Response } from 'express';

@Controller('accounting')
@UseGuards(JwtAuthGuard, RolesGuard)
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
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.CONTADOR,
    RolUsuario.COORDINADOR,
  )
  createCaja(
    @Request() req,
    @Body()
    body: {
      nombre: string;
      tipo: TipoCaja;
      rutaId?: string;
      responsableId: string;
      saldoInicial?: number;
    },
  ) {
    if (!req.user || !req.user.id) {
      throw new UnauthorizedException(
        'Usuario no autenticado o token inválido',
      );
    }
    return this.accountingService.createCaja(body, req.user.id);
  }

  @Post('cajas/ruta/:rutaId/asegurar')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.CONTADOR,
    RolUsuario.COORDINADOR,
  )
  asegurarCajaRuta(@Param('rutaId', ParseUUIDPipe) rutaId: string) {
    return this.accountingService.asegurarCajaRuta(rutaId);
  }

  @Patch('cajas/:id')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.CONTADOR,
    RolUsuario.COORDINADOR,
  )
  updateCaja(
    @Param('id') id: string,
    @Body()
    body: {
      nombre?: string;
      responsableId?: string;
      activa?: boolean;
      saldoActual?: number;
    },
  ) {
    return this.accountingService.updateCaja(id, body);
  }

  @Delete('cajas/:id')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
  )
  deleteCaja(@Param('id') id: string) {
    return this.accountingService.deleteCaja(id);
  }

  @Post('cajas/:id/consolidar')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.CONTADOR,
    RolUsuario.COORDINADOR,
  )
  consolidarCaja(
    @Param('id') id: string,
    @Request() req,
    @Body() body?: { monto?: number },
  ) {
    return this.accountingService.consolidarCaja(id, req.user.id, body?.monto);
  }

  @Get('cajas/:id/desglose-pagos')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.CONTADOR,
    RolUsuario.COORDINADOR,
  )
  getDesglosePagosCaja(
    @Param('id') id: string,
    @Query('fecha') fecha?: string,
  ) {
    return this.accountingService.getDesglosePagosCaja(id, fecha);
  }

  @Post('cajas/:id/arqueos')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.CONTADOR,
    RolUsuario.COORDINADOR,
  )
  registrarArqueo(
    @Param('id') id: string,
    @Request() req,
    @Body()
    body: {
      efectivoReal: number;
      saldoSistema: number;
      diferencia: number;
      observaciones?: string;
    },
  ) {
    if (!req.user || !req.user.id) {
      throw new UnauthorizedException('Usuario no autenticado');
    }
    return this.accountingService.registrarArqueo(id, body, req.user.id);
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
      limit: limit ? parseInt(limit) : 50,
    });
  }

  @Get('transacciones/:id')
  getTransaccionById(@Param('id', ParseUUIDPipe) id: string) {
    return this.accountingService.getTransaccionById(id);
  }

  @Post('transacciones')
  createTransaccion(
    @Request() req,
    @Body()
    body: {
      cajaId: string;
      tipo: TipoTransaccion;
      monto: number;
      descripcion: string;
      tipoReferencia?: string;
      referenciaId?: string;
      cajaOrigenId?: string;
    },
  ) {
    if (!req.user || !req.user.id) {
      throw new UnauthorizedException('Usuario no autenticado');
    }
    return this.accountingService.createTransaccion({
      ...body,
      creadoPorId: req.user.id,
    });
  }

  // =====================
  // RESUMEN FINANCIERO
  // =====================

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
  // CIERRES (HISTORIAL)
  // =====================

  @Get('cierres')
  getHistorialCierres(
    @Query('tipo') tipo?: 'ARQUEO' | 'CONSOLIDACION',
    @Query('cajaId') cajaId?: string,
    @Query('soloRutas') soloRutas?: string,
    @Query('estado') estado?: 'CUADRADA' | 'DESCUADRADA',
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
  ) {
    return this.accountingService.getHistorialCierres({
      tipo,
      cajaId,
      soloRutas: soloRutas === '1',
      estado,
      fechaInicio,
      fechaFin,
    });
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
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
  ) {
    return this.accountingService.getGastos({
      rutaId,
      estado,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
      fechaInicio,
      fechaFin,
    });
  }

  @Post('gastos')
  @Roles(
    RolUsuario.COBRADOR,
    RolUsuario.SUPERVISOR,
    RolUsuario.COORDINADOR,
    RolUsuario.SUPER_ADMINISTRADOR,
  )
  async registrarGasto(
    @Request() req,
    @Body()
    body: {
      descripcion: string;
      valor: number;
      rutaId: string;
      cobradorId: string;
      categoriaId?: string;
      esPersonal?: boolean;
    },
  ) {
    if (!req.user || !req.user.id) {
      throw new UnauthorizedException('Usuario no autenticado');
    }
    return this.accountingService.registrarGasto({
      descripcion: body.descripcion,
      monto: body.valor,
      rutaId: body.rutaId,
      cobradorId: body.cobradorId,
      solicitadoPorId: req.user.id,
      tipoAprobacion: TipoAprobacion.GASTO,
      categoriaId: body.categoriaId,
      esPersonal: body.esPersonal,
    });
  }

  @Post('base-requests')
  @Roles(
    RolUsuario.COBRADOR,
    RolUsuario.SUPERVISOR,
    RolUsuario.COORDINADOR,
    RolUsuario.SUPER_ADMINISTRADOR,
  )
  async solicitarBase(
    @Request() req,
    @Body()
    body: {
      descripcion: string;
      monto: number;
      rutaId: string;
      cobradorId: string;
    },
  ) {
    if (!req.user || !req.user.id) {
      throw new UnauthorizedException('Usuario no autenticado');
    }
    return this.accountingService.solicitarBase({
      descripcion: body.descripcion,
      monto: body.monto,
      rutaId: body.rutaId,
      cobradorId: body.cobradorId,
      solicitadoPorId: req.user.id,
    });
  }

  @Get('rutas/:rutaId/saldo-disponible')
  @Roles(
    RolUsuario.COBRADOR,
    RolUsuario.SUPERVISOR,
    RolUsuario.COORDINADOR,
    RolUsuario.SUPER_ADMINISTRADOR,
  )
  getSaldoDisponibleRuta(
    @Param('rutaId') rutaId: string,
    @Query('fecha') fecha?: string,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
  ) {
    return this.accountingService.getSaldoDisponibleRuta(
      rutaId,
      fecha,
      fechaInicio,
      fechaFin,
    );
  }

  @Get('rutas/:rutaId/cierre-hoy')
  @Roles(
    RolUsuario.COBRADOR,
    RolUsuario.SUPERVISOR,
    RolUsuario.COORDINADOR,
    RolUsuario.ADMIN,
    RolUsuario.SUPER_ADMINISTRADOR,
  )
  getRutaCerradaHoy(@Param('rutaId') rutaId: string) {
    return this.accountingService.getRutaCerradaHoy(rutaId);
  }

  @Get('export')
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.ADMIN, RolUsuario.CONTADOR)
  @HttpCode(HttpStatus.OK)
  async exportAccountingReport(
    @Query('format') format: 'excel' | 'pdf',
    @Res() res: Response,
  ) {
    const result = await this.accountingService.exportAccountingReport(format);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.data);
  }

  // =====================
  // DEUDAS DE COBRADORES
  // =====================
  @Get('deudas-cobradores')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
    RolUsuario.CONTADOR,
  )
  getDeudoresCobrador() {
    return this.accountingService.getDeudoresCobrador();
  }

  @Post('deudas-cobradores/:cobradorId/abono')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
  )
  registrarAbonoDeuda(
    @Param('cobradorId') cobradorId: string,
    @Body() body: { monto: number; nota: string; cajaIdDestino?: string },
    @Request() req,
  ) {
    if (!req.user || !req.user.id) throw new UnauthorizedException('Usuario no autenticado');
    // Ensure monto is parsing correctly
    const montoClean = typeof body.monto === 'number' ? body.monto : Number(body.monto) || 0;
    
    return this.accountingService.registrarAbonoDeuda(
      cobradorId,
      body.monto,
      body.nota,
      req.user.id,
      body.cajaIdDestino,
    );
  }

  @Post('reparaciones/caja-oficina-ingresos')
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.ADMIN)
  @HttpCode(HttpStatus.OK)
  repararCajaOficinaIngresosMalAsignados(
    @Query('dryRun') dryRun?: string,
  ) {
    return this.accountingService.repararCajaOficinaIngresosMalAsignados({
      dryRun: dryRun === '1' || String(dryRun || '').toLowerCase() === 'true',
    });
  }
}
