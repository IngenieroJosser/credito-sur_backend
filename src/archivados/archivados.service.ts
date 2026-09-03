import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Una fila del listado de archivados. */
export interface ElementoArchivado {
  id: string;
  entidadId: string;
  tipo: 'cliente' | 'prestamo' | 'producto' | 'usuario';
  nombre: string;
  fechaEliminacion: Date | null;
  motivo: string;
  usuarioEliminador: string;
  /** Ruta a la que pertenecia. Null cuando la entidad no tiene ruta. */
  ruta: string | null;
  rutaId: string | null;
}

/** Acciones de auditoria que corresponden a un archivado. */
const ACCION_DE_ARCHIVADO = /ELIMINAR|DELETE|ARCHIVAR|RECHAZAR/i;

@Injectable()
export class ArchivadosService {
  constructor(private prisma: PrismaService) {}

  /**
   * Listado de lo archivado, leido de las propias entidades.
   *
   * Antes esta pantalla se armaba recorriendo el registro de auditoria y
   * quedandose con las entradas cuya accion contuviera "ELIMINAR", "DELETE",
   * "ARCHIVAR" o "RECHAZAR". Eso tenia dos problemas: renombrar una accion
   * dejaba registros fuera de la lista sin que nadie se enterara, y una entrada
   * de auditoria no sabe a que ruta pertenecia el cliente, asi que no habia
   * forma de filtrar por ruta.
   *
   * Ahora la verdad la dan las entidades con fecha de eliminacion, que si
   * conocen su ruta. La auditoria se sigue usando, pero solo para enriquecer:
   * de ahi salen el motivo y quien lo archivo, que la entidad no guarda.
   */
  async listar(): Promise<ElementoArchivado[]> {
    const [clientes, prestamos, productos, usuarios] = await Promise.all([
      this.prisma.cliente.findMany({
        where: { eliminadoEn: { not: null } },
        select: {
          id: true,
          nombres: true,
          apellidos: true,
          eliminadoEn: true,
          asignacionesRuta: {
            where: { activa: true },
            select: { ruta: { select: { id: true, nombre: true } } },
            take: 1,
          },
        },
      }),
      this.prisma.prestamo.findMany({
        where: { eliminadoEn: { not: null } },
        select: {
          id: true,
          numeroPrestamo: true,
          eliminadoEn: true,
          ruta: { select: { id: true, nombre: true } },
          cliente: { select: { nombres: true, apellidos: true } },
        },
      }),
      this.prisma.producto.findMany({
        where: { eliminadoEn: { not: null } },
        select: { id: true, nombre: true, codigo: true, eliminadoEn: true },
      }),
      this.prisma.usuario.findMany({
        where: { eliminadoEn: { not: null } },
        select: { id: true, nombres: true, apellidos: true, eliminadoEn: true },
      }),
    ]);

    const filas: ElementoArchivado[] = [
      ...clientes.map((c) => ({
        id: `cliente-${c.id}`,
        entidadId: c.id,
        tipo: 'cliente' as const,
        nombre: `${c.nombres} ${c.apellidos ?? ''}`.trim(),
        fechaEliminacion: c.eliminadoEn,
        motivo: 'Eliminación',
        usuarioEliminador: 'Sistema',
        ruta: c.asignacionesRuta[0]?.ruta?.nombre ?? null,
        rutaId: c.asignacionesRuta[0]?.ruta?.id ?? null,
      })),
      ...prestamos.map((p) => ({
        id: `prestamo-${p.id}`,
        entidadId: p.id,
        tipo: 'prestamo' as const,
        nombre: p.cliente
          ? `${p.numeroPrestamo} · ${p.cliente.nombres} ${p.cliente.apellidos ?? ''}`.trim()
          : p.numeroPrestamo,
        fechaEliminacion: p.eliminadoEn,
        motivo: 'Eliminación',
        usuarioEliminador: 'Sistema',
        ruta: p.ruta?.nombre ?? null,
        rutaId: p.ruta?.id ?? null,
      })),
      ...productos.map((p) => ({
        id: `producto-${p.id}`,
        entidadId: p.id,
        tipo: 'producto' as const,
        nombre: p.nombre || p.codigo,
        fechaEliminacion: p.eliminadoEn,
        motivo: 'Archivado en inventario',
        usuarioEliminador: 'Sistema',
        ruta: null,
        rutaId: null,
      })),
      ...usuarios.map((u) => ({
        id: `usuario-${u.id}`,
        entidadId: u.id,
        tipo: 'usuario' as const,
        nombre: `${u.nombres} ${u.apellidos ?? ''}`.trim(),
        fechaEliminacion: u.eliminadoEn,
        motivo: 'Eliminación',
        usuarioEliminador: 'Sistema',
        ruta: null,
        rutaId: null,
      })),
    ];

    await this.enriquecerConAuditoria(filas);

    return filas.sort(
      (a, b) =>
        (b.fechaEliminacion?.getTime() ?? 0) -
        (a.fechaEliminacion?.getTime() ?? 0),
    );
  }

  /**
   * Añade motivo y autor desde la auditoria.
   *
   * La entidad sabe QUE fue archivada y CUANDO, pero no por que ni por quien.
   * Eso solo esta en la bitacora, asi que se busca su ultima entrada de
   * archivado. Si no aparece, la fila se queda con los valores por defecto: la
   * entidad archivada se muestra igual, que es justo lo que fallaba antes.
   */
  private async enriquecerConAuditoria(filas: ElementoArchivado[]) {
    if (filas.length === 0) return;

    const registros = await this.prisma.registroAuditoria.findMany({
      where: { entidadId: { in: filas.map((f) => f.entidadId) } },
      orderBy: { creadoEn: 'desc' },
      select: {
        entidadId: true,
        accion: true,
        cambios: true,
        valoresNuevos: true,
        valoresAnteriores: true,
        endpoint: true,
        usuario: { select: { nombres: true, apellidos: true } },
      },
    });

    const porEntidad = new Map<string, (typeof registros)[number]>();
    for (const r of registros) {
      if (!r.entidadId || porEntidad.has(r.entidadId)) continue;
      if (!ACCION_DE_ARCHIVADO.test(r.accion)) continue;
      porEntidad.set(r.entidadId, r);
    }

    const motivoDe = (r: (typeof registros)[number]): string | null => {
      for (const fuente of [r.cambios, r.valoresNuevos, r.valoresAnteriores]) {
        const motivo = (fuente as { motivo?: unknown } | null)?.motivo;
        if (typeof motivo === 'string' && motivo.trim()) return motivo;
      }
      return r.endpoint ?? null;
    };

    for (const fila of filas) {
      const r = porEntidad.get(fila.entidadId);
      if (!r) continue;
      fila.motivo = motivoDe(r) ?? fila.motivo;
      if (r.usuario) {
        fila.usuarioEliminador =
          `${r.usuario.nombres} ${r.usuario.apellidos ?? ''}`.trim();
      }
    }
  }
}
