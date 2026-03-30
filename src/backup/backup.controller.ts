import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BackupService } from './backup.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermisosGuard } from '../auth/guards/permisos.guard';
import { Permisos } from '../auth/decorators/permisos.decorator';

@Controller('backup')
@UseGuards(JwtAuthGuard, PermisosGuard)
@Permisos('backups')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Get('status')
  status() {
    return this.backupService.getStatus();
  }

  @Get('history')
  history(@Query('limit') limit?: string) {
    return this.backupService.getHistory(limit ? Number(limit) : undefined);
  }

  @Post('run')
  run() {
    return this.backupService.runManualBackup();
  }
}
