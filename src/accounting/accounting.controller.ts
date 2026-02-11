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
  UnauthorizedException,
} from '@nestjs/common';
import { AccountingService } from './accounting.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TipoCaja, TipoTransaccion } from '@prisma/client';

import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '@prisma/client';

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

  @Post('cajas/:id/consolidar')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.CONTADOR,
    RolUsuario.COORDINADOR,
  )
  consolidarCaja(@Param('id') id: string, @Request() req) {
    return this.accountingService.consolidarCaja(id, req.user.id);
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
  ) {
    return this.accountingService.getGastos({
      rutaId,
      estado,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
    });
  }
}
