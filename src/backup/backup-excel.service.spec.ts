import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as ExcelJS from 'exceljs';
import { BackupExcelService } from './backup-excel.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * El respaldo en Excel: lo único a lo que se acude para recuperar datos.
 *
 * Por qué existe este archivo: `backup-excel.service.ts` son 1 495 líneas y no
 * tenía ninguna prueba. En `backup.service.spec.ts` va mockeado, así que lo que
 * de verdad escribe en el archivo no lo comprobaba nadie.
 *
 * No se mockea ExcelJS: la prueba genera el .xlsx de verdad en una carpeta
 * temporal y lo vuelve a leer. Es la única forma de comprobar lo que importa
 * —qué dice la celda—, porque entre el dato y la celda están el formateo de
 * fechas, la coerción de números y el orden de las columnas, que es justo donde
 * estaban los fallos.
 *
 * Las 17 consultas van contra un doble que devuelve `[]` por omisión, y cada
 * prueba declara solo la tabla que le interesa.
 */
describe('BackupExcelService', () => {
  let servicio: BackupExcelService;
  let prisma: Record<string, { findMany: jest.Mock }>;
  let carpeta: string;
  let archivo: string;

  /** Las tablas que recorre el respaldo, en el orden en que crea las hojas. */
  const TABLAS = [
    'cliente',
    'prestamo',
    'cuota',
    'pago',
    'detallePago',
    'ruta',
    'asignacionRuta',
    'caja',
    'transaccion',
    'gasto',
    'producto',
    'precioProducto',
    'aprobacion',
    'extensionPago',
    'usuario',
    'registroAuditoria',
  ];

  beforeEach(async () => {
    prisma = {};
    for (const tabla of TABLAS) {
      prisma[tabla] = { findMany: jest.fn().mockResolvedValue([]) };
    }

    servicio = new BackupExcelService(prisma as unknown as PrismaService);

    carpeta = await mkdtemp(join(tmpdir(), 'respaldo-prueba-'));
    // En una subcarpeta a propósito: el servicio tiene que crearla.
    archivo = join(carpeta, 'sin', 'crear', 'respaldo.xlsx');
  });

  afterEach(async () => {
    await rm(carpeta, { recursive: true, force: true });
  });

  /** Abre el .xlsx que acaba de escribirse y devuelve la hoja pedida. */
  const hojaDe = async (nombre: string) => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(archivo);
    const ws = wb.getWorksheet(nombre);
    if (!ws) throw new Error(`El respaldo no trae la hoja "${nombre}"`);
    return ws;
  };

  /**
   * La fila de datos número `n` (1 = la primera) de una hoja.
   *
   * Localiza el encabezado por el texto de su primera celda en vez de contar
   * filas fijas: así no se ata a cuántas filas de título lleva la plantilla.
   */
  const filaDeDatos = (
    ws: ExcelJS.Worksheet,
    primerEncabezado: string,
    n: number,
  ) => {
    let encabezado = 0;
    for (let i = 1; i <= ws.rowCount; i++) {
      if (String(ws.getRow(i).getCell(1).value ?? '') === primerEncabezado) {
        encabezado = i;
        break;
      }
    }
    if (!encabezado) {
      throw new Error(`No se encontró el encabezado "${primerEncabezado}"`);
    }
    return ws.getRow(encabezado + n);
  };

  const UN_CLIENTE = {
    codigo: 'CLI-001',
    nombres: 'Ana',
    apellidos: 'Pérez',
    dni: '1098765432',
    telefono: '3001234567',
    correo: 'ana@test.local',
    direccion: 'Calle 1',
    nivelRiesgo: 'VERDE',
    estadoAprobacion: 'APROBADO',
    enListaNegra: false,
    puntaje: 80,
    categoria: { nombre: 'Celulares' },
    creadoEn: new Date('2026-10-13T20:30:00-05:00'),
  };

  it('escribe el archivo, creando la carpeta que falte', async () => {
    const resultado = await servicio.exportSnapshotToXlsx(archivo);

    expect(resultado.filePath).toBe(archivo);
    const info = await stat(archivo);
    expect(info.size).toBeGreaterThan(0);
    expect(resultado.fileSize).toBe(info.size);
  });

  it('con la base vacía produce un archivo válido, no un error', async () => {
    // Es el caso de un respaldo recién instalado, y tambien el de una tabla que
    // se queda sin filas: el archivo tiene que seguir abriéndose.
    await servicio.exportSnapshotToXlsx(archivo);

    const ws = await hojaDe('Clientes');
    expect(ws.rowCount).toBeGreaterThan(0);
  });

  it('cuenta las filas de cada hoja', async () => {
    prisma.cliente.findMany.mockResolvedValue([UN_CLIENTE, UN_CLIENTE]);

    const { sheets } = await servicio.exportSnapshotToXlsx(archivo);

    expect(sheets['Clientes']).toBe(2);
  });

  it('consulta TODAS las tablas: ninguna hoja se queda sin su fuente', async () => {
    // Si una consulta se perdiera en una edición, su hoja saldría vacía y el
    // respaldo seguiría pareciendo correcto: mismo archivo, mismas hojas, sin un
    // error a la vista.
    await servicio.exportSnapshotToXlsx(archivo);

    for (const tabla of TABLAS) {
      expect(prisma[tabla].findMany).toHaveBeenCalled();
    }
  });

  it('no incluye los registros borrados', async () => {
    await servicio.exportSnapshotToXlsx(archivo);

    expect(prisma.cliente.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ eliminadoEn: null }),
      }),
    );
  });

  describe('las fechas van en hora de Bogotá', () => {
    // El servidor corre en UTC y Bogotá es UTC-5: desde las 7 de la noche de
    // Bogotá, en UTC ya es el día siguiente. Los formateadores del respaldo
    // estaban escritos a mano con `d.getDate()` —el reloj del proceso— y fechaban
    // un día DESPUÉS todo lo registrado de noche. En una máquina en hora de
    // Colombia no se ve, y lo que se fecha mal aquí son movimientos de dinero.
    //
    // LÍMITE DE ESTAS PRUEBAS, comprobado saboteando el código: en una máquina
    // en hora de Colombia (UTC-5, la misma que Bogotá) el código viejo da el
    // resultado CORRECTO, así que estas tres pasan igual y no cazan la
    // regresión. Con `TZ=UTC` sí falla: "14/10/2026 01:30:00". O sea que
    // protegen en el servidor y en CI, no en el portátil de quien programa.
    //
    // Lo que sí caza el patrón en cualquier reloj es
    // `src/utils/fechas-siempre-en-bogota.spec.ts`, que lee el código fuente.
    // Las dos cosas se complementan: una comprueba la celda, la otra el hábito.

    it('un cliente creado de noche conserva su día', async () => {
      prisma.cliente.findMany.mockResolvedValue([UN_CLIENTE]);

      await servicio.exportSnapshotToXlsx(archivo);

      const ws = await hojaDe('Clientes');
      // 'Creado En' es la última columna de la hoja (Q).
      const celda = String(
        filaDeDatos(ws, 'Código', 1).getCell(17).value ?? '',
      );

      expect(celda).toContain('13/10/2026');
      // En UTC ese instante ya es el 14: así salía antes.
      expect(UN_CLIENTE.creadoEn.toISOString()).toContain('2026-10-14');
      expect(celda).not.toContain('14/10/2026');
    });

    it('lleva la hora, con segundos', async () => {
      // Con segundos a propósito: dos movimientos del mismo minuto hay que poder
      // distinguirlos al revisar el respaldo.
      prisma.cliente.findMany.mockResolvedValue([UN_CLIENTE]);

      await servicio.exportSnapshotToXlsx(archivo);

      const ws = await hojaDe('Clientes');
      const celda = String(
        filaDeDatos(ws, 'Código', 1).getCell(17).value ?? '',
      );

      expect(celda).toBe('13/10/2026 20:30:00');
    });

    it('una fecha ausente deja la celda vacía, no "Invalid Date"', async () => {
      prisma.cliente.findMany.mockResolvedValue([
        { ...UN_CLIENTE, creadoEn: null },
      ]);

      await servicio.exportSnapshotToXlsx(archivo);

      const ws = await hojaDe('Clientes');
      const celda = filaDeDatos(ws, 'Código', 1).getCell(17).value;

      expect(String(celda ?? '')).toBe('');
    });
  });

  it('el puntaje va como número, para que Excel pueda operarlo', async () => {
    // Si saliera como texto, cualquier suma o filtro numérico en la hoja daría
    // cero sin avisar.
    prisma.cliente.findMany.mockResolvedValue([UN_CLIENTE]);

    await servicio.exportSnapshotToXlsx(archivo);

    const ws = await hojaDe('Clientes');
    expect(typeof filaDeDatos(ws, 'Código', 1).getCell(15).value).toBe(
      'number',
    );
  });

  describe('la hoja de Créditos', () => {
    const UN_CREDITO = {
      numeroPrestamo: 'PRES-000001',
      cliente: { nombres: 'Ana', apellidos: 'Pérez', dni: '1098765432' },
      tipoPrestamo: 'PRESTAMO_EFECTIVO',
      estado: 'ACTIVO',
      estadoAprobacion: 'APROBADO',
      frecuenciaPago: 'MENSUAL',
      // Prisma entrega los campos Decimal como objeto, no como number: al
      // respaldo llegan así y tienen que acabar en la celda como número.
      monto: '600000',
      tasaInteres: '20',
      plazoMeses: 3,
      cantidadCuotas: 3,
      interesTotal: '120000',
      saldoPendiente: '720000',
      totalPagado: '0',
      fechaInicio: new Date('2026-10-13T20:30:00-05:00'),
      fechaPrimerCobro: null,
      fechaFin: null,
      creadoEn: new Date('2026-10-13T20:30:00-05:00'),
    };

    it('el monto va como número, para que Excel pueda sumarlo', async () => {
      // Prisma lo entrega como Decimal. Si cayera a la celda como texto,
      // cualquier suma o filtro numérico de la hoja daría cero sin avisar.
      prisma.prestamo.findMany.mockResolvedValue([UN_CREDITO]);

      await servicio.exportSnapshotToXlsx(archivo);

      const ws = await hojaDe('Créditos');
      const celda = filaDeDatos(ws, 'N° Crédito', 1).getCell(8).value;
      expect(typeof celda).toBe('number');
      expect(celda).toBe(600000);
    });

    it('la fecha de inicio va en día de Bogotá y SIN hora', async () => {
      // Esta columna usa el otro formateador, el de solo fecha. Tenía el mismo
      // fallo del reloj del proceso.
      prisma.prestamo.findMany.mockResolvedValue([UN_CREDITO]);

      await servicio.exportSnapshotToXlsx(archivo);

      const ws = await hojaDe('Créditos');
      const celda = String(
        filaDeDatos(ws, 'N° Crédito', 1).getCell(15).value ?? '',
      );
      expect(celda).toBe('13/10/2026');
    });
  });
});
