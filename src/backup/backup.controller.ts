import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Res,
  BadRequestException,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { BackupService } from './backup.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermisosGuard } from '../auth/guards/permisos.guard';
import { Permisos } from '../auth/decorators/permisos.decorator';
import { Response } from 'express';
import { createReadStream, existsSync } from 'node:fs';
import { basename, resolve } from 'node:path';

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

  @Get(':id/download')
  async download(
    @Param('id') id: string,
    @Query('type') type: 'dump' | 'xlsx',
    @Res() res: Response,
  ) {
    if (type !== 'dump' && type !== 'xlsx') {
      throw new BadRequestException('type debe ser dump o xlsx');
    }

    const info = await this.backupService.getArtifactPath(id, type);
    const absPath = resolve(info.path);
    const baseDir = resolve(info.baseDir);
    if (!absPath.startsWith(baseDir)) {
      throw new BadRequestException('Ruta de archivo inválida');
    }

    if (!existsSync(absPath)) {
      throw new NotFoundException('Archivo no encontrado');
    }

    res.setHeader('Content-Type', info.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${basename(absPath)}"`,
    );
    createReadStream(absPath).pipe(res);
  }
}
