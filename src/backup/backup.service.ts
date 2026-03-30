import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const execFileAsync = promisify(execFile);

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(private readonly prisma: PrismaService) {}

  private getBackupDir(): string {
    return process.env.BACKUP_DIR || join(process.cwd(), 'backups');
  }

  private getPgDumpPath(): string {
    return process.env.PG_DUMP_PATH || 'pg_dump';
  }

  private buildBackupFilePath(runId: string): string {
    const iso = new Date().toISOString().replace(/[:.]/g, '-');
    return join(this.getBackupDir(), `backup_${iso}_${runId}.dump`);
  }

  private async ensureDir(path: string) {
    await mkdir(path, { recursive: true });
  }

  async getStatus() {
    const last = await (this.prisma as any).backupRun.findFirst({
      orderBy: { startedAt: 'desc' },
    });

    return {
      config: {
        enabled: !!process.env.DATABASE_URL,
        backupDir: this.getBackupDir(),
        pgDumpPath: this.getPgDumpPath(),
      },
      lastRun: last,
    };
  }

  async getHistory(limit = 20) {
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    const items = await (this.prisma as any).backupRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: safeLimit,
    });
    return { items };
  }

  async runManualBackup() {
    if (!process.env.DATABASE_URL) {
      throw new BadRequestException('DATABASE_URL no está configurada');
    }

    const running = await (this.prisma as any).backupRun.findFirst({
      where: { estado: 'EN_PROCESO' },
      orderBy: { startedAt: 'desc' },
    });

    if (running) {
      throw new ConflictException('Ya hay un backup en ejecución');
    }

    const startedAt = new Date();
    const run = await (this.prisma as any).backupRun.create({
      data: {
        tipo: 'MANUAL',
        destino: 'LOCAL',
        estado: 'EN_PROCESO',
        startedAt,
      },
    });

    const filePath = this.buildBackupFilePath(run.id);
    await this.ensureDir(dirname(filePath));

    try {
      const args = ['--format=c', '--file', filePath, process.env.DATABASE_URL];
      const startedMs = Date.now();
      await execFileAsync(this.getPgDumpPath(), args, {
        timeout: 15 * 60 * 1000,
        maxBuffer: 1024 * 1024,
      });

      const info = await stat(filePath);
      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();

      const updated = await (this.prisma as any).backupRun.update({
        where: { id: run.id },
        data: {
          estado: 'EXITOSO',
          filePath,
          fileSize: Number(info.size),
          finishedAt,
          durationMs,
          metadata: {
            pgDumpPath: this.getPgDumpPath(),
            backupDir: this.getBackupDir(),
            elapsedMs: Date.now() - startedMs,
          },
        },
      });

      return updated;
    } catch (err: any) {
      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();
      const message = err?.message ? String(err.message) : 'Error ejecutando pg_dump';

      this.logger.warn(`[backup] fallo backup manual: ${message}`);

      await (this.prisma as any).backupRun.update({
        where: { id: run.id },
        data: {
          estado: 'FALLIDO',
          filePath,
          finishedAt,
          durationMs,
          error: message,
          metadata: {
            pgDumpPath: this.getPgDumpPath(),
            backupDir: this.getBackupDir(),
          },
        },
      });

      throw new InternalServerErrorException('No se pudo ejecutar el backup (pg_dump)');
    }
  }
}
