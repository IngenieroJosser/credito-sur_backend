import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService, type TransaccionPrisma } from '../../prisma/prisma.service';
import { prepararFilasHistoricas, type PreparacionHistorica } from './preparar-historicos';

export const resumenExpediente = {
  id: true, estado: true, revision: true, actualizadoEn: true, creadoEn: true,
  huellaCartera: true, huellaInventario: true, preparador: true, esquema: true, reglas: true,
  creadoPorId: true,
} satisfies Prisma.ExpedienteHistoricoSelect;

export function jsonExpediente(valor: object): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(valor)) as Prisma.InputJsonObject;
}

function restaurarResultado(resultado: Prisma.JsonValue): PreparacionHistorica {
  // Solo se lee el contenido serializado por este servicio, no JSON arbitrario del API.
  return resultado as unknown as PreparacionHistorica;
}

@Injectable()
export class ExpedienteHistoricoService {
  constructor(private readonly prisma: PrismaService) {}

  listar() {
    return this.prisma.expedienteHistorico.findMany({
      orderBy: [{ actualizadoEn: 'desc' }, { id: 'asc' }], take: 50, select: resumenExpediente,
    });
  }

  async obtener(id: string, db: TransaccionPrisma = this.prisma) {
    const expediente = await db.expedienteHistorico.findUnique({ where: { id }, select: resumenExpediente });
    if (!expediente) throw new NotFoundException('Expediente histórico no encontrado.');
    const revision = await db.revisionExpedienteHistorico.findUniqueOrThrow({
      where: { expedienteId_numero: { expedienteId: id, numero: expediente.revision } },
    });
    return { expediente, preparacion: restaurarResultado(revision.resultado) };
  }

  async evidenciaCarga(id: string, estado: string) {
    const carga = await this.prisma.cargaExpedienteHistorico.findFirst({
      where: { expedienteId: id }, select: { loteId: true, creadaEn: true, loteInventarioId: true, resultado: true },
    });
    if (!carga) return undefined;
    const asociaciones = await this.prisma.referenciaExpedienteHistorico.findMany({
      where: { expedienteId: id }, orderBy: { referencia: 'asc' },
      select: { referencia: true, entidad: true, entidadId: true },
    });
    return { expedienteId: id, estado, loteId: carga.loteId, confirmadaEn: carga.creadaEn, asociaciones,
      loteInventarioId: carga.loteInventarioId, resultado: carga.resultado };
  }

  historial(id: string) {
    return this.prisma.revisionExpedienteHistorico.findMany({
      where: { expedienteId: id }, orderBy: { numero: 'desc' }, take: 100,
      select: { numero: true, usuarioId: true, creadaEn: true, huella: true },
    });
  }

  async abrir(preparacion: PreparacionHistorica, usuarioId: string) {
    // Un archivo JSON externo es un respaldo, no una aprobación registrada.
    const base = prepararFilasHistoricas(this.fuentesPersistidas(preparacion));
    const llave = {
      huellaCartera: base.fuentes.cartera.sha256, huellaInventario: base.fuentes.inventario.sha256,
      ...base.versiones,
    };
    const where = { huellaCartera_huellaInventario_preparador_esquema_reglas: llave };
    try {
      const expediente = await this.prisma.expedienteHistorico.upsert({
        where, update: {},
        create: {
          ...llave, creadoPorId: usuarioId,
          revisiones: { create: { numero: 1, huella: base.huellaDecisiones, resultado: jsonExpediente(base), usuarioId } },
        },
        select: { id: true },
      });
      return this.obtener(expediente.id);
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      const existente = await this.prisma.expedienteHistorico.findUniqueOrThrow({ where, select: { id: true } });
      return this.obtener(existente.id);
    }
  }

  async guardar(id: string, revision: unknown, decisiones: unknown, usuarioId: string) {
    if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 1 ||
      !decisiones || typeof decisiones !== 'object' || Array.isArray(decisiones)) {
      throw new BadRequestException('Indique la revisión vigente y las decisiones con evidencia.');
    }
    const actual = await this.obtener(id);
    if (actual.expediente.revision !== revision || actual.expediente.estado !== 'EN_REVISION') {
      throw new ConflictException('El expediente cambió; vuelva a abrirlo antes de registrar decisiones.');
    }
    let preparada: PreparacionHistorica;
    try {
      preparada = prepararFilasHistoricas(this.fuentesPersistidas(actual.preparacion), {
        ...decisiones, responsable: usuarioId, aprobadasEn: new Date().toISOString(),
      });
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'No se pudieron aplicar las decisiones.');
    }
    await this.prisma.$transaction(async (tx) => {
      const reclamo = await tx.expedienteHistorico.updateMany({
        where: { id, revision, estado: 'EN_REVISION' }, data: { revision: { increment: 1 } },
      });
      if (reclamo.count !== 1) throw new ConflictException('Hay una revisión más reciente.');
      await tx.revisionExpedienteHistorico.create({
        data: { expedienteId: id, numero: revision + 1, huella: preparada.huellaDecisiones,
          resultado: jsonExpediente(preparada), usuarioId },
      });
    });
    return this.obtener(id);
  }

  private fuentesPersistidas(p: PreparacionHistorica) {
    return {
      fuentes: p.fuentes,
      filas: p.filas.map(({ referencia, tipo, fuente, hoja, fila, originales, campos, evidencia }) => ({
        referencia, tipo, fuente, hoja, fila, originales, campos, evidencia,
      })),
    };
  }
}
