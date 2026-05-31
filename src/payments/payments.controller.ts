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
  Logger,
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
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar un pago',
    description:
      'Si metodoPago=TRANSFERENCIA, se debe adjuntar el campo "comprobante" (imagen) obligatoriamente.',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('comprobante', {
      storage: require('multer').memoryStorage(),
      fileFilter: (_req: any, file: Express.Multer.File, cb: any) => {
        // Soporte para más formatos de imagen comunes en móviles (webp, heic, heif)
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp|heic|heif)$/i)) {
          return cb(
            new BadRequestException(
              'El comprobante debe ser una imagen (JPG, PNG, WEBP, HEIC)',
            ),
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
      clienteId: createPaymentDto.clienteId?.toString(),
      cobradorId:
        createPaymentDto.cobradorId?.toString() ||
        (req.user?.rol === RolUsuario.COBRADOR ? req.user?.id : undefined),
      montoTotal: Number(createPaymentDto.montoTotal),
      idempotencyKey: createPaymentDto.idempotencyKey?.toString().trim(),
      tipoRegistro: createPaymentDto.tipoRegistro
        ?.toString()
        .toUpperCase() as any,
      cuotaNumeroEsperada:
        createPaymentDto.cuotaNumeroEsperada != null
          ? Number(createPaymentDto.cuotaNumeroEsperada)
          : undefined,
      montoCuotaEsperado:
        createPaymentDto.montoCuotaEsperado != null
          ? Number(createPaymentDto.montoCuotaEsperado)
          : undefined,
    };

    if (
      !dto.cobradorId &&
      req.user?.rol === RolUsuario.COBRADOR &&
      req.user?.id
    ) {
      dto.cobradorId = req.user.id;
    }

    try {
      return await this.paymentsService.create(
        dto as CreatePaymentDto,
        comprobante,
        req.user,
      );
    } catch (error: any) {
      this.logger.error(
        `[PaymentsController.create] Error registrando pago: ${error?.message}`,
        JSON.stringify({
          code: error?.code,
          meta: error?.meta,
          stack: error?.stack,
          dto: {
            clienteId: dto?.clienteId,
            prestamoId: dto?.prestamoId,
            cuotaId: dto?.cuotaId,
            montoTotal: dto?.montoTotal,
            fechaOperativaRuta: dto?.fechaOperativaRuta,
            origenGestion: dto?.origenGestion,
            cuotaNumeroEsperada: dto?.cuotaNumeroEsperada,
            montoCuotaEsperado: dto?.montoCuotaEsperado,
            idempotencyKey: dto?.idempotencyKey,
          },
        }),
      );

      throw error;
    }
  }

  @Get()
  findAll(
    @Query('prestamoId') prestamoId?: string,
    @Query('clienteId') clienteId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Request() req?: any,
  ) {
    return this.paymentsService.findAll(
      {
        prestamoId,
        clienteId,
        page: page ? parseInt(page, 10) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
      },
      req?.user,
    );
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
    @Query('prestamoId', new DefaultValuePipe('')) prestamoId: string,
    @Res() res: Response,
  ) {
    const result = await this.paymentsService.exportPayments(
      {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        rutaId: rutaId || undefined,
        prestamoId: prestamoId || undefined,
      },
      format,
    );
    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    res.send(result.data);
  }

  @Get('repair/candidates')
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.ADMIN)
  findRepairCandidates(
    @Query('amount') amount?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('cliente') cliente?: string,
  ) {
    return this.paymentsService.findRepairCandidates({
      amount: amount ? Number(amount) : undefined,
      from,
      to,
      cliente,
    });
  }

  @Post('repair/revert/:pagoId')
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.ADMIN)
  async revertPayment(
    @Param('pagoId') pagoId: string,
    @Body() body: { confirmPagoId?: string; motivo?: string },
    @Request() req: any,
  ) {
    return this.paymentsService.revertPaymentForRepair({
      pagoId,
      confirmPagoId: body?.confirmPagoId,
      motivo: body?.motivo,
      actor: req?.user,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req?: any) {
    return this.paymentsService.findOne(id, req?.user);
  }

  @Post('reconcile/:pagoId')
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.ADMIN)
  async reconcilePayment(@Param('pagoId') pagoId: string) {
    return this.paymentsService.reconcilePayment(pagoId);
  }
}
