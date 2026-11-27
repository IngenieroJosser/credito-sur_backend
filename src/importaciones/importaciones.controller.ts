import {
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  HttpCode,
  Res,
  ParseFilePipe,
  MaxFileSizeValidator,
  BadRequestException,
  Req,
  Request,
  Header,
  ParseUUIDPipe,
  Body,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ImportacionesService } from './importaciones.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PermisosGuard } from '../auth/guards/permisos.guard';
import { Permisos } from '../auth/decorators/permisos.decorator';
import { RolUsuario } from '@prisma/client';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { SWAGGER_JWT_AUTH } from '../auth/constants/swagger-auth.constants';

import { RequestConUsuario } from '../common/types';
import { prepararHistoricos } from './preparacion/preparar-historicos';
import { generarConsolidadoHistorico } from './preparacion/consolidado-historico';
import { ExpedienteHistoricoService } from './preparacion/expediente-historico.service';
import { CargaExpedienteHistoricoService, type ConfirmacionPruebaHistorica } from './preparacion/carga-expediente-historico.service';
import { presentarRevisionHistorica } from './preparacion/presentar-revision-historica';
import { esEntornoHistoricoAislado } from '../common/entorno-historico-aislado';

@ApiTags('Importaciones')
@ApiBearerAuth(SWAGGER_JWT_AUTH)
// Acceso por la MATRIZ DE PERMISOS (permiso 'importaciones'), no por rol fijo:
// así un coordinador puede recibir acceso a importar sin abrir el rol entero.
// SUPER_ADMINISTRADOR pasa siempre (PermisosGuard). La reversión de lotes
// conserva su candado de solo-superadmin con RolesGuard a nivel de método.
@UseGuards(JwtAuthGuard, PermisosGuard)
@Permisos('importaciones')
@Controller('importaciones')
export class ImportacionesController {
  constructor(
    private readonly importacionesService: ImportacionesService,
    private readonly expedientes: ExpedienteHistoricoService,
    private readonly cargaHistorica: CargaExpedienteHistoricoService,
  ) {}

  private assertXlsxFile(file: Express.Multer.File) {
    const originalName = file?.originalname || '';
    if (!originalName.toLowerCase().endsWith('.xlsx')) {
      throw new BadRequestException('Solo se permiten archivos .xlsx');
    }
  }

