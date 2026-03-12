import { Injectable } from '@nestjs/common';
import { generarExcelAuditoria, generarPDFAuditoria, AuditoriaRow } from '../templates/exports/auditoria.template';
import { PrismaService } from '../prisma/prisma.service'; 

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    usuarioId: string;
    accion: string;
    entidad: string;
    entidadId: string;
    datosAnteriores?: any;
    datosNuevos?: any;
    metadata?: any;
  }) {
    // Si no hay datos, intentar inferir cambios
    let cambios: any = null;
    if (data.datosAnteriores && data.datosNuevos) {
      // Aquí podrías implementar una lógica para calcular diferencias
      cambios = { diff: 'calculated' };
    }

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
    const skip = (pagina - 1) * limite;
    const [registros, total] = await Promise.all([
      this.prisma.registroAuditoria.findMany({
        orderBy: { creadoEn: 'desc' },
        take: limite,
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
      pagina,
      limite,
      totalPaginas: Math.ceil(total / limite),
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
    const where: any = { usuarioId };
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
    const where: any = {};
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

    const fecha = new Date().toISOString().split('T')[0];

    // 2. Mapeo de datos al tipo del template
    const filas: AuditoriaRow[] = logs.map((l: any) => ({
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

    throw new Error(`Formato no soportado: ${format}`);
  }
}
