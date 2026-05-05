import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { BackupExcelService } from './backup-excel.service';
import { formatBogotaOffsetIso } from '../utils/date-utils';

const execFileAsync = promisify(execFile);

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly backupExcelService: BackupExcelService,
  ) {}

  private getBackupDir(): string {
    return process.env.BACKUP_DIR || join(process.cwd(), 'backups');
  }

  private getPgDumpPath(): string {
    return process.env.PG_DUMP_PATH || 'pg_dump';
  }

  private buildBackupFilePath(runId: string): string {
    const iso = formatBogotaOffsetIso(new Date()).replace(/[:.]/g, '-');
    return join(this.getBackupDir(), `backup_${iso}_${runId}.dump`);
  }

  private buildExcelFilePath(runId: string): string {
    const iso = formatBogotaOffsetIso(new Date()).replace(/[:.]/g, '-');
    return join(this.getBackupDir(), `backup_${iso}_${runId}.xlsx`);
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

  async getArtifactPath(id: string, type: 'dump' | 'xlsx') {
    const run = await (this.prisma as any).backupRun.findUnique({
      where: { id },
    });

    if (!run) {
      throw new NotFoundException('Backup no encontrado');
    }

    const baseDir = this.getBackupDir();
    const artifacts = run?.metadata?.artifacts as any | undefined;

    const dumpPath = artifacts?.dump?.path || run?.filePath;
    const xlsxPath = artifacts?.xlsx?.path;

    const path = type === 'dump' ? dumpPath : xlsxPath;
    if (!path) {
      throw new NotFoundException('Artefacto no disponible para este backup');
    }

    return {
      path: String(path),
      baseDir,
      contentType:
        type === 'xlsx'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'application/octet-stream',
    };
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

    const excelPath = this.buildExcelFilePath(run.id);
    await this.ensureDir(dirname(excelPath));

    try {
      const startedMs = Date.now();

      const dumpStartedMs = Date.now();
      let dumpInfo: { path: string; size: number; elapsedMs: number } | null = null;
      let dumpError: { message: string; hint?: string } | null = null;

      try {
        const args = ['--format=c', '--file', filePath, process.env.DATABASE_URL];
        await execFileAsync(this.getPgDumpPath(), args, {
          timeout: 15 * 60 * 1000,
          maxBuffer: 1024 * 1024,
        });
        const info = await stat(filePath);
        dumpInfo = {
          path: filePath,
          size: Number(info.size),
          elapsedMs: Date.now() - dumpStartedMs,
        };
      } catch (err: any) {
        const message = err?.message ? String(err.message) : 'Error ejecutando pg_dump';
        const isPgDumpNotFound = err?.code === 'ENOENT';
        const hint =
          isPgDumpNotFound
            ? `No se encontró pg_dump. Instala PostgreSQL client tools o configura PG_DUMP_PATH (actual: ${this.getPgDumpPath()}).`
            : undefined;
        dumpError = { message, hint };
        this.logger.warn(`[backup] dump falló: ${hint ? `${hint} ` : ''}${message}`);
      }

      const excelStartedMs = Date.now();
      const excel = await this.backupExcelService.exportSnapshotToXlsx(excelPath);

      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();

      // El backup es EXITOSO si el Excel se generó. El dump SQL es opcional:
      // si pg_dump no está instalado se registra como advertencia pero no falla.
      const excelOk = !!excel;
      const updated = await (this.prisma as any).backupRun.update({
        where: { id: run.id },
        data: {
          estado: excelOk ? 'EXITOSO' : 'FALLIDO',
          filePath: dumpInfo?.path || null,
          fileSize: dumpInfo?.size || null,
          finishedAt,
          durationMs,
          error: excelOk
            ? (dumpError
                ? `[pg_dump no disponible] ${dumpError.hint ?? dumpError.message}`
                : null)
            : 'Backup fallido: no se pudo generar el Excel',
          metadata: {
            pgDumpPath: this.getPgDumpPath(),
            backupDir: this.getBackupDir(),
            elapsedMs: Date.now() - startedMs,
            artifacts: {
              dump: dumpInfo
                ? {
                    path: dumpInfo.path,
                    size: dumpInfo.size,
                    elapsedMs: dumpInfo.elapsedMs,
                  }
                : {
                    skipped: true,
                    reason: dumpError?.hint
                      ? `${dumpError.hint} ${dumpError.message}`
                      : dumpError?.message || 'pg_dump no ejecutado',
                  },
              xlsx: {
                path: excel.filePath,
                size: excel.fileSize,
                sheets: excel.sheets,
                elapsedMs: Date.now() - excelStartedMs,
              },
            },
          },
        },
      });

      return updated;
    } catch (err: any) {
      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();
      const message = err?.message ? String(err.message) : 'Error ejecutando pg_dump';

      const isPgDumpNotFound = err?.code === 'ENOENT';
      const hint =
        isPgDumpNotFound
          ? `No se encontró pg_dump. Instala PostgreSQL client tools o configura PG_DUMP_PATH (actual: ${this.getPgDumpPath()}).`
          : undefined;

      this.logger.warn(`[backup] fallo backup manual: ${hint ? `${hint} ` : ''}${message}`);

      await (this.prisma as any).backupRun.update({
        where: { id: run.id },
        data: {
          estado: 'FALLIDO',
          filePath,
          finishedAt,
          durationMs,
          error: hint ? `${hint} ${message}` : message,
          metadata: {
            pgDumpPath: this.getPgDumpPath(),
            backupDir: this.getBackupDir(),
            artifacts: {
              dump: { path: filePath },
              xlsx: { path: excelPath },
            },
          },
        },
      });

      if (isPgDumpNotFound) {
        throw new BadRequestException(
          hint ||
            `No se encontró pg_dump. Instala PostgreSQL client tools o configura PG_DUMP_PATH (actual: ${this.getPgDumpPath()}).`,
        );
      }

      throw new InternalServerErrorException('No se pudo ejecutar el backup (pg_dump)');
    }
  }
}
