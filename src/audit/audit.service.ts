import { Injectable } from '@nestjs/common';
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
    const ExcelJS = await import('exceljs');
    const PDFDocument = await import('pdfkit');

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
        usuario: { select: { nombres: true, apellidos: true, correo: true } },
      },
    });

    const fecha = new Date().toISOString().split('T')[0];

    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('Auditoría');
      ws.columns = [
        { header: 'Fecha', key: 'fecha', width: 20 },
        { header: 'Usuario', key: 'usuario', width: 25 },
        { header: 'Acción', key: 'accion', width: 22 },
        { header: 'Entidad', key: 'entidad', width: 16 },
        { header: 'ID Entidad', key: 'entidadId', width: 18 },
        { header: 'Datos Anteriores', key: 'datosAnteriores', width: 35 },
        { header: 'Datos Nuevos', key: 'datosNuevos', width: 35 },
      ] as any;
      const headerRow = ws.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } };
      headerRow.alignment = { horizontal: 'center' };

      logs.forEach((l: any) => {
        ws.addRow({
          fecha: l.creadoEn ? new Date(l.creadoEn).toLocaleString('es-CO') : '',
          usuario: l.usuario ? `${l.usuario.nombres} ${l.usuario.apellidos}` : '',
          accion: l.accion || '',
          entidad: l.entidad || '',
          entidadId: l.entidadId || '',
          datosAnteriores: l.valoresAnteriores ? JSON.stringify(l.valoresAnteriores).substring(0, 100) : '',
          datosNuevos: l.valoresNuevos ? JSON.stringify(l.valoresNuevos).substring(0, 100) : '',
        });
      });

      ws.addRow({});
      const sr = ws.addRow({ fecha: `Total registros: ${logs.length}` });
      sr.font = { bold: true };

      const buffer = await workbook.xlsx.writeBuffer();
      return {
        data: Buffer.from(buffer as ArrayBuffer),
        contentType: 'application/vnd.ms-excel.sheet.macroEnabled.12',
        filename: `auditoria-${fecha}.xlsm`,
      };
    } else if (format === 'pdf') {
      const doc = new PDFDocument({ layout: 'landscape', size: 'LETTER', margin: 30 });
      const buffers: any[] = [];
      doc.on('data', buffers.push.bind(buffers));

      doc.fontSize(16).font('Helvetica-Bold').text('Créditos del Sur — Log de Auditoría', { align: 'center' });
      doc.fontSize(9).font('Helvetica').text(`Generado: ${new Date().toLocaleString('es-CO')}  |  Total registros: ${logs.length}`, { align: 'center' });
      doc.moveDown(0.5);

      const cols = [
        { label: 'Fecha', width: 100 },
        { label: 'Usuario', width: 110 },
        { label: 'Acción', width: 120 },
        { label: 'Entidad', width: 80 },
        { label: 'ID Entidad', width: 100 },
        { label: 'Detalle', width: 200 },
      ];
      const tableLeft = 30;
      let y = doc.y + 5;
      const rowH = 16;

      doc.fontSize(7).font('Helvetica-Bold');
      doc.rect(tableLeft, y, cols.reduce((s, c) => s + c.width, 0), rowH).fill('#475569');
      let x = tableLeft;
      cols.forEach(col => { doc.fillColor('white').text(col.label, x + 2, y + 4, { width: col.width - 4 }); x += col.width; });
      y += rowH;

      doc.font('Helvetica').fontSize(7).fillColor('black');
      logs.forEach((l: any, i: number) => {
        if (y > 560) { doc.addPage(); y = 30; }
        if (i % 2 === 0) { doc.rect(tableLeft, y, cols.reduce((s, c) => s + c.width, 0), rowH).fill('#F8FAFC'); doc.fillColor('black'); }
        x = tableLeft;
        const detalle = l.valoresNuevos ? JSON.stringify(l.valoresNuevos).substring(0, 40) : '';
        const rowData = [
          l.creadoEn ? new Date(l.creadoEn).toLocaleString('es-CO') : '',
          l.usuario ? `${l.usuario.nombres} ${l.usuario.apellidos}`.substring(0, 20) : '',
          (l.accion || '').substring(0, 22),
          l.entidad || '',
          (l.entidadId || '').substring(0, 16),
          detalle,
        ];
        rowData.forEach((val, ci) => { doc.text(val, x + 2, y + 4, { width: cols[ci].width - 4 }); x += cols[ci].width; });
        y += rowH;
      });

      doc.end();
      const buffer = await new Promise<Buffer>((resolve) => { doc.on('end', () => resolve(Buffer.concat(buffers))); });
      return { data: buffer, contentType: 'application/pdf', filename: `auditoria-${fecha}.pdf` };
    }
    throw new Error(`Formato no soportado: ${format}`);
  }
}
