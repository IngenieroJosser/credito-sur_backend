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
import { SalesModule } from './sales/sales.module';
import { RoutesModule } from './routes/routes.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { InventoryModule } from './inventory/inventory.module';
import { AccountingModule } from './accounting/accounting.module';
import { ReportsModule } from './reports/reports.module';
import { AuditModule } from './audit/audit.module';
import { BackupModule } from './backup/backup.module';
import { PrismaModule } from './prisma/prisma.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { IntegrityModule } from './accounting/integrity.module';
import { UploadModule } from './upload/upload.module';
import { CategoriasModule } from './categorias/categorias.module';
import { PushModule } from './push/push.module';
import { ConfiguracionModule } from './configuracion/configuracion.module';
import { CajasModule } from './cajas/cajas.module';
import { SyncConflictsModule } from './sync-conflicts/sync-conflicts.module';
import { MirrorModule } from './mirror/mirror.module';
import { OutboxModule } from './outbox/outbox.module';
import { AlertasClientesModule } from './alertas-clientes/alertas-clientes.module';
import { ImportacionesModule } from './importaciones/importaciones.module';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { HealthController } from './health.controller';
import { ArchivadosModule } from './archivados/archivados.module';

/*
 * La replica al espejo ya no necesita Redis, asi que tampoco necesita un
 * interruptor que decida si se monta el modulo.
 *
 * Aqui habia un `shouldEnableMirrorSync` que exigia MIRROR_SYNC_ENABLED, la
 * URL del VPS y el token para montar `MirrorSyncModule`. Eso dejaba fuera
 * tambien el CONTROLADOR que RECIBE: para que el espejo pudiera recibir habia
 * que encenderle la replica a el tambien, que es lo contrario de lo que tiene
 * que hacer. `MirrorModule` se monta siempre: el receptor se protege con su
 * firma HMAC y el que envia se queda quieto si no hay a donde.
 */

@Module({
  imports: [
    ArchivadosModule,
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
    SalesModule,
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
    CajasModule,
    SyncConflictsModule,
    IntegrityModule,
    OutboxModule,
    AlertasClientesModule,
    ImportacionesModule,
    EventEmitterModule.forRoot(),
    MirrorModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
  ],
})
export class AppModule {}
