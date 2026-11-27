import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { esEntornoHistoricoAislado } from '../../common/entorno-historico-aislado';
import { ImportacionesService } from '../importaciones.service';
import { leerFecha, leerTexto } from '../parsers/cell-value.util';
import { planInventarioApertura } from './plan-inventario-apertura';
import { listarCreditosDePrueba, proyectarAbonoDePrueba } from './simular-abono-historico';
import { aplicarEscenarioArticulos, validarHipotesis, type HipotesisArticulos } from './escenario-articulos-prueba';
import { ExpedienteHistoricoService, jsonExpediente } from './expediente-historico.service';
import { huellaReferencia, planCargaHistorica } from './plan-carga-historica';

export interface ConfirmacionPruebaHistorica {
  revision: number;
  referencias: string[];
  clientes?: string[];
  evidencia: string;
  inventario?: string[];
  fechaCorteInventario?: string;
  escenarioArticulos?: HipotesisArticulos;
}

@Injectable()
export class CargaExpedienteHistoricoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly expedientes: ExpedienteHistoricoService,
    private readonly importaciones: ImportacionesService,
  ) {}

  private comprobarEntorno() {
    if (!esEntornoHistoricoAislado()) {
      throw new ForbiddenException('La carga de prueba solo está habilitada en la base PostgreSQL aislada.');
    }
  }

  listarCreditosDePrueba(id: string) {
    this.comprobarEntorno();
    return listarCreditosDePrueba(this.prisma, id);
  }

  simularAbono(id: string, prestamoId: string, monto: unknown) {
    this.comprobarEntorno();
    return proyectarAbonoDePrueba(this.prisma, id, prestamoId, monto);
  }

  async confirmarPrueba(id: string, solicitud: ConfirmacionPruebaHistorica, usuarioId: string) {
    this.comprobarEntorno();
    const revision = solicitud?.revision;
    const seleccion = solicitud?.referencias;
    const evidencia = typeof solicitud?.evidencia === 'string' ? solicitud.evidencia.trim() : '';
    if (!Number.isSafeInteger(revision) || revision < 1 || !Array.isArray(seleccion) ||
        seleccion.length > 1000 ||
        seleccion.some(ref => typeof ref !== 'string' || !/^(DINERO|CREDITO_ARTICULO)-[a-f0-9]{12}-\d+$/.test(ref)) ||
        new Set(seleccion).size !== seleccion.length || evidencia.length < 5 || evidencia.length > 500) {
      throw new BadRequestException('Indique revisión, créditos únicos y evidencia de la aprobación de prueba.');
    }
    const clientesSeleccionados = solicitud.clientes ?? [];
    if (!Array.isArray(clientesSeleccionados) || clientesSeleccionados.length > 1000 ||
        clientesSeleccionados.some(ref => typeof ref !== 'string' || !/^CLIENTE-[a-f0-9]{12}-\d+$/.test(ref)) ||
        new Set(clientesSeleccionados).size !== clientesSeleccionados.length ||
        seleccion.length + clientesSeleccionados.length === 0) {
      throw new BadRequestException('Seleccione clientes o créditos históricos válidos y sin duplicados.');
    }
    const inventario = solicitud.inventario ?? [];
    if (!Array.isArray(inventario) || inventario.length > 1000 ||
        inventario.some(ref => typeof ref !== 'string' || !/^ARTICULO-[a-f0-9]{12}-\d+$/.test(ref)) ||
        new Set(inventario).size !== inventario.length) {
      throw new BadRequestException('Seleccione referencias de inventario válidas y sin duplicados.');
    }
    const fechaCorte = solicitud.fechaCorteInventario ?? null;
    if (fechaCorte !== null && (typeof fechaCorte !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fechaCorte) ||
        leerFecha(fechaCorte)?.toISOString().slice(0, 10) !== fechaCorte || inventario.length === 0)) {
      throw new BadRequestException('La fecha de corte del inventario no es válida.');
    }
    const escenarioArticulos = validarHipotesis(solicitud.escenarioArticulos);
    const referencias = [...seleccion].sort();
    const refsInventario = [...inventario].sort();
    const refsClientes = [...clientesSeleccionados].sort();
    const huella = huellaReferencia(JSON.stringify({
      revision, referencias, ...(refsClientes.length ? { clientes: refsClientes } : {}),
      ...(inventario.length ? { inventario: refsInventario, fechaCorte } : {}),
      ...(escenarioArticulos ? { escenarioArticulos } : {}),
    }));
    const where = { expedienteId_huella: { expedienteId: id, huella } };
    return this.prisma.$transaction(async (tx) => {
      const [db] = await tx.$queryRaw<{ nombre: string; puerto: number }[]>`
        SELECT current_database() AS nombre, inet_server_port() AS puerto
      `;
      if (db?.nombre !== 'fase3_pruebas' || db.puerto !== 55483) {
        throw new ForbiddenException('La conexión no corresponde a la base aislada.');
      }
      const verificarReintento = () => tx.cargaExpedienteHistorico.findUnique({ where });
      const anterior = await verificarReintento();
      if (anterior?.revertidaEn) throw new ConflictException('Esta carga fue revertida y no se volverá a ejecutar.');
      if (anterior) return anterior.resultado;

      const reclamo = await tx.expedienteHistorico.updateMany({
        where: { id, revision, estado: 'EN_REVISION' }, data: { estado: 'IMPORTADO' },
      });
      if (reclamo.count !== 1) {
        const concurrente = await verificarReintento();
        if (concurrente?.revertidaEn) throw new ConflictException('Esta carga fue revertida.');
        if (concurrente) return concurrente.resultado;
        throw new ConflictException('Cambió la revisión o ya se confirmó otra selección.');
      }
      const { preparacion } = await this.expedientes.obtener(id, tx);
      const { paraPrueba, supuestos } = aplicarEscenarioArticulos(preparacion, referencias, escenarioArticulos);
      const plan = planCargaHistorica(paraPrueba, referencias, refsClientes);
      const codigosRuta = [...new Set([...plan.clientes.values()].map(c => c.dato.rutaCodigo).filter(Boolean))];
      const rutas = await tx.ruta.findMany({ where: { codigo: { in: codigosRuta }, activa: true, eliminadoEn: null }, select: { id: true, codigo: true } });
      const rutaPorCodigo = new Map(rutas.map(ruta => [ruta.codigo, ruta.id]));
      if (rutas.length !== codigosRuta.length) throw new BadRequestException('Alguna ruta indicada no existe o está inactiva.');

      const asociaciones = new Map<string, { entidad: string; entidadId: string }>();
      let loteInventarioId: string | null = null;
      let productosCreados = 0;
      let preciosCreados = 0;
      if (refsInventario.length) {
        const apertura = await planInventarioApertura(preparacion, refsInventario, tx);
        if (apertura.problemas.length) {
          throw new BadRequestException({
            message: 'Hay artículos de apertura que no superaron la validación.',
            problemas: apertura.problemas.slice(0, 20),
          });
        }
        const cargado = await this.importaciones.persistirInventarioValidado(apertura.resultado, usuarioId, {
          tx, expedienteId: id, fechaCorte,
        });
        loteInventarioId = cargado.loteId;
        productosCreados = cargado.articulosCreados;
        preciosCreados = cargado.preciosCreados;
        if (productosCreados !== refsInventario.length ||
            preciosCreados !== (apertura.resultado.precios?.length ?? 0) ||
            cargado.articulosOmitidos || cargado.articulosActualizados || cargado.preciosOmitidos || cargado.preciosActualizados) {
          throw new ConflictException('La apertura no creó exactamente los artículos y precios seleccionados.');
        }
        const productos = await tx.producto.findMany({
          where: { codigo: { in: [...apertura.referenciaPorCodigo.keys()] } },
          select: { id: true, codigo: true },
        });
        if (productos.length !== refsInventario.length) throw new ConflictException('Faltan referencias del inventario.');
        for (const producto of productos) {
          const ref = apertura.referenciaPorCodigo.get(producto.codigo);
          if (!ref) throw new ConflictException('No se pudo vincular el producto de apertura.');
          asociaciones.set(ref, { entidad: 'PRODUCTO', entidadId: producto.id });
        }
      }
      const articuloPorPrestamo = new Map<string, { productoId?: string; articuloHistoricoId?: string }>();
      for (const { fuente, dato } of plan.creditos.values()) {
        if (fuente.tipo !== 'CREDITO_ARTICULO') continue;
        const ref = leerTexto(fuente.valores.articulo_ref);
        const asociacion = asociaciones.get(ref);
        if (asociacion) {
          articuloPorPrestamo.set(dato.numeroPrestamo, asociacion.entidad === 'PRODUCTO'
            ? { productoId: asociacion.entidadId } : { articuloHistoricoId: asociacion.entidadId });
          continue;
        }
        const original = plan.porReferencia.get(ref);
        if (original?.tipo !== 'ARTICULO' && ref !== fuente.valores.referencia_articulo_historico) {
          throw new BadRequestException('La referencia histórica de un artículo ya no es válida.');
        }
        const articulo = await tx.articuloHistorico.create({ data: {
          expedienteId: id, referencia: ref,
            codigoOrigen: leerTexto(original?.valores.codigo ??
              (ref === fuente.valores.codigo_articulo ? null : fuente.valores.codigo_articulo)).slice(0, 80) || null,
          descripcion: leerTexto(original?.valores.nombre).slice(0, 255) || null,
          evidencia: jsonExpediente({
            referenciaCredito: fuente.referencia, codigoInformado: fuente.campos.codigo_articulo,
            referenciaCatalogo: original?.referencia ?? null,
            vinculo: fuente.cambios.find(c => c.campo === 'articulo_ref' && c.definitivo === ref) ?? null,
          }),
        }, select: { id: true } });
        asociaciones.set(ref, { entidad: 'ARTICULO_HISTORICO', entidadId: articulo.id });
        articuloPorPrestamo.set(dato.numeroPrestamo, { articuloHistoricoId: articulo.id });
      }
      const carga = await this.importaciones.persistirCarteraValidada(plan.resultado, usuarioId, {
        tx, expedienteId: id, documentos: plan.documentos, articulos: articuloPorPrestamo,
      });
      if (carga.creditosHistoricosCreados !== plan.creditos.size || carga.clientesCreados !== plan.clientes.size ||
          carga.creditosOmitidos || carga.asientosCreados || carga.transaccionesCreadas || carga.articulosDescontados) {
        throw new ConflictException('El resultado de la carga no corresponde a lo planificado.');
      }
      const [clientes, creditos] = await Promise.all([
        tx.cliente.findMany({ where: { loteImportacionId: carga.loteId }, select: { id: true, codigo: true } }),
        tx.prestamo.findMany({ where: { loteImportacionId: carga.loteId }, select: { id: true, numeroPrestamo: true, saldoPendiente: true } }),
      ]);
      const porCodigo = new Map(clientes.map(c => [c.codigo, c.id]));
      const porNumero = new Map(creditos.map(c => [c.numeroPrestamo, c]));
      for (const [referencia, { dato }] of plan.clientes) {
        const entidadId = porCodigo.get(dato.codigoImp);
        if (!entidadId) throw new ConflictException('Falta un cliente de la carga.');
        asociaciones.set(referencia, { entidad: 'CLIENTE', entidadId });
        const ruta = rutaPorCodigo.get(dato.rutaCodigo);
        if (ruta) asociaciones.set('RUTA-' + huellaReferencia(dato.rutaCodigo).slice(0, 24), { entidad: 'RUTA', entidadId: ruta });
      }
      for (const alias of plan.consolidaciones) {
        const principal = alias.vinculadaA && asociaciones.get(alias.vinculadaA);
        if (principal) asociaciones.set(alias.referencia, principal);
      }
      for (const [ref, { dato }] of plan.creditos) {
        const credito = porNumero.get(dato.numeroPrestamo);
        if (!credito || Number(credito.saldoPendiente) !== dato.saldoPendiente) {
          throw new ConflictException('El saldo persistido no coincide con la conciliación.');
        }
        asociaciones.set(ref, { entidad: 'PRESTAMO', entidadId: credito.id });
      }
      await tx.referenciaExpedienteHistorico.createMany({ data: [...asociaciones].map(([referencia, destino]) => ({
        expedienteId: id, referencia, ...destino,
        evidencia: jsonExpediente({ revision, referencia, fila: plan.porReferencia.get(referencia)?.fila ?? null }),
      })) });
      const fuentePorReferencia = new Map(preparacion.filas.map(f => [f.referencia, f]));
      const resultado = jsonExpediente({
        ...carga, expedienteId: id, revision, referencias, evidencia, usuarioId,
        clientesSeleccionados: refsClientes,
        inventario: { referencias: refsInventario, loteInventarioId, productosCreados, preciosCreados, fechaCorte },
        inventarioExcluido: preparacion.filas.filter(f => f.tipo === 'ARTICULO' && !asociaciones.has(f.referencia)).map(f => f.referencia),
        supuestosDePrueba: supuestos.map(d => ({
          ...d, original: fuentePorReferencia.get(d.referencia)?.campos[
            d.campo === 'interpretacion_monto' ? 'monto' : d.campo === 'articulo_ref' ? 'codigo_articulo' : d.campo
          ] ?? null,
        })),
        huellaDecisiones: preparacion.huellaDecisiones, soloPrueba: true, cobranzaAutorizada: false,
        excluidos: preparacion.filas.filter(f => (f.tipo === 'DINERO' || f.tipo === 'CREDITO_ARTICULO') && !plan.creditos.has(f.referencia))
          .map(f => f.referencia),
        articulosHistoricosCreados: [...asociaciones.values()].filter(a => a.entidad === 'ARTICULO_HISTORICO').length,
      });
      await tx.cargaExpedienteHistorico.create({ data: {
        expedienteId: id, revision, huella, loteId: carga.loteId, loteInventarioId, resultado,
      } });
      return resultado;
    }, { maxWait: 60_000, timeout: 120_000 });
  }

  async revertirPrueba(id: string, usuarioId: string) {
    this.comprobarEntorno();
    return this.prisma.$transaction(async (tx) => {
      const [db] = await tx.$queryRaw<{ nombre: string; puerto: number }[]>`
        SELECT current_database() AS nombre, inet_server_port() AS puerto
      `;
      if (db?.nombre !== 'fase3_pruebas' || db.puerto !== 55483) {
        throw new ForbiddenException('La conexión no corresponde a la base aislada.');
      }
      const cambio = await tx.expedienteHistorico.updateMany({
        where: { id, estado: 'IMPORTADO' }, data: { estado: 'REVERTIDO' },
      });
      if (cambio.count !== 1) throw new ConflictException('El expediente no tiene una carga vigente.');
      const carga = await tx.cargaExpedienteHistorico.findFirstOrThrow({ where: { expedienteId: id, revertidaEn: null } });
      const modificados = await tx.prestamo.count({ where: {
        loteImportacionId: carga.loteId,
        OR: [{ version: { gt: 1 } }, { soloPruebaHistorica: false }, { eliminadoEn: { not: null } }],
      } });
      const clientesModificados = await tx.cliente.count({ where: {
        loteImportacionId: carga.loteId,
        OR: [{ version: { gt: 1 } }, { eliminadoEn: { not: null } }],
      } });
      if (modificados || clientesModificados) {
        throw new ConflictException('Hay clientes o créditos modificados después de importar.');
      }
      const resultado = await this.importaciones.revertirLote(carga.loteId, { usuarioId }, tx);
      const inventario = carga.loteInventarioId
        ? await this.importaciones.revertirLote(carga.loteInventarioId, { usuarioId }, tx)
        : null;
      await tx.cargaExpedienteHistorico.update({
        where: { id: carga.id }, data: { revertidaEn: new Date(), revertidaPorId: usuarioId },
      });
      return { ...resultado, inventario };
    }, { maxWait: 60_000, timeout: 120_000 });
  }
}
