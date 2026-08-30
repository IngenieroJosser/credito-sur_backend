import { Module } from '@nestjs/common';
import { SyncConflictsService } from './sync-conflicts.service';
import { SyncConflictsController } from './sync-conflicts.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { jwtConstants } from '../auth/constants';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    JwtModule.registerAsync({
      useFactory: () => ({ secret: jwtConstants.secret }),
    }),
  ],
  controllers: [SyncConflictsController],
  providers: [SyncConflictsService],
})
export class SyncConflictsModule {}
