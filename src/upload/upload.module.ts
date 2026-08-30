import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { CloudinaryService } from './cloudinary.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [UploadController],
  providers: [CloudinaryService],
  exports: [CloudinaryService], // Exportado para ser usado en PaymentsModule, etc.
})
export class UploadModule {}
