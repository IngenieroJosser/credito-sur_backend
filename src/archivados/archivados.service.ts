import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService, TransaccionPrisma } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

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
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

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

  /**
   * Borrado definitivo desde la pantalla de Archivados.
   *
   * La regla del negocio es que nada se borra de una: primero se archiva y,
   * solo desde aqui, se puede eliminar del todo. Pero esto es dinero, asi que
   * el borrado definitivo se NIEGA cuando la entidad tiene algo financiero
   * (pagos, movimientos de caja o asientos contables). En ese caso la unica
   * salida es restaurarla; borrarla romperia la contabilidad y el historial.
   *
   * Solo se llega aqui con entidades YA archivadas: si no lo estan, no hay
   * nada que eliminar y se avisa en vez de borrar por sorpresa.
   */
  async eliminarDefinitivo(tipo: string, entidadId: string, usuarioId: string) {
    const t = String(tipo || '').toLowerCase();
    if (t === 'cliente') {
      return this.eliminarClienteDefinitivo(entidadId, usuarioId);
    }
    if (t === 'prestamo') {
      return this.eliminarPrestamoDefinitivo(entidadId, usuarioId);
    }
    if (t === 'producto') {
      return this.eliminarProductoDefinitivo(entidadId, usuarioId);
    }
    throw new BadRequestException(
      `No se puede eliminar definitivamente un registro de tipo "${tipo}".`,
    );
  }

  /**
   * ¿La entidad esta ligada a dinero?
   *
   * Un pago, un movimiento de caja o un asiento contable es dinero que ya
   * ocurrio: si existe, no se puede borrar la entidad sin dejar la
   * contabilidad rota. Tambien cuenta un abono parcial en las cuotas.
   */
  private async tieneDinero(scope: {
    clienteIds?: string[];
    prestamoIds?: string[];
  }): Promise<boolean> {
    const clienteIds = scope.clienteIds ?? [];
    const prestamoIds = scope.prestamoIds ?? [];
    // Los asientos y movimientos pueden referenciar al cliente o al credito.
    const idsDeReferencia = [...clienteIds, ...prestamoIds];

    const [pagos, transacciones, cuotasConAbono, asientos] = await Promise.all([
      this.prisma.pago.count({
        where: {
          OR: [
            ...(clienteIds.length ? [{ clienteId: { in: clienteIds } }] : []),
            ...(prestamoIds.length ? [{ prestamoId: { in: prestamoIds } }] : []),
          ],
        },
      }),
      this.prisma.transaccion.count({
        where: {
          OR: [
            ...(clienteIds.length ? [{ clienteId: { in: clienteIds } }] : []),
            ...(idsDeReferencia.length
              ? [{ referenciaId: { in: idsDeReferencia } }]
              : []),
          ],
        },
      }),
      this.prisma.cuota.count({
        where: { prestamoId: { in: prestamoIds }, montoPagado: { gt: 0 } },
      }),
      this.prisma.journalEntry.count({
        where: { referenceId: { in: idsDeReferencia } },
      }),
    ]);

    return pagos + transacciones + cuotasConAbono + asientos > 0;
  }

  /**
   * Borra lo que cuelga de unos creditos y que no es dinero: el plan de cuotas,
   * sus detalles y las prorrogas. Se llama solo tras comprobar que no hay pagos.
   */
  private async borrarDependenciasDePrestamos(
    tx: TransaccionPrisma,
    prestamoIds: string[],
  ) {
    if (prestamoIds.length === 0) return;

    const cuotas = await tx.cuota.findMany({
      where: { prestamoId: { in: prestamoIds } },
      select: { id: true },
    });
    const cuotaIds = cuotas.map((c) => c.id);

    if (cuotaIds.length > 0) {
      await tx.detallePago.deleteMany({ where: { cuotaId: { in: cuotaIds } } });
    }
    await tx.extensionPago.deleteMany({
      where: { prestamoId: { in: prestamoIds } },
    });
    await tx.cuota.deleteMany({ where: { prestamoId: { in: prestamoIds } } });
  }

  private async eliminarClienteDefinitivo(clienteId: string, usuarioId: string) {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id: clienteId, eliminadoEn: { not: null } },
      select: { id: true, nombres: true, apellidos: true, dni: true },
    });
    if (!cliente) {
      throw new NotFoundException('El cliente no existe o no está archivado.');
    }

    const prestamos = await this.prisma.prestamo.findMany({
      where: { clienteId },
      select: { id: true },
    });
    const prestamoIds = prestamos.map((p) => p.id);

    if (await this.tieneDinero({ clienteIds: [clienteId], prestamoIds })) {
      throw new ConflictException(
        'No se puede eliminar definitivamente: el cliente tiene pagos o movimientos de dinero. Restáuralo si lo necesitas.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await this.borrarDependenciasDePrestamos(tx, prestamoIds);
      await tx.aprobacion.deleteMany({
        where: { referenciaId: { in: [clienteId, ...prestamoIds] } },
      });
      await tx.prestamo.deleteMany({ where: { clienteId } });
      await tx.asignacionRuta.deleteMany({ where: { clienteId } });
      await tx.alertaCliente.deleteMany({ where: { clienteId } });
      await tx.registroVisita.deleteMany({ where: { clienteId } });
      await tx.cliente.delete({ where: { id: clienteId } });
    });

    await this.auditService.create({
      usuarioId,
      accion: 'ELIMINAR_DEFINITIVO_CLIENTE',
      entidad: 'Cliente',
      entidadId: clienteId,
      datosAnteriores: {
        nombres: cliente.nombres,
        apellidos: cliente.apellidos,
        dni: cliente.dni,
      },
      datosNuevos: { eliminadoDefinitivamente: true },
    });

    return { eliminado: true, tipo: 'cliente', entidadId: clienteId };
  }

  private async eliminarPrestamoDefinitivo(
    prestamoId: string,
    usuarioId: string,
  ) {
    const prestamo = await this.prisma.prestamo.findFirst({
      where: { id: prestamoId, eliminadoEn: { not: null } },
      select: { id: true, numeroPrestamo: true },
    });
    if (!prestamo) {
      throw new NotFoundException('El crédito no existe o no está archivado.');
    }

    if (await this.tieneDinero({ prestamoIds: [prestamoId] })) {
      throw new ConflictException(
        'No se puede eliminar definitivamente: el crédito tiene pagos o movimientos de dinero. Restáuralo si lo necesitas.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await this.borrarDependenciasDePrestamos(tx, [prestamoId]);
      await tx.aprobacion.deleteMany({ where: { referenciaId: prestamoId } });
      await tx.prestamo.delete({ where: { id: prestamoId } });
    });

    await this.auditService.create({
      usuarioId,
      accion: 'ELIMINAR_DEFINITIVO_PRESTAMO',
      entidad: 'Prestamo',
      entidadId: prestamoId,
      datosAnteriores: { numeroPrestamo: prestamo.numeroPrestamo },
      datosNuevos: { eliminadoDefinitivamente: true },
    });

    return { eliminado: true, tipo: 'prestamo', entidadId: prestamoId };
  }

  private async eliminarProductoDefinitivo(
    productoId: string,
    usuarioId: string,
  ) {
    const producto = await this.prisma.producto.findFirst({
      where: { id: productoId, eliminadoEn: { not: null } },
      select: { id: true, nombre: true, codigo: true },
    });
    if (!producto) {
      throw new NotFoundException('El producto no existe o no está archivado.');
    }

    const creditos = await this.prisma.prestamo.count({ where: { productoId } });
    if (creditos > 0) {
      throw new ConflictException(
        'No se puede eliminar definitivamente: el producto está ligado a créditos. Restáuralo si lo necesitas.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.precioProducto.deleteMany({ where: { productoId } });
      await tx.producto.delete({ where: { id: productoId } });
    });

    await this.auditService.create({
      usuarioId,
      accion: 'ELIMINAR_DEFINITIVO_PRODUCTO',
      entidad: 'Producto',
      entidadId: productoId,
      datosAnteriores: {
        nombre: producto.nombre,
        codigo: producto.codigo,
      },
      datosNuevos: { eliminadoDefinitivamente: true },
    });

    return { eliminado: true, tipo: 'producto', entidadId: productoId };
  }
}
