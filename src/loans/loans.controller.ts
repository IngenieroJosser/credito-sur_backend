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
  BadRequestException,
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
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario, TipoAprobacion } from '@prisma/client';
import { CreateLoanDto } from './dto/create-loan.dto';
import { ReprogramarCuotaDto } from './dto/reprogramar-cuota.dto';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { AuditService } from '../audit/audit.service';

import { ApprovalsService } from '../approvals/approvals.service';

@ApiTags('loans')
@ApiBearerAuth()
@Controller('loans')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LoansController {
  constructor(
    private readonly loansService: LoansService,
    private readonly moraService: MoraService,
    private readonly prisma: PrismaService,
    private readonly notificacionesService: NotificacionesService,
    private readonly auditService: AuditService,
    private readonly approvalsService: ApprovalsService,
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

  @Get('export')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
    RolUsuario.CONTADOR,
  )
  @ApiOperation({ summary: 'Exportar listado de préstamos y cartera en Excel o PDF' })
  @ApiQuery({ name: 'format', enum: ['excel', 'pdf'], required: true })
  @ApiQuery({ name: 'estado', required: false })
  @ApiQuery({ name: 'ruta', required: false })
  @ApiQuery({ name: 'search', required: false })
  @HttpCode(HttpStatus.OK)
  async exportLoans(
    @Res() res: Response,
    @Query('format', new DefaultValuePipe('excel')) format: 'excel' | 'pdf',
    @Query('estado') estado?: string,
    @Query('ruta') ruta?: string,
    @Query('search') search?: string,
  ) {
    const result = await this.loansService.exportLoans(format, {
      estado,
      ruta,
      search,
    });
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.data);
  }

  @Get(':id/contrato')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
    RolUsuario.SUPERVISOR,
    RolUsuario.PUNTO_DE_VENTA,
  )
  @ApiOperation({ summary: 'Exportar contrato de crédito de artículo en PDF' })
  @ApiQuery({ name: 'format', enum: ['pdf'], required: false })
  @HttpCode(HttpStatus.OK)
  async exportContrato(
    @Res() res: Response,
    @Param('id') id: string,
    @Query('format', new DefaultValuePipe('pdf')) format: 'pdf',
  ) {
    if (format !== 'pdf') {
      throw new BadRequestException('Formato no soportado');
    }

    const result = await this.loansService.generarContrato(id);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.data);
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

  @Get(':id/archived')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
    RolUsuario.CONTADOR,
  )
  @ApiOperation({
    summary: 'Obtener un préstamo archivado por ID',
    description: 'Obtiene los detalles de un préstamo incluso si está eliminado (soft delete).',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Préstamo encontrado',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Préstamo no encontrado',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del préstamo',
  })
  async getArchivedLoanById(@Param('id') id: string) {
    return this.loansService.getLoanByIdIncludingArchived(id);
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
    console.log('[CONTROLLER DEBUG] createLoan received:', JSON.stringify(createLoanDto));
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

  // ─────────────────────────────────────────────────────────────────────
  // GESTIÓN MORA — Asignar interés de mora manual
  // Crea Aprobacion + Auditoria + Notificación
  // ─────────────────────────────────────────────────────────────────────
  @Post(':id/asignar-mora')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
    RolUsuario.SUPERVISOR,
  )
  @ApiOperation({ summary: 'Asignar interés de mora a un préstamo (requiere aprobación)' })
  async asignarMora(
    @Param('id') prestamoId: string,
    @Body() body: {
      montoInteres: number;
      diasGracia: number;
      comentarios?: string;
    },
    @Request() req: any,
  ) {
    const usuarioId: string = req.user?.sub || req.user?.id;
    if (!usuarioId) throw new Error('Usuario no autenticado');

    // Cargar el préstamo con datos del cliente
    const prestamo = await this.prisma.prestamo.findUnique({
      where: { id: prestamoId },
      include: {
        cliente: { select: { nombres: true, apellidos: true, dni: true } },
      },
    });
    if (!prestamo) throw new Error('Préstamo no encontrado');

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { nombres: true, apellidos: true, rol: true },
    });
    const nombreUsuario = usuario ? `${usuario.nombres} ${usuario.apellidos}` : 'Usuario';
    const nombreCliente = prestamo.cliente
      ? `${prestamo.cliente.nombres} ${prestamo.cliente.apellidos}`
      : 'Cliente';

    // Calcular fecha límite de gracia
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() + body.diasGracia);

    // 1. Crear solicitud de aprobación
    const aprobacion = await this.prisma.aprobacion.create({
      data: {
        tipoAprobacion: 'PRORROGA_PAGO' as TipoAprobacion, // reutilizamos tipo existente
        solicitadoPorId: usuarioId,
        referenciaId: prestamoId,
        tablaReferencia: 'Prestamo',
        montoSolicitud: body.montoInteres,
        datosSolicitud: {
          tipo: 'ASIGNAR_MORA',
          prestamoId,
          numeroPrestamo: prestamo.numeroPrestamo,
          cliente: nombreCliente,
          montoInteres: body.montoInteres,
          diasGracia: body.diasGracia,
          fechaLimite: fechaLimite.toISOString(),
          comentarios: body.comentarios,
          saldoPendiente: Number(prestamo.saldoPendiente),
          asignadoPor: nombreUsuario,
          rolAsignador: usuario?.rol,
        } as any,
      },
    });

    // 2. Registrar en auditoría
    await this.auditService.create({
      usuarioId,
      accion: 'ASIGNAR_MORA',
      entidad: 'Prestamo',
      entidadId: prestamoId,
      datosNuevos: {
        aprobacionId: aprobacion.id,
        montoInteres: body.montoInteres,
        diasGracia: body.diasGracia,
        cliente: nombreCliente,
        prestamo: prestamo.numeroPrestamo,
        comentarios: body.comentarios,
      },
      metadata: { endpoint: `POST /loans/${prestamoId}/asignar-mora` },
    });

    // 3. Notificar a aprobadores (interna + push)
    await this.notificacionesService.notifyApprovers({
      titulo: 'Mora asignada — Requiere aprobacion',
      mensaje: `${nombreUsuario} asignó $${body.montoInteres.toLocaleString('es-CO')} de mora al préstamo ${prestamo.numeroPrestamo} (${nombreCliente}). Plazo: ${body.diasGracia} días. Requiere aprobación.`,
      tipo: 'ALERTA',
      entidad: 'Aprobacion',
      entidadId: aprobacion.id,
      metadata: {
        tipoAprobacion: 'PRORROGA_PAGO',
        tipo: 'ASIGNAR_MORA',
        prestamoId,
        montoInteres: body.montoInteres,
        diasGracia: body.diasGracia,
        cliente: nombreCliente,
        asignadoPor: nombreUsuario,
      },
    });

    try {
      await this.notificacionesService.create({
        usuarioId,
        titulo: 'Solicitud enviada',
        mensaje: 'Tu solicitud fue enviada con éxito y quedó pendiente de aprobación.',
        tipo: 'INFORMATIVO',
        entidad: 'Aprobacion',
        entidadId: aprobacion.id,
        metadata: {
          tipoAprobacion: 'PRORROGA_PAGO',
          tipo: 'ASIGNAR_MORA',
          prestamoId,
        },
      });
    } catch {}

    return {
      mensaje: 'Mora pendiente de aprobación creada exitosamente',
      aprobacionId: aprobacion.id,
      fechaLimite: fechaLimite.toISOString(),
    };
  }

  // GESTIÓN VENCIDA — Prorrogar / Castigar / Dejar Quieto
  // Crea Aprobacion + Auditoria + Notificación
  // ─────────────────────────────────────────────────────────────────────
  @Post(':id/gestion-vencida')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
    RolUsuario.SUPERVISOR,
    RolUsuario.CONTADOR,
  )
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Procesar gestión sobre cuenta vencida' })
  async gestionarVencida(
    @Param('id') prestamoId: string,
    @Body() body: {
      decision: 'CASTIGAR' | 'PRORROGAR' | 'DEJAR_QUIETO';
      montoInteres?: number;
      diasGracia?: number;
      comentarios?: string;
    },
    @Request() req: any,
  ) {
    const usuarioId: string = req.user?.sub || req.user?.id;
    if (!usuarioId) throw new Error('Usuario no autenticado');

    const prestamo = await this.prisma.prestamo.findUnique({
      where: { id: prestamoId },
      include: { cliente: true },
    });
    if (!prestamo) throw new Error('Préstamo no encontrado');

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { nombres: true, apellidos: true, rol: true },
    });
    const nombreUsuario = usuario ? `${usuario.nombres} ${usuario.apellidos}`.trim() : 'Usuario';
    const nombreCliente = prestamo.cliente
      ? `${prestamo.cliente.nombres} ${prestamo.cliente.apellidos}`.trim()
      : 'Cliente';

    const LABEL_DECISION: Record<string, string> = {
      PRORROGAR: 'Prórroga',
      DEJAR_QUIETO: 'Dejar quieto',
      CASTIGAR: 'Baja por pérdida',
    };

    let cuotaId: string | null = null;
    if (body.decision === 'PRORROGAR') {
      const cuotaVencida = await this.prisma.cuota.findFirst({
        where: {
          prestamoId,
          estado: { in: ['VENCIDA', 'PENDIENTE'] },
        },
        orderBy: { numeroCuota: 'asc' },
      });
      cuotaId = cuotaVencida?.id || null;
    }

    const tipoAprobacion: TipoAprobacion =
      body.decision === 'CASTIGAR'
        ? ('BAJA_POR_PERDIDA' as TipoAprobacion)
        : ('PRORROGA_PAGO' as TipoAprobacion);

    const dias = Number(body.diasGracia || 0) > 0 ? Number(body.diasGracia) : 30;
    const nuevaFecha = new Date();
    nuevaFecha.setDate(nuevaFecha.getDate() + dias);

    const aprobacion = await this.prisma.aprobacion.create({
      data: {
        tipoAprobacion,
        solicitadoPorId: usuarioId,
        referenciaId: prestamoId,
        tablaReferencia: 'Prestamo',
        montoSolicitud: Number(prestamo.saldoPendiente),
        datosSolicitud: {
          tipo: 'GESTION_VENCIDA',
          decision: body.decision,
          prestamoId,
          cuotaId,
          numeroPrestamo: prestamo.numeroPrestamo,
          cliente: nombreCliente,
          clienteNombre: nombreCliente,
          saldoPendiente: Number(prestamo.saldoPendiente),
          montoInteres: Number(body.montoInteres || 0),
          diasGracia: body.decision === 'CASTIGAR' ? 0 : dias,
          fechaVencimientoOriginal: prestamo.fechaFin ? new Date(prestamo.fechaFin).toISOString() : undefined,
          nuevaFechaVencimiento:
            body.decision === 'PRORROGAR' ? nuevaFecha.toISOString() : undefined,
          comentarios: body.comentarios,
          gestionadoPor: nombreUsuario,
          rolGestor: usuario?.rol,
        } as any,
      },
    });

    await this.auditService.create({
      usuarioId,
      accion: `GESTION_VENCIDA_${body.decision}`,
      entidad: 'Prestamo',
      entidadId: prestamoId,
      datosNuevos: {
        aprobacionId: aprobacion.id,
        decision: body.decision,
        cliente: nombreCliente,
        prestamo: prestamo.numeroPrestamo,
        montoInteres: Number(body.montoInteres || 0),
        diasGracia: body.decision === 'CASTIGAR' ? 0 : dias,
        comentarios: body.comentarios,
      },
      metadata: { endpoint: `POST /loans/${prestamoId}/gestion-vencida` },
    });

    // Salir de Cuentas Vencidas inmediatamente solo para PRORROGAR
    if (body.decision === 'PRORROGAR') {
      try {
        await this.prisma.prestamo.update({
          where: { id: prestamoId },
          data: { fechaFin: nuevaFecha },
        });
      } catch {
        // no interrumpir
      }
    }

    const rolesAutoAprobacion: string[] = [
      RolUsuario.ADMIN,
      RolUsuario.SUPER_ADMINISTRADOR,
      RolUsuario.COORDINADOR,
    ];
    if (usuario && rolesAutoAprobacion.includes(usuario.rol)) {
      try {
        if (tipoAprobacion === ('BAJA_POR_PERDIDA' as any)) {
          await this.prisma.aprobacion.update({
            where: { id: aprobacion.id },
            data: { estado: 'APROBADO', aprobadoPorId: usuarioId, revisadoEn: new Date() } as any,
          });
          await this.loansService.archiveLoan(prestamoId, {
            motivo: body.comentarios || 'Baja por pérdida (auto-aprobado)',
            archivarPorId: usuarioId,
          });
        } else {
          await this.approvalsService.approveItem(aprobacion.id, tipoAprobacion, usuarioId);
        }

        return {
          mensaje: `Decisión de ${LABEL_DECISION[body.decision]} aprobada y ejecutada automáticamente`,
          aprobacionId: aprobacion.id,
          decision: body.decision,
        };
      } catch (error) {
        console.error('Error auto-aprobando gestión vencida:', error);
      }
    }

    try {
      const msgPorDecision: Record<string, string> = {
        PRORROGAR: `${nombreUsuario} solicitó una prórroga de ${dias} días para el préstamo ${prestamo.numeroPrestamo} del cliente ${nombreCliente}.`,
        DEJAR_QUIETO: `${nombreUsuario} solicitó dejar quieto el préstamo ${prestamo.numeroPrestamo} del cliente ${nombreCliente}.`,
        CASTIGAR: `${nombreUsuario} solicitó dar de baja por pérdida el préstamo ${prestamo.numeroPrestamo} del cliente ${nombreCliente}.`,
      };
      await this.notificacionesService.notifyApprovers({
        titulo: `${LABEL_DECISION[body.decision]} — ${nombreCliente} (${prestamo.numeroPrestamo})`,
        mensaje: msgPorDecision[body.decision] || `${nombreUsuario} solicitó ${LABEL_DECISION[body.decision].toLowerCase()} para el préstamo ${prestamo.numeroPrestamo}.`,
        tipo: body.decision === 'CASTIGAR' ? 'WARNING' : 'INFO',
        entidad: 'Aprobacion',
        entidadId: aprobacion.id,
        metadata: {
          tipoAprobacion,
          tipo: 'GESTION_VENCIDA',
          decision: body.decision,
          prestamoId,
          cliente: nombreCliente,
          numeroPrestamo: prestamo.numeroPrestamo,
          saldoPendiente: Number(prestamo.saldoPendiente),
          diasGracia: body.decision === 'CASTIGAR' ? 0 : dias,
          montoInteres: Number(body.montoInteres || 0),
          gestionadoPor: nombreUsuario,
        },
      });
    } catch {}

    try {
      await this.notificacionesService.create({
        usuarioId,
        titulo: `Solicitud de ${LABEL_DECISION[body.decision]} enviada`,
        mensaje: 'Tu solicitud fue enviada con éxito y quedó pendiente de aprobación.',
        tipo: 'INFORMATIVO',
        entidad: 'Aprobacion',
        entidadId: aprobacion.id,
        metadata: {
          tipoAprobacion,
          tipo: 'GESTION_VENCIDA',
          decision: body.decision,
          prestamoId,
        },
      });
    } catch {}

    return {
      mensaje: `Solicitud de ${LABEL_DECISION[body.decision]} enviada a revisión`,
      aprobacionId: aprobacion.id,
      decision: body.decision,
    };
  }

  @Post(':id/reprogramacion')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
    RolUsuario.SUPERVISOR,
    RolUsuario.COBRADOR,
  )
  @ApiOperation({ summary: 'Solicitar reprogramación de cuota' })
  async solicitarReprogramacion(
    @Param('id') prestamoId: string,
    @Body() body: {
      cuotaId: string;
      nuevaFecha: string;
      motivo: string;
    },
    @Request() req: any,
  ) {
    const usuarioId: string = req.user?.sub || req.user?.id;
    if (!usuarioId) throw new Error('Usuario no autenticado');

    const prestamo = await this.prisma.prestamo.findUnique({
      where: { id: prestamoId },
      include: { cliente: true },
    });
    if (!prestamo) throw new Error('Préstamo no encontrado');

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { nombres: true, apellidos: true, rol: true },
    });
    const nombreUsuario = usuario ? `${usuario.nombres} ${usuario.apellidos}`.trim() : 'Usuario';
    const nombreCliente = prestamo.cliente
      ? `${prestamo.cliente.nombres} ${prestamo.cliente.apellidos}`.trim()
      : 'Cliente';

    const cuota = await this.prisma.cuota.findUnique({
      where: { id: body.cuotaId },
      include: { prestamo: true },
    });
    if (!cuota) throw new Error('Cuota no encontrada');

    const nuevaFechaCuota = new Date(body.nuevaFecha);
    if (nuevaFechaCuota < new Date()) {
      throw new Error('La nueva fecha de la cuota debe ser posterior a la fecha actual');
    }

    const aprobacion = await this.prisma.aprobacion.create({
      data: {
        tipoAprobacion: 'REPROGRAMACION_CUOTA' as TipoAprobacion,
        solicitadoPorId: usuarioId,
        referenciaId: prestamoId,
        tablaReferencia: 'Prestamo',
        montoSolicitud: cuota.monto,
        datosSolicitud: {
          tipo: 'REPROGRAMACION_CUOTA',
          prestamoId,
          cuotaId: body.cuotaId,
          numeroPrestamo: prestamo.numeroPrestamo,
          cliente: nombreCliente,
          clienteNombre: nombreCliente,
          saldoPendiente: Number(prestamo.saldoPendiente),
          montoCuota: cuota.monto,
          fechaVencimientoOriginal: cuota.fechaVencimiento ? new Date(cuota.fechaVencimiento).toISOString() : undefined,
          nuevaFechaVencimiento: nuevaFechaCuota.toISOString(),
          motivo: body.motivo,
          solicitadoPor: nombreUsuario,
          rolSolicitante: usuario?.rol,
        } as any,
      },
    });

    await this.auditService.create({
      usuarioId,
      accion: 'REPROGRAMACION_CUOTA',
      entidad: 'Prestamo',
      entidadId: prestamoId,
      datosNuevos: {
        aprobacionId: aprobacion.id,
        cuotaId: body.cuotaId,
        nuevaFechaVencimiento: nuevaFechaCuota.toISOString(),
        motivo: body.motivo,
      },
      metadata: { endpoint: `POST /loans/${prestamoId}/reprogramacion` },
    });

    try {
      await this.notificacionesService.notifyApprovers({
        titulo: `Reprogramación de cuota — ${nombreCliente} (${prestamo.numeroPrestamo})`,
        mensaje: `${nombreUsuario} solicitó reprogramar la cuota ${cuota.numeroCuota} del préstamo ${prestamo.numeroPrestamo} del cliente ${nombreCliente} para el ${nuevaFechaCuota.toLocaleDateString('es-CO')}.`,
        tipo: 'INFO',
        entidad: 'Aprobacion',
        entidadId: aprobacion.id,
        metadata: {
          tipoAprobacion: 'REPROGRAMACION_CUOTA',
          tipo: 'REPROGRAMACION_CUOTA',
          prestamoId,
          cuotaId: body.cuotaId,
          numeroPrestamo: prestamo.numeroPrestamo,
          cliente: nombreCliente,
          saldoPendiente: Number(prestamo.saldoPendiente),
          montoCuota: cuota.monto,
          nuevaFechaVencimiento: nuevaFechaCuota.toISOString(),
          motivo: body.motivo,
          solicitadoPor: nombreUsuario,
        },
      });
    } catch {}

    try {
      await this.notificacionesService.create({
        usuarioId,
        titulo: 'Solicitud de reprogramación enviada',
        mensaje: 'Tu solicitud fue enviada con éxito y quedó pendiente de aprobación.',
        tipo: 'INFORMATIVO',
        entidad: 'Aprobacion',
        entidadId: aprobacion.id,
        metadata: {
          tipoAprobacion: 'REPROGRAMACION_CUOTA',
          tipo: 'REPROGRAMACION_CUOTA',
          prestamoId,
        },
      });
    } catch {}

    return {
      mensaje: 'Solicitud de reprogramación enviada a revisión',
      aprobacionId: aprobacion.id,
    };
  }

  @Get('reprogramaciones-pendientes')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
    RolUsuario.SUPERVISOR,
  )
  @ApiOperation({ summary: 'Listar solicitudes de reprogramación pendientes' })
  @ApiQuery({ name: 'estado', required: false, enum: ['PENDIENTE', 'APROBADO', 'RECHAZADO', 'TODOS'] })
  async listarReprogramacionesPendientes(@Query('estado') estado?: string) {
    return this.loansService.listarReprogramacionesPendientes(estado);
  }

  @Patch('reprogramaciones/:id/aprobar')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
    RolUsuario.SUPERVISOR,
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Aprobar solicitud de reprogramación' })
  async aprobarReprogramacion(@Param('id') id: string, @Request() req: any) {
    return this.loansService.aprobarReprogramacion(id, req.user.id);
  }

  @Patch('reprogramaciones/:id/rechazar')
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
    RolUsuario.SUPERVISOR,
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rechazar solicitud de reprogramación' })
  async rechazarReprogramacion(
    @Param('id') id: string,
    @Body() body: { comentarios?: string },
    @Request() req: any,
  ) {
    return this.loansService.rechazarReprogramacion(id, req.user.id, body.comentarios);
  }
}