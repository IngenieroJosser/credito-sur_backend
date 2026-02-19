import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  UseInterceptors,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
  Res,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '@prisma/client';
import { Response } from 'express';

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('comprobante'))
  async create(
    @Body() createPaymentDto: CreatePaymentDto,
    @Request() req,
    @UploadedFile() _file?: Express.Multer.File,
  ) {
    // Transformar campos que vienen como strings desde FormData
    const dto = {
      ...createPaymentDto,
      prestamoId: createPaymentDto.prestamoId?.toString(),
      clienteId: createPaymentDto.clienteId?.toString(),
      cobradorId: createPaymentDto.cobradorId?.toString() || req.user?.id,
      montoTotal: typeof createPaymentDto.montoTotal === 'string' 
        ? parseFloat(createPaymentDto.montoTotal) 
        : createPaymentDto.montoTotal,
    };

    // Si no viene cobradorId, usar el usuario del JWT
    if (!dto.cobradorId && req.user?.id) {
      dto.cobradorId = req.user.id;
    }

    return this.paymentsService.create(dto as CreatePaymentDto);
  }

  @Get()
  findAll(
    @Query('prestamoId') prestamoId?: string,
    @Query('clienteId') clienteId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.paymentsService.findAll({
      prestamoId,
      clienteId,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('export')
  @Roles(
    RolUsuario.COORDINADOR,
    RolUsuario.SUPERVISOR,
    RolUsuario.ADMIN,
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.CONTADOR,
  )
  @HttpCode(HttpStatus.OK)
  async exportPayments(
    @Query('format') format: 'excel' | 'pdf',
    @Query('startDate', new DefaultValuePipe('')) startDate: string,
    @Query('endDate', new DefaultValuePipe('')) endDate: string,
    @Query('rutaId', new DefaultValuePipe('')) rutaId: string,
    @Res() res: Response,
  ) {
    const result = await this.paymentsService.exportPayments(
      { startDate: startDate || undefined, endDate: endDate || undefined, rutaId: rutaId || undefined },
      format,
    );
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.data);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.paymentsService.findOne(id);
  }
}
