import { Injectable, BadRequestException } from '@nestjs/common';
import {
  generarExcelAuditoria,
  generarPDFAuditoria,
  AuditoriaRow,
} from '../templates/exports/auditoria.template';
import { PrismaService } from '../prisma/prisma.service';
import { getBogotaDayKey } from '../utils/date-utils';
import { Prisma } from '@prisma/client';

/**
 * Los campos que cambiaron entre dos versiones de un registro.
 *
 * Devuelve  solo con lo que de verdad cambio: si
 * se guardaran todos los campos, el diff seria tan ilegible como comparar los
 * dos objetos enteros a mano, que es justo lo que se quiere evitar.
 *
 * La comparacion es por valor serializado, no por identidad: dos objetos con el
 * mismo contenido no cuentan como cambio. Es lo que hace falta aqui, donde los
 * valores vienen de columnas Json y llegan como estructuras nuevas en cada
 * lectura aunque el contenido sea identico.
 */
/** Un valor de columna Json que SI se puede comparar campo a campo. */
const esObjetoPlano = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function calcularCambios(
  anteriores?: unknown,
  nuevos?: unknown,
): Record<string, { antes: unknown; despues: unknown }> {
  // Una columna Json puede traer un texto o un numero, no solo un objeto: sin
  // esta comprobacion, `Object.keys` sobre una cadena devolveria sus indices.
  if (!esObjetoPlano(anteriores) || !esObjetoPlano(nuevos)) return {};

  const campos = new Set([...Object.keys(anteriores), ...Object.keys(nuevos)]);
  const cambios: Record<string, { antes: unknown; despues: unknown }> = {};

  for (const campo of campos) {
    const antes = anteriores[campo];
    const despues = nuevos[campo];
    if (JSON.stringify(antes) !== JSON.stringify(despues)) {
      cambios[campo] = { antes, despues };
    }
  }

  return cambios;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    usuarioId: string;
    accion: string;
    entidad: string;
    entidadId: string;
    // Las tres son columnas `Json` de `registroAuditoria`: el tipo que Prisma acepta
    // para escribirlas es `InputJsonValue`, no `any`.
    // Las dos son columnas `Json`. `Record<string, unknown>` en la union porque varios
    // llamadores pasan objetos armados a mano, no un `InputJsonValue` estricto.
    datosAnteriores?: Prisma.InputJsonValue | Record<string, unknown>;
    datosNuevos?: Prisma.InputJsonValue | Record<string, unknown>;
    // HALLAZGO, y por eso el `& Record<string, unknown>`: de `metadata` este servicio
    // guarda SOLO tres campos —`ip`, `userAgent` y `endpoint`, que van a `direccionIP`,
    // `agenteUsuario` y `endpoint`—. Cualquier otra clave se descarta en silencio, y hay
    // dos llamadores que mandan una: `metadata: { notas }` en loans.service.ts:4322 y
    // `metadata: { motivo }` en payments.service.ts:2505. Esos dos datos NO quedan en el
    // registro de auditoria. Se deja la firma abierta para no cambiar el comportamiento
    // aqui; guardarlos es una decision de producto, no de tipos.
    metadata?: {
      ip?: string;
      userAgent?: string;
      endpoint?: string;
    } & Record<string, unknown>;
  }) {
    // Qué campos cambiaron, de verdad.
    //
    // Aquí había un `{ diff: 'calculated' }` escrito a mano junto a un comentario
    // que decía «aquí podrías implementar una lógica para calcular diferencias».
    // O sea que la columna afirmaba haber calculado un diff que nunca se hizo:
    // quien abría la auditoría buscando QUÉ cambió no encontraba nada, y el
    // registro aparentaba tenerlo.
    const cambios = calcularCambios(data.datosAnteriores, data.datosNuevos);

    return this.prisma.registroAuditoria.create({
      data: {
        usuarioId: data.usuarioId,
        accion: data.accion,
        entidad: data.entidad,
        entidadId: data.entidadId,
        valoresAnteriores: data.datosAnteriores || {},
        valoresNuevos: data.datosNuevos || {},
        cambios: cambios || {},
        direccionIP: data.metadata?.ip,
        agenteUsuario: data.metadata?.userAgent,
        endpoint: data.metadata?.endpoint,
      },
    });
  }

  async findAll() {
    return this.prisma.registroAuditoria.findMany({
      orderBy: { creadoEn: 'desc' },
      take: 100,
      include: {
        usuario: {
          select: { nombres: true, apellidos: true, correo: true, rol: true },
        },
      },
    });
  }

  /** Versión paginada con total para el frontend */
  async findAllPaginated(pagina: number = 1, limite: number = 50) {
    // La página y el tamaño se acotan antes de tocar la base, con el mismo
    // criterio que `backup.getHistory`.
    //
    // Sin el tope, un `?limite=999999` contra una tabla de auditoría grande se
    // traía todo a memoria: no se nota en desarrollo —donde hay cien filas— y
    // tumba el servidor en producción. Y una `pagina=0` calculaba `skip = -50`,
    // que Prisma rechaza, así que una petición mal formada salía como error 500
    // en vez de como lo que era.
    const limiteSeguro = Math.max(1, Math.min(100, Number(limite) || 50));
    const paginaSegura = Math.max(1, Math.floor(Number(pagina) || 1));
    const skip = (paginaSegura - 1) * limiteSeguro;
    const [registros, total] = await Promise.all([
      this.prisma.registroAuditoria.findMany({
        orderBy: { creadoEn: 'desc' },
        take: limiteSeguro,
        skip,
        include: {
          usuario: {
            select: { nombres: true, apellidos: true, correo: true, rol: true },
          },
        },
      }),
      this.prisma.registroAuditoria.count(),
    ]);
    return {
      registros,
      total,
      // Se devuelven los valores REALES usados, no los que llegaron: si alguien
      // pidio la pagina 0 y se le sirvio la 1, la respuesta tiene que decir 1.
      pagina: paginaSegura,
      limite: limiteSeguro,
      totalPaginas: Math.ceil(total / limiteSeguro),
    };
  }

  async findByUserId(
    usuarioId: string,
    take: number = 20,
    page: number = 1,
    startDate?: Date,
    endDate?: Date,
  ) {
    const skip = page > 1 ? (page - 1) * take : 0;
    const where: Prisma.RegistroAuditoriaWhereInput = { usuarioId };
    if (startDate || endDate) {
      where.creadoEn = {};
      if (startDate) where.creadoEn.gte = startDate;
      if (endDate) where.creadoEn.lte = endDate;
    }
    return this.prisma.registroAuditoria.findMany({
      where,
      orderBy: { creadoEn: 'desc' },
      take,
      skip,
      select: {
        id: true,
        accion: true,
        entidad: true,
        entidadId: true,
        valoresAnteriores: true,
        valoresNuevos: true,
        cambios: true,
        creadoEn: true,
        endpoint: true,
      },
    });
  }

  findOne(id: string) {
    return this.prisma.registroAuditoria.findUnique({
      where: { id },
    });
  }

  async exportAuditLog(
    format: 'excel' | 'pdf',
    filters: { startDate?: string; endDate?: string },
  ): Promise<{ data: Buffer; contentType: string; filename: string }> {
    // 1. Solo consulta de BD
    const where: Prisma.RegistroAuditoriaWhereInput = {};
    if (filters.startDate || filters.endDate) {
      where.creadoEn = {};
      if (filters.startDate) where.creadoEn.gte = new Date(filters.startDate);
      if (filters.endDate) where.creadoEn.lte = new Date(filters.endDate);
    }

    const logs = await this.prisma.registroAuditoria.findMany({
      where,
      orderBy: { creadoEn: 'desc' },
      take: 5000,
      include: {
        usuario: { select: { nombres: true, apellidos: true } },
      },
    });

    const fecha = getBogotaDayKey(new Date());

    // 2. Mapeo de datos al tipo del template
    const filas: AuditoriaRow[] = logs.map((l) => ({
      fecha: l.creadoEn,
      usuario: l.usuario ? `${l.usuario.nombres} ${l.usuario.apellidos}` : '',
      accion: l.accion || '',
      entidad: l.entidad || '',
      entidadId: l.entidadId || '',
      datosAnteriores: l.valoresAnteriores,
      datosNuevos: l.valoresNuevos,
    }));

    // 3. Delegamos la generación al template
    if (format === 'excel') return generarExcelAuditoria(filas, fecha);
    if (format === 'pdf') return generarPDFAuditoria(filas, fecha);

    throw new BadRequestException(
      `Formato de exportacion no valido: ${format ?? 'ninguno'}. Use "excel" o "pdf".`,
    );
  }

  async hideArchivedItem(data: { entidad: string; entidadId: string }) {
    return this.prisma.archivadoOculto.upsert({
      where: {
        entidad_entidadId: { entidad: data.entidad, entidadId: data.entidadId },
      },
      update: { ocultoEn: new Date() },
      create: { entidad: data.entidad, entidadId: data.entidadId },
    });
  }

  async listHiddenArchivedItems() {
    return this.prisma.archivadoOculto.findMany({
      select: { entidad: true, entidadId: true },
      orderBy: { ocultoEn: 'desc' },
      take: 5000,
    });
  }
}
