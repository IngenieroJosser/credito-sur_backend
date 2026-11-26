import { Module } from '@nestjs/common';
import { ArchivadosController } from './archivados.controller';
import { ArchivadosService } from './archivados.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [ArchivadosController],
  providers: [ArchivadosService],
})
export class ArchivadosModule {}
