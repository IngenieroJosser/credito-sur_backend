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
import { v2 as cloudinary } from 'cloudinary';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '@prisma/client';

@ApiTags('Uploads')
@Controller('uploads')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UploadController {
  @Post()
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
  )
  @ApiOperation({ summary: 'Subir un archivo (imagen o video)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        clienteId: {
          type: 'string',
        },
        dni: {
          type: 'string',
        },
        nombres: {
          type: 'string',
        },
        apellidos: {
          type: 'string',
        },
        tipoContenido: {
          type: 'string',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif|mp4|webm|pdf)$/)) {
          return cb(
            new BadRequestException(
              'Solo se permiten archivos de imagen, video o PDF',
            ),
            false,
          );
        }
        cb(null, true);
      },
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
      },
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body()
    body: {
      clienteId?: string;
      dni?: string;
      nombres?: string;
      apellidos?: string;
      tipoContenido?: string;
    },
  ) {
    if (!file) {
      throw new BadRequestException('El archivo es requerido');
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      throw new BadRequestException(
        'Cloudinary no está configurado (CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET)',
      );
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });

    const sanitizeSlug = (value?: string) => {
      if (!value) return '';
      return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 60);
    };

    const nombres = sanitizeSlug(body?.nombres);
    const apellidos = sanitizeSlug(body?.apellidos);
    const nombreSlug = [nombres, apellidos].filter(Boolean).join('-');
    const dni = (body?.dni || '').replace(/\D/g, '');
    const dniLast4 = dni ? dni.slice(-4) : '';

    const clientPart = body?.clienteId
      ? body.clienteId
      : dni
        ? `cc-${dni}`
        : 'tmp';

    const clientLabel = [clientPart, nombreSlug, dniLast4].filter(Boolean).join('-');

    const groupFolder =
      body?.tipoContenido === 'FOTO_PERFIL'
        ? 'perfil'
        : file.mimetype.startsWith('video/')
          ? 'videos'
          : 'documentos';

    const isHostedProd =
      process.env.NODE_ENV === 'production' ||
      Boolean(process.env.RENDER);

    const rootFolder =
      process.env.CLOUDINARY_ROOT_FOLDER ||
      (isHostedProd ? 'creditos-del-sur' : 'creditos-del-sur-local');

    const folder = `${rootFolder}/clientes/${clientLabel}/${groupFolder}`;
    const resourceType = file.mimetype.startsWith('video/') ? 'video' : 'auto';

    const uploadResult: any = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: resourceType,
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        },
      );

      stream.end(file.buffer);
    });

    return {
      filename: uploadResult.public_id,
      originalName: file.originalname,
      publicId: uploadResult.public_id,
      path: uploadResult.secure_url,
      mimetype: file.mimetype,
      size: file.size,
    };
  }

  @Get(':filename')
  @ApiOperation({ summary: 'Obtener un archivo subido' })
  serveFile(@Param('filename') filename: string, @Res() res: Response) {
    res.sendFile(filename, { root: './uploads' });
  }
}
