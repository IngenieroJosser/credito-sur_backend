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
  BadRequestException,
} from '@nestjs/common';
import { AccountingService } from './accounting.service';
import { LedgerService } from './ledger.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TipoCaja, TipoTransaccion, TipoAprobacion } from '@prisma/client';

import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '@prisma/client';
import { Response } from 'express';

@Controller('accounting')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AccountingController {
  constructor(
    private readonly accountingService: AccountingService,
    private readonly ledgerService: LedgerService,
  ) {}

  /**
   * Radiografia del estado contable, para mirarla cuando uno quiera.
   *
   * Estas comprobaciones solo corrian en el cron de las 2 de la manana, y solo
   * avisaban si algo estaba roto. Para probar algo en produccion hace falta lo
   * contrario: mirar el estado antes de tocar nada, hacer la operacion, y
   * volver a mirar. Solo lee.
   */
  @Get('integridad')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.CONTADOR,
  )
  revisarIntegridad() {
    return this.ledgerService.revisarIntegridad();
  }

  // =====================
  // CAJAS
  // =====================

  @Get('cajas')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
    RolUsuario.SUPERVISOR,
    RolUsuario.CONTADOR,
    RolUsuario.COBRADOR,
  )
  getCajas(@Request() req: any) {
    // Se pasa el actor: un cobrador solo debe ver las cajas de sus rutas, no
    // toda la posicion de caja de la empresa. Antes no habia ni @Roles ni
    // scope y cualquier autenticado veia todas las cajas.
    return this.accountingService.getCajas(req.user);
  }

  @Get('cajas/:id')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
    RolUsuario.SUPERVISOR,
    RolUsuario.CONTADOR,
    RolUsuario.COBRADOR,
  )
  getCajaById(@Param('id') id: string, @Request() req: any) {
    return this.accountingService.getCajaById(id, req.user);
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

  @Post('cajas/supervisor/:supervisorId/asegurar')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.CONTADOR,
    RolUsuario.COORDINADOR,
  )
  asegurarCajaSupervisor(
    @Param('supervisorId', ParseUUIDPipe) supervisorId: string,
  ) {
    return this.accountingService.asegurarCajaSupervisor(supervisorId);
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
    },
  ) {
    return this.accountingService.updateCaja(id, body);
  }

  @Delete('cajas/:id')
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.ADMIN)
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
    @Body() body?: { monto?: number; idempotencyKey?: string },
  ) {
    return this.accountingService.consolidarCaja(
      id,
      req.user.id,
      body?.monto,
      body?.idempotencyKey,
    );
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

  @Get('ledger/movimientos')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
    RolUsuario.CONTADOR,
  )
  getMovimientosLedger(
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
    @Query('tipo') tipo?: string,
    @Query('cajaId') cajaId?: string,
    @Query('accountCode') accountCode?: string,
    @Query('accountPrefix') accountPrefix?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.accountingService.getMovimientosLedger({
      fechaInicio,
      fechaFin,
      tipo,
      cajaId,
      accountCode,
      accountPrefix,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
    });
  }

  @Get('transacciones')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
    RolUsuario.CONTADOR,
  )
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
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
    RolUsuario.CONTADOR,
  )
  getTransaccionById(@Param('id', ParseUUIDPipe) id: string) {
    return this.accountingService.getTransaccionById(id);
  }

  @Post('transacciones')
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.ADMIN)
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
      accountCode?: string; // Código de cuenta de contrapartida (opcional)
      idempotencyKey?: string;
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
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
    RolUsuario.CONTADOR,
  )
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
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
    RolUsuario.CONTADOR,
    RolUsuario.SUPERVISOR,
  )
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
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
    RolUsuario.CONTADOR,
    RolUsuario.SUPERVISOR,
  )
  getGastos(
    @Query('rutaId') rutaId?: string,
    @Query('estado') estado?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
    @Query('esProvisional') esProvisional?: string,
  ) {
    return this.accountingService.getGastos({
      rutaId,
      estado,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
      fechaInicio,
      fechaFin,
      esProvisional: esProvisional ? esProvisional === 'true' : undefined,
    });
  }

  @Get('gastos/export')
  @Roles(
    RolUsuario.COORDINADOR,
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.CONTADOR,
  )
  async exportGastos(
    @Query('format') format: 'excel' | 'pdf',
    @Res() res: Response,
    @Query('rutaId') rutaId?: string,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
  ) {
    const result = await this.accountingService.exportGastos(format, {
      rutaId,
      fechaInicio,
      fechaFin,
    });
    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    res.send(result.data);
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
      comprobanteUrl?: string;
      fotoRecibo?: string;
      idempotencyKey?: string;
    },
  ) {
    if (!req.user || !req.user.id) {
      throw new UnauthorizedException('Usuario no autenticado');
    }

    // Sin esto, un cuerpo incompleto llegaba tal cual a Prisma y el usuario
    // recibia un 400 con la traza interna y las rutas de los ficheros.
    const faltan = (
      [
        ['descripcion', body?.descripcion],
        ['valor', body?.valor],
        ['rutaId', body?.rutaId],
        ['cobradorId', body?.cobradorId],
      ] as Array<[string, unknown]>
    )
      .filter(([, valor]) => valor === undefined || valor === null || valor === '')
      .map(([campo]) => campo);

    if (faltan.length > 0) {
      throw new BadRequestException(
        `Faltan datos del gasto: ${faltan.join(', ')}.`,
      );
    }

    const valor = Number(body.valor);
    if (!Number.isFinite(valor) || valor <= 0) {
      throw new BadRequestException(
        `El valor del gasto debe ser un numero mayor que cero (llego: ${body.valor}).`,
      );
    }

    return this.accountingService.registrarGasto({
      descripcion: body.descripcion,
      monto: valor,
      rutaId: body.rutaId,
      cobradorId: body.cobradorId,
      solicitadoPorId: req.user.id,
      tipoAprobacion: TipoAprobacion.GASTO,
      categoriaId: body.categoriaId,
      esPersonal: body.esPersonal,
      comprobanteUrl: body.comprobanteUrl,
      fotoRecibo: body.fotoRecibo,
      idempotencyKey: body.idempotencyKey,
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

  @Get('supervisores/:supervisorId/saldo-disponible')
  @Roles(
    RolUsuario.SUPERVISOR,
    RolUsuario.COORDINADOR,
    RolUsuario.ADMIN,
    RolUsuario.SUPER_ADMINISTRADOR,
  )
  getSaldoDisponibleSupervisor(
    @Param('supervisorId') supervisorId: string,
    @Query('fecha') fecha?: string,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
  ) {
    return this.accountingService.getSaldoDisponibleSupervisor(
      supervisorId,
      fecha,
      fechaInicio,
      fechaFin,
    );
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
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
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
    if (!req.user || !req.user.id)
      throw new UnauthorizedException('Usuario no autenticado');
    // Ensure monto is parsing correctly
    const montoClean =
      typeof body.monto === 'number' ? body.monto : Number(body.monto) || 0;

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
  repararCajaOficinaIngresosMalAsignados(@Query('dryRun') dryRun?: string) {
    return this.accountingService.repararCajaOficinaIngresosMalAsignados({
      dryRun: dryRun === '1' || String(dryRun || '').toLowerCase() === 'true',
    });
  }

  @Post('migration-ledger/dry-run')
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.ADMIN)
  @HttpCode(HttpStatus.OK)
  migracionLedgerDryRun(@Request() req) {
    if (!req.user || !req.user.id) throw new UnauthorizedException();
    return this.accountingService.migrarHistoricoLedger({
      dryRun: true,
      userId: req.user.id,
    });
  }

  @Post('migration-ledger/apply')
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.ADMIN)
  @HttpCode(HttpStatus.OK)
  migracionLedgerApply(@Request() req) {
    if (!req.user || !req.user.id) throw new UnauthorizedException();
    return this.accountingService.migrarHistoricoLedger({
      dryRun: false,
      userId: req.user.id,
    });
  }

  /**
   * Pone la cuenta de inventario al día con la bodega. Sin `aplicar` solo
   * calcula la cifra, para poder mirarla antes de escribir el asiento.
   */
  @Post('regularizar-inventario')
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.ADMIN)
  regularizarInventario(@Request() req, @Body() body: { aplicar?: boolean }) {
    if (!req.user || !req.user.id) throw new UnauthorizedException();
    return this.accountingService.regularizarInventario(
      req.user.id,
      body?.aplicar !== true,
    );
  }

  /**
   * Quita los centavos ya guardados en cuotas y asientos. Sin `aplicar` solo
   * informa de lo que cambiaría.
   */
  @Post('regularizar-centavos')
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.ADMIN)
  regularizarCentavos(@Request() req, @Body() body: { aplicar?: boolean }) {
    if (!req.user || !req.user.id) throw new UnauthorizedException();
    return this.accountingService.regularizarCentavos(
      req.user.id,
      body?.aplicar !== true,
    );
  }

  /**
   * Pone el saldo de cada caja de acuerdo con el libro. Sin `aplicar` solo
   * informa de las diferencias.
   */
  @Post('reparar-saldos-caja')
  @Roles(RolUsuario.SUPER_ADMINISTRADOR)
  repararSaldosCaja(@Request() req, @Body() body: { aplicar?: boolean }) {
    if (!req.user || !req.user.id) throw new UnauthorizedException();
    return this.accountingService.repararSaldosCaja(
      req.user.id,
      body?.aplicar !== true,
    );
  }

  @Post('apertura-day-zero')
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.ADMIN)
  ejecutarAperturaContable(@Request() req) {
    if (!req.user || !req.user.id) throw new UnauthorizedException();
    return this.accountingService.ejecutarAperturaContable(req.user.id);
  }
}
