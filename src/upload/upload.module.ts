import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { CloudinaryService } from './cloudinary.service';

@Module({
  controllers: [UploadController],
  providers:   [CloudinaryService],
  exports:     [CloudinaryService], // Exportado para ser usado en PaymentsModule, etc.
})
export class UploadModule {}
