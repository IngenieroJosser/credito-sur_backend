import {
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  ParseFilePipe,
  MaxFileSizeValidator,
  BadRequestException,
  Req,
  Request,
  Body,
  UnauthorizedException,
} from '@nestjs/common';
import { ImportacionesService } from './importaciones.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { SWAGGER_JWT_AUTH } from '../auth/constants/swagger-auth.constants';

@ApiTags('Importaciones')
@ApiBearerAuth(SWAGGER_JWT_AUTH)
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('importaciones')
export class ImportacionesController {
  constructor(private readonly importacionesService: ImportacionesService) {}

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
   * Deshace una importación, entera o solo algunos de sus créditos.
   *
   * Solo el superadministrador. Deshacer devuelve plata a la caja y artículos
   * a la bodega, y borra créditos de clientes reales: no es una operación de
   * uso corriente aunque quien importó sea administrador.
   *
   * Sin `prestamoIds` se deshace todo el lote. Con la lista, solo esos.
   */
  @Post('lotes/:id/revertir')
  @Roles(RolUsuario.SUPER_ADMINISTRADOR)
  async revertirLote(
    @Request() req,
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

  @Get('plantilla/inventario')
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.ADMIN)
  async descargarPlantillaInventario(@Res() res: Response) {
    const { data, contentType, filename } =
      await this.importacionesService.generarPlantillaInventario();
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(data);
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
    @Req() req: any,
  ) {
    this.assertXlsxFile(file);
    const creadoPorId: string =
      req.user?.sub || req.user?.id || req.user?.userId;
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
    @Req() req: any,
  ) {
    this.assertXlsxFile(file);
    const creadoPorId: string =
      req.user?.sub || req.user?.id || req.user?.userId;
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
