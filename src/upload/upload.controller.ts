import {
  Controller,
  Post,
  Body,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Get,
  Param,
  Res,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '@prisma/client';
import { CloudinaryService } from './cloudinary.service';

// ─── Tipos de archivos permitidos ─────────────────────────────────────────────
const EXTENSIONES_PERMITIDAS = /\.(jpg|jpeg|png|gif|mp4|webm|pdf)$/i;
const TAMANO_MAX_BYTES        = 50 * 1024 * 1024; // 50 MB

@ApiTags('Uploads')
@Controller('uploads')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UploadController {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  @Post()
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
  )
  @ApiOperation({ summary: 'Subir un archivo (imagen, video o PDF) a Cloudinary' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file:          { type: 'string', format: 'binary' },
        clienteId:     { type: 'string' },
        dni:           { type: 'string' },
        nombres:       { type: 'string' },
        apellidos:     { type: 'string' },
        tipoContenido: { type: 'string' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: (_req, file, cb) => {
        if (!file.originalname.match(EXTENSIONES_PERMITIDAS)) {
          return cb(
            new BadRequestException('Solo se permiten archivos de imagen, video o PDF'),
            false,
          );
        }
        cb(null, true);
      },
      limits: { fileSize: TAMANO_MAX_BYTES },
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body()
    body: {
      clienteId?:     string;
      dni?:           string;
      nombres?:       string;
      apellidos?:     string;
      tipoContenido?: string;
    },
  ) {
    if (!file) throw new BadRequestException('El archivo es requerido');

    // Construir sub-carpeta según el tipo de contenido y datos del cliente
    const sanitize = (v?: string) =>
      (v || '').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);

    const nombres    = sanitize(body?.nombres);
    const apellidos  = sanitize(body?.apellidos);
    const dni        = (body?.dni || '').replace(/\D/g, '');
    const dniLast4   = dni ? dni.slice(-4) : '';
    const clientPart = body?.clienteId ? body.clienteId : dni ? `cc-${dni}` : 'tmp';
    const clientLabel = [clientPart, nombres, apellidos, dniLast4].filter(Boolean).join('-');

    const groupFolder =
      body?.tipoContenido === 'FOTO_PERFIL' ? 'perfil'
      : file.mimetype.startsWith('video/')  ? 'videos'
      : 'documentos';

    const result = await this.cloudinaryService.subirArchivo(file, {
      folder: `clientes/${clientLabel}/${groupFolder}`,
    });

    return {
      filename:     result.publicId,
      originalName: file.originalname,
      publicId:     result.publicId,
      path:         result.url,
      mimetype:     file.mimetype,
      size:         result.tamanoBytes,
    };
  }

  @Get(':filename')
  @ApiOperation({ summary: 'Obtener un archivo subido localmente' })
  serveFile(@Param('filename') filename: string, @Res() res: Response) {
    res.sendFile(filename, { root: './uploads' });
  }
}
