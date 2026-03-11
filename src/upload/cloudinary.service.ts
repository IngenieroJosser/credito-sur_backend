/**
 * ============================================================================
 * CloudinaryService
 * ============================================================================
 * Servicio centralizado para subir archivos a Cloudinary.
 * Evita duplicar la lógica entre upload.controller.ts y payments.service.ts.
 *
 * Uso:
 *   const result = await this.cloudinaryService.subirArchivo(file, { folder, tipoContenido });
 */

import { Injectable, BadRequestException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

export interface CloudinaryUploadOptions {
  /** Subcarpeta dentro del root de Cloudinary (ej: 'pagos/comprobantes') */
  folder?: string;
  /** Descripción para el nombre de carpeta cuando no se conoce el cliente */
  referencia?: string;
}

export interface CloudinaryUploadResult {
  publicId: string;
  url: string;
  formato: string;
  tamanoBytes: number;
}

@Injectable()
export class CloudinaryService {
  private configurado = false;

  private configurar(): void {
    if (this.configurado) return;

    const cloudName  = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey     = process.env.CLOUDINARY_API_KEY;
    const apiSecret  = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      throw new BadRequestException(
        'Cloudinary no está configurado. Verifique las variables de entorno: ' +
        'CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET',
      );
    }

    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
    this.configurado = true;
  }

  /**
   * Sube un archivo a Cloudinary y retorna la URL pública y el publicId.
   */
  async subirArchivo(
    file: Express.Multer.File,
    options: CloudinaryUploadOptions = {},
  ): Promise<CloudinaryUploadResult> {
    this.configurar();

    const isHostedProd = process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER);
    const rootFolder   = process.env.CLOUDINARY_ROOT_FOLDER || (isHostedProd ? 'creditos-del-sur' : 'creditos-del-sur-local');
    const subFolder    = options.folder || 'general';
    const folder       = `${rootFolder}/${subFolder}`;

    const resourceType = file.mimetype.startsWith('video/') ? 'video' : 'auto';

    const uploadResult: any = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: resourceType },
        (error, result) => {
          if (error) return reject(new BadRequestException(`Error al subir archivo a Cloudinary: ${error.message}`));
          resolve(result);
        },
      );
      stream.end(file.buffer);
    });

    return {
      publicId:    uploadResult.public_id,
      url:         uploadResult.secure_url,
      formato:     uploadResult.format || file.mimetype.split('/')[1] || 'bin',
      tamanoBytes: uploadResult.bytes || file.size,
    };
  }

  /**
   * Elimina un archivo de Cloudinary por su publicId.
   */
  async eliminarArchivo(publicId: string): Promise<void> {
    this.configurar();
    await cloudinary.uploader.destroy(publicId);
  }
}
