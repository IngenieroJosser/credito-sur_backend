import {
  Request,
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
import { basename } from 'path';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '@prisma/client';
import { CloudinaryService } from './cloudinary.service';
import { PrismaService } from '../prisma/prisma.service';

// ─── Tipos de archivos permitidos ─────────────────────────────────────────────
const EXTENSIONES_PERMITIDAS = /\.(jpg|jpeg|png|gif|mp4|webm|pdf)$/i;
const TAMANO_MAX_BYTES = 50 * 1024 * 1024; // 50 MB

function contenidoPermitido(file: Express.Multer.File): boolean {
  const header = file.buffer.subarray(0, 12);
  const hex = header.toString('hex').toLowerCase();
  const mime = file.mimetype.toLowerCase();

  if (mime === 'application/pdf') return hex.startsWith('255044462d');
  if (mime === 'image/png') return hex.startsWith('89504e470d0a1a0a');
  if (mime === 'image/jpeg') return hex.startsWith('ffd8ff');
  if (mime === 'image/gif') return header.toString('ascii', 0, 6).startsWith('GIF8');
  if (mime === 'video/mp4') return hex.includes('66747970');
  if (mime === 'video/webm') return hex.startsWith('1a45dfa3');
  return false;
}

@ApiTags('Uploads')
@Controller('uploads')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UploadController {
  constructor(
    private readonly cloudinaryService: CloudinaryService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Roles(
    RolUsuario.SUPER_ADMINISTRADOR,
    RolUsuario.ADMIN,
    RolUsuario.COORDINADOR,
    RolUsuario.SUPERVISOR,
    RolUsuario.COBRADOR,
  )
  @ApiOperation({
    summary: 'Subir un archivo (imagen, video o PDF) a Cloudinary',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        clienteId: { type: 'string' },
        dni: { type: 'string' },
        nombres: { type: 'string' },
        apellidos: { type: 'string' },
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
            new BadRequestException(
              'Solo se permiten archivos de imagen, video o PDF',
            ),
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
      clienteId?: string;
      dni?: string;
      nombres?: string;
      apellidos?: string;
      tipoContenido?: string;
    },
  ) {
    if (!file) throw new BadRequestException('El archivo es requerido');
    if (!contenidoPermitido(file)) {
      throw new BadRequestException('El contenido del archivo no coincide con su tipo');
    }

    // Construir sub-carpeta según el tipo de contenido y datos del cliente
    const sanitize = (v?: string) =>
      (v || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 60);

    const nombres = sanitize(body?.nombres);
    const apellidos = sanitize(body?.apellidos);
    const dni = (body?.dni || '').replace(/\D/g, '');
    const dniLast4 = dni ? dni.slice(-4) : '';
    const clientPart = body?.clienteId
      ? body.clienteId
      : dni
        ? `cc-${dni}`
        : 'tmp';
    const clientLabel = [clientPart, nombres, apellidos, dniLast4]
      .filter(Boolean)
      .join('-');

    const groupFolder =
      body?.tipoContenido === 'FOTO_PERFIL'
        ? 'perfil'
        : file.mimetype.startsWith('video/')
          ? 'videos'
          : 'documentos';

    const result = await this.cloudinaryService.subirArchivo(file, {
      folder: `clientes/${clientLabel}/${groupFolder}`,
    });

    return {
      filename: result.publicId,
      originalName: file.originalname,
      publicId: result.publicId,
      path: result.url,
      mimetype: file.mimetype,
      size: result.tamanoBytes,
    };
  }

  @Get(':filename')
  @ApiOperation({ summary: 'Obtener un archivo subido localmente' })
  async serveFile(
    @Param('filename') filename: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const safeFilename = basename(filename);
    if (
      safeFilename !== filename ||
      safeFilename === '.' ||
      safeFilename === '..'
    ) {
      return res.status(400).json({ message: 'Nombre de archivo inválido' });
    }

    // Antes cualquier usuario autenticado servía cualquier fichero de
    // ./uploads por nombre (IDOR sobre documentos de clientes). Ahora el
    // fichero debe existir en Multimedia y el usuario debe poder ver a quién
    // pertenece.
    const media = await this.prisma.multimedia.findFirst({
      where: {
        OR: [
          { nombreAlmacenamiento: filename },
          { url: { contains: filename } },
          { ruta: { contains: filename } },
        ],
      },
      select: { clienteId: true, usuarioId: true, esPublico: true },
    });

    // No servir ficheros locales que no estén registrados: evita enumerar
    // el directorio ./uploads.
    if (!media) {
      return res.status(404).json({ message: 'Archivo no encontrado' });
    }

    const actor = req.user || {};
    const rol = String(actor.rol || '').toUpperCase();
    const rolesAmplios = [
      RolUsuario.SUPER_ADMINISTRADOR,
      RolUsuario.ADMIN,
      RolUsuario.COORDINADOR,
      RolUsuario.CONTADOR,
      RolUsuario.PUNTO_DE_VENTA,
    ];

    let permitido =
      media.esPublico ||
      rolesAmplios.includes(rol as any) ||
      (media.usuarioId && media.usuarioId === actor.id);

    if (!permitido && media.clienteId) {
      const scope =
        rol === RolUsuario.SUPERVISOR
          ? { asignacionesRuta: { some: { activa: true, ruta: { supervisorId: actor.id } } } }
          : rol === RolUsuario.COBRADOR
            ? {
                asignacionesRuta: {
                  some: {
                    activa: true,
                    OR: [
                      { cobradorId: actor.id },
                      { ruta: { cobradorId: actor.id } },
                    ],
                  },
                },
              }
            : null;
      if (scope) {
        const cliente = await this.prisma.cliente.findFirst({
          where: { id: media.clienteId, ...(scope as any) },
          select: { id: true },
        });
        permitido = !!cliente;
      }
    }

    if (!permitido) {
      // 404 en vez de 403 para no confirmar la existencia del fichero.
      return res.status(404).json({ message: 'Archivo no encontrado' });
    }

    res.sendFile(safeFilename, { root: './uploads' });
  }
}
