import { randomBytes } from 'node:crypto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Workbook } from 'exceljs';
import { LedgerService } from '../../accounting/ledger.service';
import type { NotificacionesGateway } from '../../notificaciones/notificaciones.gateway';
import { PrismaService } from '../../prisma/prisma.service';
import { ImportacionesService } from '../importaciones.service';
import { CargaExpedienteHistoricoService } from './carga-expediente-historico.service';
import { ExpedienteHistoricoService } from './expediente-historico.service';
import { prepararHistoricos } from './preparar-historicos';

const url = process.env.CREDISUR_IMPORTACION_TEST_URL;
(url ? describe : describe.skip)('Expediente histórico en PostgreSQL aislado', () => {
  let prisma: PrismaService;
  let importaciones: ImportacionesService;
  let expedientes: ExpedienteHistoricoService;
  let cargas: CargaExpedienteHistoricoService;
  const anterior = process.env.DATABASE_URL;
  const bandera = process.env.CREDISUR_HABILITAR_CARGA_HISTORICA_PRUEBA;

  beforeAll(async () => {
    const conexion = new URL(url!);
    if (conexion.protocol !== 'postgresql:' || conexion.hostname !== '127.0.0.1' ||
      conexion.port !== '55483' || conexion.pathname !== '/fase3_pruebas') {
      throw new Error('Esta prueba requiere la instancia aislada de CrediSur.');
    }
    process.env.DATABASE_URL = conexion.href;
    process.env.CREDISUR_HABILITAR_CARGA_HISTORICA_PRUEBA = '1';
    prisma = new PrismaService(new EventEmitter2());
    await prisma.$connect();
    importaciones = new ImportacionesService(prisma, new LedgerService(prisma), {} as NotificacionesGateway);
    expedientes = new ExpedienteHistoricoService(prisma);
    cargas = new CargaExpedienteHistoricoService(prisma, expedientes, importaciones);
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
    if (anterior === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = anterior;
    if (bandera === undefined) delete process.env.CREDISUR_HABILITAR_CARGA_HISTORICA_PRUEBA;
    else process.env.CREDISUR_HABILITAR_CARGA_HISTORICA_PRUEBA = bandera;
  });

  it('recupera revisiones, incorpora un artículo sin catálogo, confirma, reintenta y revierte', async () => {
    const eventosAntes = await prisma.outboxEvent.count();
    const clave = randomBytes(4).toString('hex');
    const dni = '98' + String(Number.parseInt(clave, 16) % 100_000_000).padStart(8, '0');
    const usuario = await prisma.usuario.create({ data: {
      correo: `expediente-${clave}@example.invalid`, nombres: 'Revisor', apellidos: 'Sintético',
      rol: 'SUPER_ADMINISTRADOR', hashContrasena: 'sin-acceso',
    } });
    const wb = new Workbook();
    const ruta = await prisma.ruta.create({
      data: { codigo: 'RT-' + clave.toUpperCase(), nombre: 'Ruta de prueba', zona: 'PRUEBA', cobradorId: usuario.id },
    });
    const clientes = wb.addWorksheet('Clientes');
    clientes.getRow(6).values = ['CC cliente', 'Nombres', 'Apellidos', 'Ruta código'];
    clientes.getRow(7).values = ['1', 'Persona técnica', clave, ruta.codigo];
    clientes.getRow(8).values = [dni, 'Persona con documento', clave, ruta.codigo];
    clientes.getRow(9).values = ['2', 'Cliente sin crédito', clave, ruta.codigo];
    const dinero = wb.addWorksheet('Créditos de dinero');
    dinero.getRow(6).values = ['CC cliente', 'Monto', 'Tipo carga', 'Tipo de interés', 'Tasa interés', 'Cantidad cuotas',
      'Frecuencia pago', 'Fecha crédito', 'Fecha primer cobro', 'Total abonado'];
    dinero.getRow(7).values = [dni, 600000, 'HISTORICA', 'Interés simple', 0, 3, 'MENSUAL', '2026-01-10', '2026-02-10', 0];
    dinero.getRow(8).values = [dni, null, 'HISTORICA', 'Interés simple', 0, 3, 'MENSUAL', '2026-01-10', null, null];
    const credito = wb.addWorksheet('Créditos de artículo');
    credito.getRow(6).values = ['CC cliente', 'Código del artículo', 'Tipo carga', 'Precio total pactado', 'Cuota inicial',
      'Total abonado', 'Frecuencia pago', 'Plazo meses', 'Cantidad cuotas', 'Fecha crédito', 'Fecha primer cobro'];
    credito.getRow(7).values = ['1', null, 'HISTORICA', 550000, 100000, 90000, 'SEMANAL', 2, 5, '2026-01-10', '2026-01-17'];
    const inventario = new Workbook();
    const articulos = inventario.addWorksheet('Artículos');
    const codigo = 'AP-' + clave.toUpperCase();
    articulos.getRow(6).values = ['Código', 'Nombre del artículo', 'Categoría', 'Costo unitario',
      'Precio contado', 'Stock actual', 'Meses opción 1', 'Precio total opción 1'];
    articulos.getRow(7).values = [codigo, 'Inventario sintético', 'Apertura de prueba', 12345.5, 20000, 2, 3, 25000];
    const p = await prepararHistoricos(
      { nombre: 'cartera-fixture.xlsx', bytes: Buffer.from(await wb.xlsx.writeBuffer()) },
      { nombre: 'inventario-fixture.xlsx', bytes: Buffer.from(await inventario.xlsx.writeBuffer()) },
    );
    const abierto = await expedientes.abrir(p, usuario.id);
    const id = abierto.expediente.id;
    expect((await expedientes.abrir(p, usuario.id)).expediente.id).toBe(id);
    const art = p.filas.find(f => f.tipo === 'CREDITO_ARTICULO')!;
    const caja = p.filas.find(f => f.tipo === 'DINERO' && f.fila === 7)!;
    const incompleto = p.filas.find(f => f.tipo === 'DINERO' && f.fila === 8)!;
    const decisiones = { ...p.decisiones, filas: [{
      referencia: art.referencia, campo: 'articulo_ref', valor: art.valores.referencia_articulo_historico,
      evidencia: 'Tarjeta sintética sin referencia comercial',
    }] };
    const guardado = await expedientes.guardar(id, 1, decisiones, usuario.id);
    const reanudado = await new ExpedienteHistoricoService(prisma).obtener(id);
    expect(reanudado.preparacion).toEqual(guardado.preparacion);
    expect(reanudado.preparacion.decisiones.responsable).toBe(usuario.id);
    expect(reanudado.preparacion.filas.find(f => f.referencia === art.referencia)?.estado).toBe('PARA_VALIDAR');
    expect(await expedientes.historial(id)).toHaveLength(2);
    await expect(expedientes.guardar(id, 1, decisiones, usuario.id)).rejects.toThrow(/expediente cambió/);

    const producto = p.filas.find(f => f.tipo === 'ARTICULO')!;
    const clienteSinCredito = p.filas.find(f => f.tipo === 'CLIENTE' && f.fila === 9)!;
    const solicitud = { revision: 2, referencias: [art.referencia, caja.referencia], clientes: [clienteSinCredito.referencia],
      inventario: [producto.referencia], evidencia: 'Prueba sintética autorizada' };
    await expect(cargas.confirmarPrueba(id, { ...solicitud, referencias: [...solicitud.referencias, incompleto.referencia] }, usuario.id))
      .rejects.toThrow(/no está listo/);
    const duplicado = await prisma.cliente.create({ data: {
      codigo: 'FIX-' + clave, dni, nombres: 'Otra persona', apellidos: 'Prueba', telefono: '', creadoPorId: usuario.id,
    } });
    await expect(cargas.confirmarPrueba(id, solicitud, usuario.id)).rejects.toThrow(/Ya existe un cliente/);
    expect(await prisma.articuloHistorico.count({ where: { expedienteId: id } })).toBe(0);
    expect(await prisma.producto.findUnique({ where: { codigo } })).toBeNull();
    expect(await prisma.cliente.count({ where: { creadoPorId: usuario.id } })).toBe(1);
    expect((await expedientes.obtener(id)).expediente.estado).toBe('EN_REVISION');
    await prisma.cliente.delete({ where: { id: duplicado.id } });

    const [uno, dos] = await Promise.all([
      cargas.confirmarPrueba(id, solicitud, usuario.id),
      cargas.confirmarPrueba(id, { ...solicitud, referencias: [...solicitud.referencias].reverse() }, usuario.id),
    ]);
    expect(uno).toEqual(dos);
    expect(uno).toMatchObject({ creditosHistoricosCreados: 2, clientesCreados: 3, cuotasCreadas: 8, articulosHistoricosCreados: 1,
      excluidos: [incompleto.referencia], soloPrueba: true, cobranzaAutorizada: false });
    const lote = await prisma.cargaExpedienteHistorico.findFirstOrThrow({ where: { expedienteId: id } });
    expect(await prisma.asignacionRuta.count({
      where: { rutaId: ruta.id, activa: true, cliente: { loteImportacionId: lote.loteId } },
    })).toBe(3);
    const prestamos = await prisma.prestamo.findMany({ where: { loteImportacionId: lote.loteId }, include: {
      articuloHistorico: true, cliente: true, cuotas: true,
    } });
    const creditoArticulo = prestamos.find(c => c.tipoPrestamo === 'ARTICULO')!;
    expect(creditoArticulo).toMatchObject({ productoId: null, soloPruebaHistorica: true, estado: 'BORRADOR',
      cliente: { dni: null }, articuloHistorico: { codigoOrigen: null, descripcion: null } });
    expect(Number(creditoArticulo.saldoPendiente)).toBe(360000);
    expect(creditoArticulo.cuotas.filter(c => c.estado === 'PAGADA')).toHaveLength(1);
    await expect(prisma.prestamo.update({ where: { id: creditoArticulo.id }, data: { estado: 'ACTIVO' } })).rejects.toThrow();
    expect(await cargas.listarCreditosDePrueba(id)).toHaveLength(2);
    await expect(cargas.simularAbono(id, creditoArticulo.id, 360001)).rejects.toThrow(/supera el saldo/);
    expect(await cargas.simularAbono(id, creditoArticulo.id, 10000)).toMatchObject({
      soloSimulacion: true, saldoAnterior: 360000, saldoProyectado: 350000, capital: 10000, cuotasAfectadas: 1,
    });
    expect(await prisma.cuota.findMany({ where: { prestamoId: creditoArticulo.id }, orderBy: { numeroCuota: 'asc' } }))
      .toEqual(creditoArticulo.cuotas.sort((a, b) => a.numeroCuota - b.numeroCuota));
    expect(await prisma.pago.count({ where: { prestamoId: creditoArticulo.id } })).toBe(0);
    expect(await prisma.referenciaExpedienteHistorico.count({ where: { expedienteId: id } })).toBe(8);
    expect(await prisma.transaccion.count({ where: { creadoPorId: usuario.id } })).toBe(0);
    const comercial = await prisma.producto.findUniqueOrThrow({ where: { codigo } });
    expect(comercial.stock).toBe(2);
    expect(Number(comercial.costo)).toBe(12345.5);
    const asientos = await prisma.journalEntry.findMany({ where: { createdBy: usuario.id }, include: { lines: true } });
    expect(asientos).toHaveLength(1);
    expect(asientos[0]).toMatchObject({ referenceType: 'APERTURA', isOpening: true });
    expect(asientos[0].lines.every(linea => linea.cajaId === null && linea.cajaDelta === null)).toBe(true);
    const documentoRecuperado = (Number(dni) - 100_000_000).toString();
    await prisma.cliente.update({ where: { id: creditoArticulo.clienteId },
      data: { dni: documentoRecuperado, version: { increment: 1 } } });
    expect((await prisma.prestamo.findUniqueOrThrow({ where: { id: creditoArticulo.id } })).clienteId)
      .toBe(creditoArticulo.clienteId);
    await expect(cargas.revertirPrueba(id, usuario.id)).rejects.toThrow(/modificados/);
    expect((await expedientes.obtener(id)).expediente.estado).toBe('IMPORTADO');
    await prisma.cliente.update({ where: { id: creditoArticulo.clienteId }, data: { dni: null, version: 1 } });
    await expect(importaciones.revertirLote(lote.loteId, { usuarioId: usuario.id })).rejects.toThrow(/desde su expediente/);
    await expect(importaciones.revertirLote(lote.loteInventarioId!, { usuarioId: usuario.id })).rejects.toThrow(/desde su expediente/);
    await prisma.producto.update({ where: { id: comercial.id }, data: { stock: 3 } });
    await expect(cargas.revertirPrueba(id, usuario.id)).rejects.toThrow(/inventario cambió/);
    expect(await cargas.listarCreditosDePrueba(id)).toHaveLength(2);
    await prisma.producto.update({ where: { id: comercial.id }, data: { stock: 2 } });
    expect(await cargas.revertirPrueba(id, usuario.id)).toMatchObject({
      prestamosEliminados: 2, stockDevuelto: 0, transaccionesReversadas: 0, asientosReversados: 0,
      inventario: { articulosEliminados: 1, asientosReversados: 1 },
    });
    expect(await prisma.producto.findUnique({ where: { codigo } })).toBeNull();
    expect((await expedientes.obtener(id)).expediente.estado).toBe('REVERTIDO');
    expect(await cargas.listarCreditosDePrueba(id)).toEqual([]);
    expect(await prisma.prestamo.count({ where: { loteImportacionId: lote.loteId } })).toBe(0);
    expect(await prisma.referenciaExpedienteHistorico.count({ where: { expedienteId: id } })).toBe(8);
    await expect(cargas.confirmarPrueba(id, solicitud, usuario.id)).rejects.toThrow(/revertida/);
    expect(await prisma.outboxEvent.count()).toBe(eventosAntes);
  }, 35_000);
});
