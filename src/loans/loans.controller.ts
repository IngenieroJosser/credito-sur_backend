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
  HttpCode,
  HttpStatus,
  Request,
  Res,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { LoansService } from './loans.service';
import { MoraService } from './mora.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '@prisma/client';
import { CreateLoanDto } from './dto/create-loan.dto';
import { ReprogramarCuotaDto } from './dto/reprogramar-cuota.dto';

@ApiTags('loans')
@ApiBearerAuth()
@Controller('loans')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LoansController {
  constructor(
    private readonly loansService: LoansService,
    private readonly moraService: MoraService,
  ) {}


  @Get()
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
    RolUsuario.SUPERVISOR,
    RolUsuario.COBRADOR,
    RolUsuario.CONTADOR,
    RolUsuario.PUNTO_DE_VENTA,
  )
  @ApiOperation({
    summary: 'Obtener todos los préstamos',
    description:
      'Obtiene una lista paginada de préstamos con filtros opcionales',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista de préstamos obtenida exitosamente',
    schema: {
      example: {
        prestamos: [],
        estadisticas: {},
        paginacion: {},
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No autorizado',
  })
  @ApiQuery({
    name: 'estado',
    required: false,
    description: 'Filtro por estado (ACTIVO, EN_MORA, PAGADO, etc.)',
    example: 'ACTIVO',
  })
  @ApiQuery({
    name: 'ruta',
    required: false,
    description: 'Filtro por ID de ruta',
    example: 'cl67qg5e80001c8ibw3d2q7p8',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description:
      'Búsqueda por texto (nombre, apellido, DNI, número de préstamo)',
    example: 'Juan',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Número de página',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Límite por página (máximo 100)',
    example: 8,
  })
  async getAllLoans(
    @Query('estado', new DefaultValuePipe('todos')) estado: string,
    @Query('ruta', new DefaultValuePipe('todas')) ruta: string,
    @Query('search', new DefaultValuePipe('')) search: string,
    @Query('tipo', new DefaultValuePipe('todos')) tipo: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(8), ParseIntPipe) limit: number,
    @Request() req,
  ) {
    // Validar límite máximo
    const safeLimit = Math.min(limit, 100); // Máximo 100 por página

    return this.loansService.getAllLoans({
      estado,
      ruta,
      search,
      tipo,
      page,
      limit: safeLimit,
    });
  }

  @Get(':id')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
    RolUsuario.SUPERVISOR,
    RolUsuario.COBRADOR,
    RolUsuario.CONTADOR,
    RolUsuario.PUNTO_DE_VENTA,
  )
  @ApiOperation({
    summary: 'Obtener un préstamo por ID',
    description: 'Obtiene los detalles completos de un préstamo específico',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Préstamo encontrado',
    schema: {
      example: {
        id: 'cl67qg5e80001c8ibw3d2q7p8',
        numeroPrestamo: 'PRES-000001',
        clienteId: 'cl67qg5e80001c8ibw3d2q7p8',
        // ... más campos
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Préstamo no encontrado',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No autorizado',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del préstamo',
    example: 'cl67qg5e80001c8ibw3d2q7p8',
  })
  async getLoanById(@Param('id') id: string) {
    return this.loansService.getLoanById(id);
  }

  @Get(':id/cuotas')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
    RolUsuario.SUPERVISOR,
    RolUsuario.COBRADOR,
    RolUsuario.CONTADOR,
    RolUsuario.PUNTO_DE_VENTA,
  )
  @ApiOperation({
    summary: 'Obtener cuotas de un préstamo',
    description: 'Obtiene todas las cuotas asociadas a un préstamo específico',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista de cuotas obtenida exitosamente',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Préstamo no encontrado',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del préstamo',
    example: 'cl67qg5e80001c8ibw3d2q7p8',
  })
  async getLoanCuotas(@Param('id') id: string) {
    return this.loansService.getLoanCuotas(id);
  }

  @Post()
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.ADMIN, RolUsuario.COORDINADOR, RolUsuario.COBRADOR, RolUsuario.SUPERVISOR, RolUsuario.PUNTO_DE_VENTA)
  @UsePipes(new ValidationPipe({ transform: true }))
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear un nuevo préstamo',
    description:
      'Crea un nuevo préstamo (en efectivo o por artículo) con cuotas automáticas',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Préstamo creado exitosamente',
    schema: {
      example: {
        id: 'cl67qg5e80001c8ibw3d2q7p8',
        numeroPrestamo: 'PRES-000001',
        mensaje: 'Préstamo creado exitosamente. Pendiente de aprobación.',
        requiereAprobacion: true,
        // ... más campos
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Datos inválidos o validación fallida',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No autorizado',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Cliente o producto no encontrado',
  })
  @ApiBody({
    type: CreateLoanDto,
    description: 'Datos para crear el préstamo',
    examples: {
      'Préstamo en efectivo': {
        value: {
          clienteId: 'cl67qg5e80001c8ibw3d2q7p8',
          tipoPrestamo: 'EFECTIVO',
          monto: 1000000,
          tasaInteres: 10,
          tasaInteresMora: 2,
          plazoMeses: 12,
          frecuenciaPago: 'QUINCENAL',
          fechaInicio: '2024-01-01',
          notas: 'Préstamo para negocios',
        },
      },
      'Crédito por artículo': {
        value: {
          clienteId: 'cl67qg5e80001c8ibw3d2q7p8',
          productoId: 'cl67qg5e80001c8ibw3d2q7p8',
          precioProductoId: 'cl67qg5e80001c8ibw3d2q7p8',
          tipoPrestamo: 'ARTICULO',
          monto: 1500000,
          tasaInteres: 0,
          tasaInteresMora: 2,
          plazoMeses: 6,
          frecuenciaPago: 'MENSUAL',
          fechaInicio: '2024-01-01',
          cuotaInicial: 300000,
          notas: 'Televisor Samsung 55"',
        },
      },
    },
  })
  async createLoan(@Body() createLoanDto: CreateLoanDto, @Request() req) {
    // Obtener usuario del request (JWT)
    const usuarioId = req.user.id;

    // Validar que el usuario existe y está activo
    if (!usuarioId) {
      throw new Error('Usuario no autenticado');
    }

    // Asignar creador automáticamente desde el JWT
    const datosConCreador = {
      ...createLoanDto,
      creadoPorId: usuarioId,
    };

    return this.loansService.createLoan(datosConCreador);
  }

  @Post(':id/approve')
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.COORDINADOR, RolUsuario.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Aprobar un préstamo',
    description:
      'Aprueba un préstamo pendiente de aprobación, cambiando su estado a ACTIVO',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Préstamo aprobado exitosamente',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Préstamo no encontrado',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'El préstamo no está pendiente de aprobación',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No autorizado',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del préstamo a aprobar',
    example: 'cl67qg5e80001c8ibw3d2q7p8',
  })
  @ApiBody({
    description: 'Datos para aprobar el préstamo',
    schema: {
      type: 'object',
      properties: {
        aprobadoPorId: {
          type: 'string',
          description:
            'ID del usuario que aprueba (se obtiene automáticamente del JWT)',
          example: 'cl67qg5e80001c8ibw3d2q7p8',
        },
      },
    },
  })
  async approveLoan(@Param('id') id: string, @Request() req) {
    // Obtener usuario del request (JWT)
    const aprobadoPorId = req.user.id;

    return this.loansService.approveLoan(id, aprobadoPorId);
  }

  @Post(':id/reject')
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.COORDINADOR, RolUsuario.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rechazar un préstamo',
    description: 'Rechaza un préstamo pendiente de aprobación',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Préstamo rechazado exitosamente',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Préstamo no encontrado',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No autorizado',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del préstamo a rechazar',
    example: 'cl67qg5e80001c8ibw3d2q7p8',
  })
  @ApiBody({
    description: 'Datos para rechazar el préstamo',
    schema: {
      type: 'object',
      properties: {
        rechazadoPorId: {
          type: 'string',
          description:
            'ID del usuario que rechaza (se obtiene automáticamente del JWT)',
          example: 'cl67qg5e80001c8ibw3d2q7p8',
        },
        motivo: {
          type: 'string',
          description: 'Motivo del rechazo',
          example: 'Cliente con historial crediticio deficiente',
          // required: false
        },
      },
    },
  })
  async rejectLoan(
    @Param('id') id: string,
    @Body() body: { motivo?: string },
    @Request() req,
  ) {
    // Obtener usuario del request (JWT)
    const rechazadoPorId = req.user.id;

    return this.loansService.rejectLoan(id, rechazadoPorId, body.motivo);
  }

  @Delete(':id')
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.COORDINADOR, RolUsuario.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Eliminar un préstamo (marcar como eliminado)',
    description:
      'Marca un préstamo como eliminado (soft delete) cambiando su estado a PERDIDA',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Préstamo eliminado exitosamente',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Préstamo no encontrado',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No autorizado',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del préstamo a eliminar',
    example: 'cl67qg5e80001c8ibw3d2q7p8',
  })
  async deleteLoan(@Param('id') id: string, @Request() req) {
    // Obtener usuario del request (JWT)
    const userId = req.user.id;

    return this.loansService.deleteLoan(id, userId);
  }

  @Get('export')
  @Roles(
    RolUsuario.COORDINADOR,
    RolUsuario.SUPERVISOR,
    RolUsuario.ADMIN,
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.CONTADOR,
  )
  @ApiOperation({
    summary: 'Exportar listado de préstamos',
    description: 'Exporta el listado de préstamos en formato Excel (.xlsm) o PDF',
  })
  @ApiQuery({ name: 'format', required: true, enum: ['excel', 'pdf'] })
  @ApiQuery({ name: 'estado', required: false })
  @ApiQuery({ name: 'ruta', required: false })
  @ApiQuery({ name: 'search', required: false })
  @HttpCode(HttpStatus.OK)
  async exportLoans(
    @Query('format') format: 'excel' | 'pdf',
    @Query('estado', new DefaultValuePipe('todos')) estado: string,
    @Query('ruta', new DefaultValuePipe('todas')) ruta: string,
    @Query('search', new DefaultValuePipe('')) search: string,
    @Res() res: Response,
  ) {
    const result = await this.loansService.exportLoans(
      { estado, ruta, search },
      format,
    );
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.data);
  }

  @Patch(':id')
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.COORDINADOR, RolUsuario.ADMIN)
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({
    summary: 'Actualizar un préstamo',
    description: 'Actualiza los datos editables de un préstamo existente',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Préstamo actualizado exitosamente',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Préstamo no encontrado',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No autorizado',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del préstamo a actualizar',
    example: 'cl67qg5e80001c8ibw3d2q7p8',
  })
  async updateLoan(
    @Param('id') id: string,
    @Body() updateData: any,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.loansService.updateLoan(id, updateData, userId);
  }

  @Patch(':id/restore')
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.COORDINADOR, RolUsuario.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Restaurar un préstamo eliminado',
    description: 'Restaura un préstamo previamente eliminado (soft delete)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Préstamo restaurado exitosamente',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Préstamo no encontrado',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'El préstamo no está eliminado',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No autorizado',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del préstamo a restaurar',
    example: 'cl67qg5e80001c8ibw3d2q7p8',
  })
  async restoreLoan(@Param('id') id: string, @Request() req) {
    // Obtener usuario del request (JWT)
    const userId = req.user.id;

    return this.loansService.restoreLoan(id, userId);
  }

  @Get(':id/contrato')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.SUPERVISOR,
    RolUsuario.COORDINADOR,
  )
  @ApiOperation({ summary: 'Generar contrato PDF para crédito de artículo' })
  @ApiParam({ name: 'id', description: 'ID del préstamo (solo tipo ARTICULO)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Contrato PDF generado' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'No es un crédito de artículo' })
  @HttpCode(HttpStatus.OK)
  async generarContrato(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const result = await this.loansService.generarContrato(id);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.data);
  }

  @Post(':id/archive')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
    RolUsuario.SUPERVISOR,
  )
  @ApiOperation({ summary: 'Archivar préstamo como pérdida y agregar cliente a blacklist' })
  @ApiParam({ name: 'id', description: 'ID del préstamo a archivar' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        motivo: { type: 'string', example: 'Impago reiterado' },
        notas: { type: 'string', example: 'Cliente no responde llamadas' },
      },
      required: ['motivo'],
    },
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Préstamo archivado exitosamente' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Préstamo no encontrado' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'El préstamo ya está archivado' })
  async archiveLoan(
    @Param('id') id: string,
    @Body() body: { motivo: string; notas?: string },
    @Request() req,
  ) {
    return this.loansService.archiveLoan(id, {
      motivo: body.motivo,
      notas: body.notas,
      archivarPorId: req.user.id,
    });
  }

  @Patch(':id/cuotas/:numeroCuota/reprogramar')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
    RolUsuario.SUPERVISOR,
  )
  @ApiOperation({ summary: 'Reprogramar fecha de vencimiento de una cuota' })
  @ApiParam({ name: 'id', description: 'ID del préstamo' })
  @ApiParam({ name: 'numeroCuota', description: 'Número de la cuota a reprogramar' })
  @ApiBody({ type: ReprogramarCuotaDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'Cuota reprogramada exitosamente' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Préstamo o cuota no encontrada' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Datos inválidos' })
  async reprogramarCuota(
    @Param('id') id: string,
    @Param('numeroCuota', ParseIntPipe) numeroCuota: number,
    @Body() reprogramarDto: ReprogramarCuotaDto,
    @Request() req,
  ) {
    return this.loansService.reprogramarCuota(id, numeroCuota, {
      ...reprogramarDto,
      reprogramadoPorId: req.user.id,
    });
  }

  @Post('fix-interest-calculations')
  @Roles(RolUsuario.SUPER_ADMINISTRADOR)
  @ApiOperation({
    summary: 'Corregir cálculos de intereses en préstamos existentes',
    description: 'Ejecuta script de corrección masiva para préstamos con interés simple mal calculado',
  })
  async fixInterestCalculations() {
    return this.loansService.fixInterestCalculations();
  }

  // ─── ENDPOINTS DE MORA ────────────────────────────────────────────────────

  @Post('procesar-mora')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Procesar mora automática',
    description:
      'Marca cuotas vencidas, actualiza préstamos a EN_MORA y actualiza nivel de riesgo de clientes. ' +
      'Este proceso también se ejecuta automáticamente al arrancar el servidor.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Proceso de mora ejecutado exitosamente',
    schema: {
      example: {
        cuotasVencidas: 5,
        prestamosEnMoraActualizados: 3,
        prestamosActivosRecuperados: 1,
        clientesRiesgoActualizado: 4,
        errores: [],
        procesadoEn: '2026-02-27T17:00:00.000Z',
      },
    },
  })
  async procesarMora() {
    return this.moraService.procesarMoraAutomatica();
  }

  @Get('mora/cliente/:clienteId')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
    RolUsuario.SUPERVISOR,
    RolUsuario.COBRADOR,
  )
  @ApiOperation({
    summary: 'Resumen de mora de un cliente',
    description:
      'Retorna días en mora, nivel de riesgo, etiqueta (Mínimo/Leve/Precaución/Moderado/Crítico) y montos vencidos del cliente.',
  })
  @ApiParam({ name: 'clienteId', description: 'ID del cliente' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Resumen de mora del cliente',
    schema: {
      example: {
        clienteId: 'abc123',
        diasEnMora: 12,
        nivelRiesgo: 'AMARILLO',
        etiqueta: 'Precaución',
        cuotasVencidas: 2,
        montoVencido: 150000,
      },
    },
  })
  async getResumenMoraCliente(@Param('clienteId') clienteId: string) {
    return this.moraService.getResumenMoraCliente(clienteId);
  }
}

