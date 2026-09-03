import { Module } from '@nestjs/common';
import { ArchivadosController } from './archivados.controller';
import { ArchivadosService } from './archivados.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ArchivadosController],
  providers: [ArchivadosService],
})
export class ArchivadosModule {}
