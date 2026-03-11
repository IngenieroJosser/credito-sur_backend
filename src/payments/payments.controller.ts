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
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiConsumes, ApiTags } from '@nestjs/swagger';
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
  @ApiOperation({
    summary: 'Registrar un pago',
    description:
      'Si metodoPago=TRANSFERENCIA, se debe adjuntar el campo "comprobante" (imagen o PDF) obligatoriamente.',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('comprobante', {
      storage: require('multer').memoryStorage(),
      fileFilter: (_req: any, file: Express.Multer.File, cb: any) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif|pdf)$/i)) {
          return cb(
            new BadRequestException('El comprobante debe ser una imagen (JPG, PNG) o PDF'),
            false,
          );
        }
        cb(null, true);
      },
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB máx para comprobantes
    }),
  )
  async create(
    @Body() createPaymentDto: CreatePaymentDto,
    @Request() req: any,
    @UploadedFile() comprobante?: Express.Multer.File,
  ) {
    const dto = {
      ...createPaymentDto,
      prestamoId: createPaymentDto.prestamoId?.toString(),
      clienteId:  createPaymentDto.clienteId?.toString(),
      cobradorId: createPaymentDto.cobradorId?.toString() || req.user?.id,
      montoTotal: typeof createPaymentDto.montoTotal === 'string'
        ? parseFloat(createPaymentDto.montoTotal)
        : createPaymentDto.montoTotal,
    };

    if (!dto.cobradorId && req.user?.id) {
      dto.cobradorId = req.user.id;
    }

    return this.paymentsService.create(dto as CreatePaymentDto, comprobante);
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
