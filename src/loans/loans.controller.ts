import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { LoansService } from './loans.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '@prisma/client';

@Controller('loans')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Get()
  @Roles(RolUsuario.COORDINADOR, RolUsuario.SUPERVISOR, RolUsuario.COBRADOR, RolUsuario.CONTADOR)
  async getAllLoans(
    @Query('estado', new DefaultValuePipe('todos')) estado: string,
    @Query('ruta', new DefaultValuePipe('todas')) ruta: string,
    @Query('search', new DefaultValuePipe('')) search: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(8), ParseIntPipe) limit: number,
  ) {
    // Validar límite máximo
    const safeLimit = Math.min(limit, 100); // Máximo 100 por página
    
    return this.loansService.getAllLoans({
      estado,
      ruta,
      search,
      page,
      limit: safeLimit,
    });
  }

  @Get(':id')
  @Roles(RolUsuario.COORDINADOR, RolUsuario.SUPERVISOR, RolUsuario.COBRADOR, RolUsuario.CONTADOR)
  async getLoanById(@Param('id') id: string) {
    return this.loansService.getLoanById(id);
  }

  @Delete(':id')
  @Roles(RolUsuario.COORDINADOR)
  async deleteLoan(@Param('id') id: string, @Body() body: { userId: string }) {
    return this.loansService.deleteLoan(id, body.userId);
  }

  @Patch(':id/restore')
  @Roles(RolUsuario.COORDINADOR)
  async restoreLoan(@Param('id') id: string, @Body() body: { userId: string }) {
    return this.loansService.restoreLoan(id, body.userId);
  }

  @Post()
  @Roles(RolUsuario.COORDINADOR, RolUsuario.COBRADOR)
  async createLoan(@Body() createLoanDto: any) {
    return this.loansService.createLoan(createLoanDto);
  }

  @Post(':id/approve')
  @Roles(RolUsuario.COORDINADOR)
  async approveLoan(
    @Param('id') id: string,
    @Body() body: { aprobadoPorId: string },
  ) {
    return this.loansService.approveLoan(id, body.aprobadoPorId);
  }

  @Post(':id/reject')
  @Roles(RolUsuario.COORDINADOR)
  async rejectLoan(
    @Param('id') id: string,
    @Body() body: { rechazadoPorId: string; motivo?: string },
  ) {
    return this.loansService.rejectLoan(id, body.rechazadoPorId, body.motivo);
  }

  @Get(':id/cuotas')
  @Roles(RolUsuario.COORDINADOR, RolUsuario.SUPERVISOR, RolUsuario.COBRADOR, RolUsuario.CONTADOR)
  async getLoanCuotas(@Param('id') id: string) {
    return this.loansService.getLoanCuotas(id);
  }
}
