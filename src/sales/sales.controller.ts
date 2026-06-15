import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { RolUsuario } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateCashSaleDto } from './dto/create-cash-sale.dto';
import { SalesService } from './sales.service';

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
  registrarVentaContado(@Body() dto: CreateCashSaleDto, @Request() req: any) {
    return this.salesService.registrarVentaContado({
      ...dto,
      creadoPorId: dto.creadoPorId || req?.user?.id,
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
  listarVentasContado() {
    return this.salesService.listarVentasContado();
  }
}
