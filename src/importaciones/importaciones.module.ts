import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ImportacionesController } from './importaciones.controller';
import { ImportacionesService } from './importaciones.service';
import { AccountingModule } from '../accounting/accounting.module';

@Module({
  imports: [PrismaModule, AccountingModule],
  controllers: [ImportacionesController],
  providers: [ImportacionesService],
})
export class ImportacionesModule {}
