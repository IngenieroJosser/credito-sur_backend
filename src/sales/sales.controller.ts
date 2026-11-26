import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';
import { RolUsuario } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateCashSaleDto } from './dto/create-cash-sale.dto';
import { SalesService } from './sales.service';

import { RequestConUsuario } from '../common/types';

@Controller('sales')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post('cash')
  @HttpCode(HttpStatus.CREATED)
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
    RolUsuario.SUPERVISOR,
    RolUsuario.CONTADOR,
    RolUsuario.PUNTO_DE_VENTA,
  )
  registrarVentaContado(
    @Body() dto: CreateCashSaleDto,
    @Request() req: RequestConUsuario,
  ) {
    if (!req?.user?.id) {
      throw new BadRequestException('Usuario autenticado requerido');
    }
    return this.salesService.registrarVentaContado({
      ...dto,
      creadoPorId: req.user.id,
    });
  }

  @Get('cash')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
    RolUsuario.SUPERVISOR,
    RolUsuario.CONTADOR,
    RolUsuario.PUNTO_DE_VENTA,
  )
  listarVentasContado(
    @Request() req: RequestConUsuario,
    @Query('page') pagina?: string,
    @Query('limit') limite?: string,
    @Query('vendedorId') vendedorId?: string,
    @Query('soloPuntoVenta') soloPuntoVenta?: string,
  ) {
    return this.salesService.listarVentasContado({
      actor: req.user,
      pagina: pagina === undefined ? undefined : Number(pagina),
      limite: limite === undefined ? undefined : Number(limite),
      vendedorId: typeof vendedorId === 'string' ? vendedorId.trim() || undefined : undefined,
      soloPuntoVenta: soloPuntoVenta === 'true',
    });
  }
}
