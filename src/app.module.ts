import { Module } from '@nestjs/common';
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
import { PrismaModule } from 'prisma/prisma.module';

@Module({
  imports: [
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
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
