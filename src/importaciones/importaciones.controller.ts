import {
  Controller,
  Get,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  ParseFilePipe,
  MaxFileSizeValidator,
  BadRequestException,
  Req,
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

  @Get('plantilla/clientes-creditos')
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.ADMIN)
  async descargarPlantillaClientesCreditos(@Res() res: Response) {
    const { data, contentType, filename } = await this.importacionesService.generarPlantillaClientesCreditos();
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(data);
  }

  @Get('plantilla/inventario')
  @Roles(RolUsuario.SUPER_ADMINISTRADOR, RolUsuario.ADMIN)
  async descargarPlantillaInventario(@Res() res: Response) {
    const { data, contentType, filename } = await this.importacionesService.generarPlantillaInventario();
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
    ) file: Express.Multer.File,
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
    ) file: Express.Multer.File,
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
    ) file: Express.Multer.File,
    @Req() req: any,
  ) {
    this.assertXlsxFile(file);
    const creadoPorId: string = req.user?.sub || req.user?.id || req.user?.userId;
    if (!creadoPorId) {
      throw new BadRequestException('No se pudo identificar el usuario autenticado.');
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
    ) file: Express.Multer.File,
    @Req() req: any,
  ) {
    this.assertXlsxFile(file);
    const creadoPorId: string = req.user?.sub || req.user?.id || req.user?.userId;
    if (!creadoPorId) {
      throw new BadRequestException('No se pudo identificar el usuario autenticado.');
    }
    return this.importacionesService.confirmarClientesCreditos(file, creadoPorId);
  }
}