  @Get('lotes')
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.ADMIN)
  async listarLotes() {
    return this.importacionesService.listarLotes();
  }

  /**
   * Todo lo que creó una importación, crédito por crédito.
   *
   * El listado solo dice cuántos créditos hizo, y con eso nadie puede decidir
   * cuál deshacer. Esto es lo que alimenta la pantalla donde se revisa antes.
   */
  @Get('lotes/:id')
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.ADMIN)
  async detalleLote(@Param('id') id: string) {
    return this.importacionesService.detalleLote(id);
  }

  /**
   * Deshace una importación, entera o solo algunos de sus créditos.
   *
   * Solo el superadministrador. Deshacer devuelve plata a la caja y artículos
   * a la bodega, y borra créditos de clientes reales: no es una operación de
   * uso corriente aunque quien importó sea administrador.
   *
   * Sin `prestamoIds` se deshace todo el lote. Con la lista, solo esos.
   */
  @Post('lotes/:id/revertir')
  // La reversión (deshacer un lote, mueve dinero y cartera) queda SOLO para
  // superadmin: se re-activa RolesGuard a nivel de método sobre el @Permisos
  // de la clase.
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.SUPER_ADMINISTRADOR)
  async revertirLote(
    @Request() req: RequestConUsuario,
    @Param('id') id: string,
    @Body() body?: { prestamoIds?: string[] },
  ) {
    if (!req?.user?.id) {
      throw new UnauthorizedException('Usuario no autenticado');
    }
    return this.importacionesService.revertirLote(id, {
      prestamoIds: body?.prestamoIds,
      usuarioId: req.user.id,
    });
  }

  @Get('plantilla/clientes-creditos')
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.ADMIN)
  async descargarPlantillaClientesCreditos(@Res() res: Response) {
    const { data, contentType, filename } =
      await this.importacionesService.generarPlantillaClientesCreditos();
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(data);
  }

  @Get('plantilla/integral')
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.ADMIN)
  async descargarPlantillaIntegral(@Res() res: Response) {
    const { data, contentType, filename } =
      await this.importacionesService.generarPlantillaClientesCreditos(true);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(data);
  }

  @Get('plantilla/inventario')
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.ADMIN)
  async descargarPlantillaInventario(@Res() res: Response) {
    const { data, contentType, filename } =
      await this.importacionesService.generarPlantillaInventario();
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(data);
  }

  @Post('historicos/preparar')
  @HttpCode(200)
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.ADMIN)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'cartera', maxCount: 1 },
    { name: 'inventario', maxCount: 1 },
    { name: 'decisiones', maxCount: 1 },
    { name: 'integral', maxCount: 1 },
  ], { limits: { files: 3, fileSize: 8 * 1024 * 1024, fields: 0 } }))
  async prepararCarteraHistorica(
    @UploadedFiles() archivos: Partial<Record<'cartera' | 'inventario' | 'decisiones' | 'integral', Express.Multer.File[]>>,
    @Res() res: Response,
    @Req() req: RequestConUsuario,
    @Query('modo') modo?: string,
  ) {
    if (modo !== undefined && modo !== 'revisar') {
      throw new BadRequestException('Modo de preparación no válido.');
    }
    const integral = archivos?.integral?.[0];
    if (integral && (modo !== 'revisar' || archivos.cartera || archivos.inventario || archivos.decisiones)) {
      throw new BadRequestException('Revise el libro integral solo, sin otros archivos.');
    }
    const cartera = integral ?? archivos?.cartera?.[0];
    const inventario = integral ?? archivos?.inventario?.[0];
    if (!cartera || !inventario) throw new BadRequestException('Adjunte los archivos de cartera e inventario.');
    this.assertXlsxFile(cartera);
    this.assertXlsxFile(inventario);

    const archivoDecisiones = archivos.decisiones?.[0];
    let decisiones: unknown;
    if (archivoDecisiones) {
      if (!archivoDecisiones.originalname.toLowerCase().endsWith('.json') || archivoDecisiones.size > 2 * 1024 * 1024) {
        throw new BadRequestException('Las decisiones deben ser un archivo JSON de hasta 2 MB.');
      }
      try {
        decisiones = JSON.parse(archivoDecisiones.buffer.toString('utf8').replace(/^\uFEFF/, ''));
      } catch {
        throw new BadRequestException('El archivo de decisiones no es un JSON válido.');
      }
    }
    let preparacion: Awaited<ReturnType<typeof prepararHistoricos>>;
    try {
      preparacion = await prepararHistoricos(
        { nombre: cartera.originalname, bytes: cartera.buffer },
        { nombre: inventario.originalname, bytes: inventario.buffer },
        modo === 'revisar' ? undefined : decisiones,
      );
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'No se pudo preparar la cartera.');
    }
    if (integral && !preparacion.modoIntegral) {
      throw new BadRequestException('Seleccione un libro integral histórico preparado por el sistema.');
    }
    res.setHeader('Cache-Control', 'no-store');
    if (modo === 'revisar') {
      const id = req.user?.id;
      if (!id) throw new UnauthorizedException();
      const guardado = await this.expedientes.abrir(preparacion, id);
      const revision = presentarRevisionHistorica(guardado.preparacion);
      if (integral && guardado.expediente.estado === 'EN_REVISION') {
        const [stock, creditos] = await Promise.all([
          this.importacionesService.validarInventario(integral),
          this.importacionesService.validarClientesCreditos(integral),
        ]);
        const filas = guardado.preparacion.filas;
        const refs = (tipo: (typeof filas)[number]['tipo']) => filas.filter(f => f.tipo === tipo).map(f => f.referencia);
        const inventario = refs('ARTICULO');
        const clientes = refs('CLIENTE');
        const dinero = refs('DINERO');
        const articulos = refs('CREDITO_ARTICULO');
        const errores = [...stock.errores, ...creditos.errores];
        const advertencias = [...stock.advertencias, ...creditos.advertencias];
        const filasPorResolver = filas.filter(f => f.estado !== 'PARA_VALIDAR').length;
        const cuadre = stock.resumen.totalFilas + creditos.resumen.totalFilas === filas.length;
        const puedeConfirmar = preparacion.modoIntegral === 'HISTORICO_PRUEBA' &&
          req.user.rol === RolUsuario.SUPER_ADMINISTRADOR && esEntornoHistoricoAislado() &&
          errores.length === 0 && filasPorResolver === 0 && cuadre && clientes.length + dinero.length + articulos.length > 0;
        res.json({ expediente: guardado.expediente, ...revision, vistaIntegral: {
          conteos: { inventario: inventario.length, clientes: clientes.length, dinero: dinero.length, articulos: articulos.length },
          totalErrores: errores.length, errores: errores.slice(0, 20),
          totalAdvertencias: advertencias.length, advertencias: advertencias.slice(0, 20), filasPorResolver, cuadre,
          ...(puedeConfirmar && { seleccion: { inventario, clientes, referencias: [...dinero, ...articulos] } }),
        } });
        return;
      }
      res.json({ expediente: guardado.expediente, ...revision });
      return;
    }
    const data = await generarConsolidadoHistorico(preparacion);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="consolidado-historico-revision.xlsx"');
    res.send(data);
  }


  @Get('historicos/expedientes')
  @Header('Cache-Control', 'no-store')
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.ADMIN)
  listarExpedientesHistoricos() {
    return this.expedientes.listar();
  }

  @Get('historicos/expedientes/:id')
  @Header('Cache-Control', 'no-store')
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.ADMIN)
  async obtenerExpedienteHistorico(@Param('id', ParseUUIDPipe) id: string) {
    const guardado = await this.expedientes.obtener(id);
    return { expediente: guardado.expediente, ...presentarRevisionHistorica(guardado.preparacion) };
  }

  @Get('historicos/expedientes/:id/revisiones')
  @Header('Cache-Control', 'no-store')
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.ADMIN)
  historialExpedienteHistorico(@Param('id', ParseUUIDPipe) id: string) {
    return this.expedientes.historial(id);
  }

  @Post('historicos/expedientes/:id/revisiones')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.ADMIN)
  async registrarRevisionHistorica(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { revision?: unknown; decisiones?: unknown },
    @Req() req: RequestConUsuario,
  ) {
    if (!req.user?.id) throw new UnauthorizedException();
    const guardado = await this.expedientes.guardar(id, body?.revision, body?.decisiones, req.user.id);
    return { expediente: guardado.expediente, ...presentarRevisionHistorica(guardado.preparacion) };
  }

  @Get('historicos/expedientes/:id/consolidado')
  @Header('Cache-Control', 'no-store')
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.ADMIN)
  async descargarExpedienteHistorico(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const { preparacion, expediente } = await this.expedientes.obtener(id);
    const prueba = await this.expedientes.evidenciaCarga(id, expediente.estado);
    const data = await generarConsolidadoHistorico(preparacion, prueba);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="consolidado-historico-revision.xlsx"');
    res.send(data);
  }


  @Post('historicos/expedientes/:id/confirmar-prueba')
  @HttpCode(200)
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.SUPER_ADMINISTRADOR)
  confirmarExpedienteDePrueba(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmacionPruebaHistorica,
    @Req() req: RequestConUsuario,
  ) {
    if (!req.user?.id) throw new UnauthorizedException();
    return this.cargaHistorica.confirmarPrueba(id, dto, req.user.id);
  }

  @Get('historicos/expedientes/:id/creditos-prueba')
  @Header('Cache-Control', 'no-store')
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.ADMIN)
  listarCreditosDePrueba(@Param('id', ParseUUIDPipe) id: string) {
    return this.cargaHistorica.listarCreditosDePrueba(id);
  }

  @Post('historicos/expedientes/:id/simular-abono')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.ADMIN)
  simularAbonoHistorico(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('prestamoId', ParseUUIDPipe) prestamoId: string,
    @Body('monto') monto: unknown,
  ) {
    return this.cargaHistorica.simularAbono(id, prestamoId, monto);
  }

  @Post('historicos/expedientes/:id/revertir-prueba')
  @HttpCode(200)
  @UseGuards(RolesGuard)
  @Roles(RolUsuario.SUPER_ADMINISTRADOR)
  revertirExpedienteDePrueba(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestConUsuario) {
    if (!req.user?.id) throw new UnauthorizedException();
    return this.cargaHistorica.revertirPrueba(id, req.user.id);
  }

  @Post('clientes-creditos/validar')
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.ADMIN)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async validarClientesCreditos(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    this.assertXlsxFile(file);
    return this.importacionesService.validarClientesCreditos(file);
  }

  @Post('inventario/validar')
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.ADMIN)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async validarInventario(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    this.assertXlsxFile(file);
    return this.importacionesService.validarInventario(file);
  }

  @Post('inventario/confirmar')
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.ADMIN)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async confirmarInventario(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
        ],
      }),
    )
    file: Express.Multer.File,
    @Req() req: RequestConUsuario,
  ) {
    this.assertXlsxFile(file);
    const creadoPorId: string = req.user?.id;
    if (!creadoPorId) {
      throw new BadRequestException(
        'No se pudo identificar el usuario autenticado.',
      );
    }
    return this.importacionesService.confirmarInventario(file, creadoPorId);
  }

  @Post('clientes-creditos/confirmar')
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.ADMIN)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async confirmarClientesCreditos(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
        ],
      }),
    )
    file: Express.Multer.File,
    @Req() req: RequestConUsuario,
  ) {
    this.assertXlsxFile(file);
    const creadoPorId: string = req.user?.id;
    if (!creadoPorId) {
      throw new BadRequestException(
        'No se pudo identificar el usuario autenticado.',
      );
    }
    return this.importacionesService.confirmarClientesCreditos(
      file,
      creadoPorId,
    );
  }
}
