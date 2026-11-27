import { randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { LedgerService } from '../../accounting/ledger.service';
import { NotificacionesGateway } from '../../notificaciones/notificaciones.gateway';
import { PrismaService } from '../../prisma/prisma.service';
import { ImportacionesService } from '../importaciones.service';

const urlPruebas = process.env.CREDISUR_IMPORTACION_TEST_URL;

(urlPruebas ? describe : describe.skip)('Importación histórica con PostgreSQL aislado', () => {
  let prisma: PrismaService;
  let servicio: ImportacionesService;
  let anterior: string | undefined;

  beforeAll(async () => {
    const url = new URL(urlPruebas!);
    if (url.protocol !== 'postgresql:' || url.hostname !== '127.0.0.1' ||
      !url.port || url.port === '5432' || url.pathname !== '/fase3_pruebas') {
      throw new Error('Use una instancia local dedicada y la base fase3_pruebas, no el servidor por defecto.');
    }
    anterior = process.env.DATABASE_URL;
    process.env.DATABASE_URL = url.href;
    const eventos = new EventEmitter2();
    prisma = new PrismaService(eventos);
    await prisma.$connect();
    servicio = new ImportacionesService(prisma, new LedgerService(prisma), {} as NotificacionesGateway);
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.$disconnect();
    if (anterior === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = anterior;
  });

  it('conserva las condiciones pactadas, no mueve caja ni stock y puede revertirse', async () => {
    const clave = randomBytes(4).toString('hex').toUpperCase();
    const admin = await prisma.usuario.create({
      data: { correo: `fase3-${clave}@example.invalid`, nombres: 'Prueba', apellidos: 'Fase tres',
        rol: 'SUPER_ADMINISTRADOR', hashContrasena: 'usuario-sintetico-sin-acceso' },
    });
    const ruta = await prisma.ruta.create({
      data: { codigo: `T-${clave}`, nombre: 'Ruta sintética', zona: 'Prueba', cobradorId: admin.id },
    });
    const producto = await prisma.producto.create({
      data: { codigo: `HIST-${clave}`, nombre: 'Producto sintético descontinuado', categoria: 'Pruebas',
        costo: 12345, stock: 0, activo: false },
    });

    const libro = new Workbook();
    const clientes = libro.addWorksheet('Clientes');
    clientes.getRow(6).values = ['Tipo de cliente', 'CC cliente', 'Nombres', 'Ruta código', 'Apellidos'];
    clientes.getRow(7).values = ['HISTORICO', '1', 'Persona de prueba', ruta.codigo];
    const creditos = libro.addWorksheet('Créditos de artículo');
    creditos.getRow(6).values = ['Número de crédito manual', 'CC cliente', 'Código del artículo', 'Fecha crédito',
      'Fecha primer cobro', 'Tipo carga', 'Plazo meses', 'Frecuencia pago', 'Precio total pactado', 'Cuota inicial',
      'Total abonado', 'Saldo informado por cartera', 'Cuotas pactadas', 'Valor de cuota pactado'];
    const numero = `TEST-F3-${clave}`;
    creditos.getRow(7).values = [numero, '1', producto.codigo, '2026-01-10', '2026-01-17',
      'HISTORICA', 2, 'SEMANAL', 550000, 100000, 90000, 360000, 5, 90000];
    const buffer = Buffer.from(await libro.xlsx.writeBuffer());
    const archivo: Express.Multer.File = {
      fieldname: 'file', mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      encoding: '7bit', originalname: 'integracion-cartera-sintetica.xlsx',
      buffer, size: buffer.length, stream: Readable.from(buffer), filename: '', path: '', destination: '',
    };

    const inicial = await servicio.validarClientesCreditos(archivo);
    expect(inicial.errores).toEqual([]);
    expect(inicial.creditos?.[0]).toMatchObject({ cantidadCuotas: 5, ccCliente: '1', totalAbonado: 90000, saldoPendiente: 360000 });
    const primerLote = await servicio.confirmarClientesCreditos(archivo, admin.id);
    expect(primerLote).toMatchObject({ clientesCreados: 1, creditosHistoricosCreados: 1, cuotasCreadas: 5,
      transaccionesCreadas: 0, asientosCreados: 0, articulosDescontados: 0 });
    const credito = await prisma.prestamo.findUniqueOrThrow({
      where: { numeroPrestamo: numero }, include: { cliente: true, cuotas: true, pagos: true },
    });
    expect(credito.cliente.dni).not.toBe('1');
    expect(credito.cliente).toMatchObject({ apellidos: '', telefono: '', estadoAprobacion: 'APROBADO' });
    expect(credito.productoId).toBe(producto.id);
    expect(credito.precioProductoId).toBeNull();
    expect(credito.costoArticulo).toBeNull();
    expect(credito.cuotas).toHaveLength(5);
    expect(credito.cuotas.filter(c => c.estado === 'PAGADA')).toHaveLength(1);
    expect(credito.pagos).toHaveLength(0);
    expect(Number(credito.saldoPendiente)).toBe(360000);
    await expect(servicio.confirmarClientesCreditos(archivo, admin.id)).rejects.toBeInstanceOf(BadRequestException);
    expect(await prisma.cliente.count({ where: { creadoPorId: admin.id } })).toBe(1);
    expect(await prisma.prestamo.count({ where: { creadoPorId: admin.id } })).toBe(1);
    expect(await prisma.cuota.count({ where: { prestamoId: credito.id } })).toBe(5);
    expect((await prisma.producto.findUniqueOrThrow({ where: { id: producto.id } })).stock).toBe(0);
    expect(await prisma.transaccion.count({ where: { creadoPorId: admin.id } })).toBe(0);
    expect(await prisma.journalEntry.count({ where: { createdBy: admin.id } })).toBe(0);
    const reversion = await servicio.revertirLote(primerLote.loteId, { usuarioId: admin.id });
    expect(reversion).toMatchObject({ prestamosEliminados: 1, stockDevuelto: 0, asientosReversados: 0, transaccionesReversadas: 0 });
    expect((await prisma.producto.findUniqueOrThrow({ where: { id: producto.id } })).stock).toBe(0);
    await expect(servicio.revertirLote(primerLote.loteId, { usuarioId: admin.id })).rejects.toBeInstanceOf(BadRequestException);

    await prisma.producto.update({ where: { id: producto.id }, data: { activo: true, stock: 2 } });
    await prisma.precioProducto.create({ data: { productoId: producto.id, meses: 2, precio: 550000 } });
    const caja = await prisma.caja.upsert({
      where: { codigo: 'CAJA-OFICINA' },
      create: { codigo: 'CAJA-OFICINA', nombre: 'Caja de prueba', tipo: 'PRINCIPAL', responsableId: admin.id },
      update: {},
    });
    clientes.getCell('F6').value = 'Teléfono';
    clientes.getRow(7).values = ['OPERATIVO', '4712345678', 'Persona', ruta.codigo, 'De prueba', '3000000000'];
    creditos.getRow(7).values = [`${numero}-OP`, '4712345678', producto.codigo, '2026-01-10',
      '2026-01-17', 'OPERATIVA', 2, 'SEMANAL', null, 100000];
    const operativo = Buffer.from(await libro.xlsx.writeBuffer());
    const archivoOperativo = { ...archivo, buffer: operativo, size: operativo.length };
    expect((await servicio.validarClientesCreditos(archivoOperativo)).errores).toEqual([]);
    const segundoLote = await servicio.confirmarClientesCreditos(archivoOperativo, admin.id);
    expect(segundoLote).toMatchObject({ creditosOperativosCreados: 1, articulosDescontados: 1, asientosCreados: 1 });
    expect((await prisma.producto.findUniqueOrThrow({ where: { id: producto.id } })).stock).toBe(1);
    expect(Number((await prisma.caja.findUniqueOrThrow({ where: { id: caja.id } })).saldoActual)).toBe(Number(caja.saldoActual) + 100000);
    expect(await servicio.revertirLote(segundoLote.loteId, { usuarioId: admin.id })).toMatchObject({ stockDevuelto: 1, asientosReversados: 1 });
    expect((await prisma.producto.findUniqueOrThrow({ where: { id: producto.id } })).stock).toBe(2);
    expect(Number((await prisma.caja.findUniqueOrThrow({ where: { id: caja.id } })).saldoActual)).toBe(Number(caja.saldoActual));
  }, 30_000);
});
