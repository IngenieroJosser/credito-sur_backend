import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { PrismaModule } from '../prisma/prisma.module'; 
import { RoutesModule } from '../routes/routes.module';

@Module({
  imports: [PrismaModule, RoutesModule],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
