import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { ClientsModule } from './clients/clients.module';
import { LoansModule } from './loans/loans.module';
import { PaymentsModule } from './payments/payments.module';
import { RoutesModule } from './routes/routes.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { InventoryModule } from './inventory/inventory.module';
import { AccountingModule } from './accounting/accounting.module';
import { ReportsModule } from './reports/reports.module';
import { AuditModule } from './audit/audit.module';
import { BackupModule } from './backup/backup.module';
import { PrismaModule } from './prisma/prisma.module'; 
import { DashboardModule } from './dashboard/dashboard.module';
import { UploadModule } from './upload/upload.module';
import { CategoriasModule } from './categorias/categorias.module';
import { PushModule } from './push/push.module';
import { ConfiguracionModule } from './configuracion/configuracion.module';
import { SyncConflictsModule } from './sync-conflicts/sync-conflicts.module';
import { MirrorSyncModule } from './mirror-sync/mirror-sync.module';
import { BullModule } from '@nestjs/bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';

const shouldEnableMirrorSync =
  process.env.MIRROR_SYNC_ENABLED === 'true' &&
  Boolean(process.env.MIRROR_VPS_URL) &&
  Boolean(process.env.MIRROR_SYNC_TOKEN);

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    ClientsModule,
    LoansModule,
    PaymentsModule,
    RoutesModule,
    ApprovalsModule,
    InventoryModule,
    AccountingModule,
    ReportsModule,
    AuditModule,
    BackupModule,
    PrismaModule,
    DashboardModule,
    UploadModule,
    CategoriasModule,
    PushModule,
    ConfiguracionModule,
    SyncConflictsModule,
    EventEmitterModule.forRoot(),
    ...(shouldEnableMirrorSync
      ? [
          BullModule.forRoot({
            connection: {
              host: process.env.REDIS_HOST || 'localhost',
              port: parseInt(process.env.REDIS_PORT || '6379'),
              username: process.env.REDIS_USERNAME || undefined,
              password: process.env.REDIS_PASSWORD || undefined,
              tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
            },
          }),
          MirrorSyncModule,
        ]
      : []),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
