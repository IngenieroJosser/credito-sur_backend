import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { objetoDeJson } from '../common/json.util';
import { codigoDeError, mensajeDeError } from '../common/error.util';
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

  /**
   * Lo que se sabe de `pg_dump` en ESTA maquina, averiguado una sola vez.
   *
   * Se cachea por proceso a proposito: el binario no puede aparecer ni
   * desaparecer sin un despliegue nuevo, y un despliegue arranca otro proceso.
   */
  private pgDump: {
    disponible: boolean;
    version: string | null;
    error: string | null;
  } | null = null;

  /**
   * ¿Esta `pg_dump` donde el servicio lo busca?
   *
   * ── Por que esto vive en la API ────────────────────────────────────────────
   *
   * Porque es la unica forma de averiguarlo. La consola (shell) de Render es de
   * pago, asi que nadie puede entrar a escribir `pg_dump --version`; y la otra
   * via era generar un respaldo entero -escribiendo un Excel y una fila en
   * `BackupRun`- solo para leer el mensaje de error. Esto lo contesta sin
   * escribir nada: ejecuta `--version`, que no toca la base de datos.
   *
   * Lo consulta `GET /backup/status`, que es lo que pide la pantalla de
   * respaldos al abrirse. Asi el dueño lo ve sin pedirle nada a nadie.
   */
  private async comprobarPgDump() {
    if (this.pgDump) return this.pgDump;

    try {
      const { stdout } = await execFileAsync(
        this.getPgDumpPath(),
        ['--version'],
        // Un tope corto: la pantalla espera esta respuesta. Si el binario no
        // esta, `execFile` falla con ENOENT en el acto; el tope es para el caso
        // raro de un ejecutable que se quede colgado.
        { timeout: 10_000 },
      );
      this.pgDump = {
        disponible: true,
        version: String(stdout).trim() || null,
        error: null,
      };
    } catch (err) {
      this.pgDump = {
        disponible: false,
        version: null,
        error:
          codigoDeError(err) === 'ENOENT'
            ? `No se encontró pg_dump en «${this.getPgDumpPath()}». El respaldo seguirá generando el Excel, pero NO el volcado SQL con el que se restaura la base. Se configura con la variable PG_DUMP_PATH.`
            : mensajeDeError(err, 'No se pudo ejecutar pg_dump'),
      };
    }

    return this.pgDump;
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
    const [last, pgDump] = await Promise.all([
      this.prisma.backupRun.findFirst({
        orderBy: { startedAt: 'desc' },
      }),
      this.comprobarPgDump(),
    ]);

    return {
      config: {
        enabled: !!process.env.DATABASE_URL,
        backupDir: this.getBackupDir(),
        pgDumpPath: this.getPgDumpPath(),
        /*
         * Si el volcado SQL se puede generar en ESTA maquina, comprobado de
         * verdad y no deducido de la variable de entorno. Sin esto la pantalla
         * solo podia decir «la ruta configurada es pg_dump», que no es lo
         * mismo que «pg_dump esta ahi».
         */
        pgDumpDisponible: pgDump.disponible,
        pgDumpVersion: pgDump.version,
        pgDumpError: pgDump.error,
      },
      lastRun: last,
    };
  }

  async getHistory(limit = 20) {
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    const items = await this.prisma.backupRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: safeLimit,
    });
    return { items };
  }

  async getArtifactPath(id: string, type: 'dump' | 'xlsx') {
    const run = await this.prisma.backupRun.findUnique({
      where: { id },
    });

    if (!run) {
      throw new NotFoundException('Backup no encontrado');
    }

    const baseDir = this.getBackupDir();
    // `metadata` es una columna Json: puede no ser un objeto.
    const artifacts = objetoDeJson(objetoDeJson(run?.metadata).artifacts) as {
      dump?: { path?: string };
      xlsx?: { path?: string };
    };

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

    const running = await this.prisma.backupRun.findFirst({
      where: { estado: 'EN_PROCESO' },
      orderBy: { startedAt: 'desc' },
    });

    if (running) {
      throw new ConflictException('Ya hay un backup en ejecución');
    }

    const startedAt = new Date();
    const run = await this.prisma.backupRun.create({
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
      let dumpInfo: { path: string; size: number; elapsedMs: number } | null =
        null;
      let dumpError: { message: string; hint?: string } | null = null;

      try {
        const args = [
          '--format=c',
          '--file',
          filePath,
          process.env.DATABASE_URL,
        ];
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
      } catch (err) {
        const message = mensajeDeError(err, 'Error ejecutando pg_dump');
        const isPgDumpNotFound = codigoDeError(err) === 'ENOENT';
        const hint = isPgDumpNotFound
          ? `No se encontró pg_dump. Instala PostgreSQL client tools o configura PG_DUMP_PATH (actual: ${this.getPgDumpPath()}).`
          : undefined;
        dumpError = { message, hint };
        this.logger.warn(
          `[backup] dump falló: ${hint ? `${hint} ` : ''}${message}`,
        );
      }

      const excelStartedMs = Date.now();
      const excel =
        await this.backupExcelService.exportSnapshotToXlsx(excelPath);

      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();

      // El backup es EXITOSO si el Excel se generó. El dump SQL es opcional:
      // si pg_dump no está instalado se registra como advertencia pero no falla.
      const excelOk = !!excel;
      const updated = await this.prisma.backupRun.update({
        where: { id: run.id },
        data: {
          estado: excelOk ? 'EXITOSO' : 'FALLIDO',
          filePath: dumpInfo?.path || null,
          fileSize: dumpInfo?.size || null,
          finishedAt,
          durationMs,
          error: excelOk
            ? dumpError
              ? `[pg_dump no disponible] ${dumpError.hint ?? dumpError.message}`
              : null
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
    } catch (err) {
      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();
      const message = mensajeDeError(err, 'Error ejecutando pg_dump');

      const isPgDumpNotFound = codigoDeError(err) === 'ENOENT';
      const hint = isPgDumpNotFound
        ? `No se encontró pg_dump. Instala PostgreSQL client tools o configura PG_DUMP_PATH (actual: ${this.getPgDumpPath()}).`
        : undefined;

      this.logger.warn(
        `[backup] fallo backup manual: ${hint ? `${hint} ` : ''}${message}`,
      );

      await this.prisma.backupRun.update({
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

      throw new InternalServerErrorException(
        'No se pudo ejecutar el backup (pg_dump)',
      );
    }
  }
}
