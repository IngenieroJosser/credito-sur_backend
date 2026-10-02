import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ImportacionesService } from './importaciones.service';
import { generarPlantillaInventario } from './plantillas/plantilla-inventario';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../accounting/ledger.service';
import { NotificacionesGateway } from '../notificaciones/notificaciones.gateway';

/**
 * La importación de inventario contra una base de datos DE VERDAD.
 *
 * Por qué hace falta, teniendo ya pruebas del parser: el parser dice qué se MANDARÍA
 * guardar. Entre eso y lo que queda guardado hay una transacción, un esquema con sus
 * restricciones y unas cuantas conversiones de tipo, y ahí es donde se pierden los pesos.
 * Ninguna prueba del repositorio cruzaba esa frontera: todas usan un doble de Prisma.
 *
 * Y hacía falta ahora en particular porque la fórmula del precio acaba de cambiar entera
 * y los precios suben alrededor de un 10%. Lo que se comprueba aquí es que el número que
 * cartera tiene en su hoja es, al peso, el que queda en la columna de la base.
 *
 * ── Dónde escribe ──────────────────────────────────────────────────────────────────────
 * En `credito_sur_test`, NUNCA en `credito_sur`. La URL se arma aquí sobre la de `.env`
 * cambiando solo el nombre de la base, y si el nombre resultante no termina en `_test` la
 * prueba se niega a arrancar. Borra lo que crea al terminar.
 *
 * Para prepararla:
 *     node -e "...CREATE DATABASE credito_sur_test..."
 *     DATABASE_URL=...credito_sur_test npx prisma migrate deploy --schema src/prisma/schema.prisma
 *
 * Si la base no está, las pruebas se SALTAN con un aviso en vez de fallar: no todo el
 * mundo que corre la suite tiene un Postgres al lado.
 */

const urlDePruebas = (): string | null => {
  try {
    const env = readFileSync(join(__dirname, '..', '..', '.env'), 'utf8');
    const url = env.match(/postgresql:\/\/[^\s"'\r\n]*/)?.[0];
    if (!url) return null;
    const dedicada = url.replace(/\/credito_sur(\?|$)/, '/credito_sur_test$1');
    // Cinturón: si el reemplazo no funcionó, no se escribe en la base de desarrollo.
    if (!/\/credito_sur_test(\?|$)/.test(dedicada)) return null;
    return dedicada;
  } catch {
    return null;
  }
};

const URL_PRUEBAS = urlDePruebas();

/** Artículos reales de cartera, uno por cada divisor que usan. */
const ARTICULOS = (
  JSON.parse(
    readFileSync(join(__dirname, '__fixtures__', 'precios-cartera.json'), 'utf8'),
  ) as Array<{
    costo: number;
    divisor: number;
    contado: number;
    plazos: Array<{ meses: number; precio: number }>;
  }>
)
  .filter((a) => a.plazos.length === 3)
  .filter(
    (a, _i, todos) =>
      todos.findIndex((otro) => otro.divisor === a.divisor) === todos.indexOf(a),
  )
  .slice(0, 12);

const CODIGO = (i: number) => `TEST-INTEG-${i}`;
const CATEGORIA = 'TEST-INTEG-CATEGORIA';

describe('Importar inventario contra la base de datos real', () => {
  let prisma: PrismaClient;
  let servicio: ImportacionesService;
  let usuarioId: string;

  const hayBase = !!URL_PRUEBAS;

  beforeAll(async () => {
    if (!hayBase) return;

    // Prisma 7 pide un adaptador: no acepta una URL suelta.
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: URL_PRUEBAS! }),
    });
    await prisma.$connect();

    // El ledger y el gateway no participan en la importación de inventario —solo en la de
    // créditos—, así que van como dobles mudos. Prisma, en cambio, es el de verdad: es
    // justo lo que esta prueba viene a ejercitar.
    servicio = new ImportacionesService(
      prisma as unknown as PrismaService,
      { registrar: jest.fn() } as unknown as LedgerService,
      { emitirATodos: jest.fn(), emitir: jest.fn() } as unknown as NotificacionesGateway,
    );

    const usuario = await prisma.usuario.create({
      data: {
        nombres: 'Integración',
        apellidos: 'Pruebas',
        correo: `integracion-${Date.now()}@test.local`,
        hashContrasena: 'no-se-usa',
        rol: 'SUPER_ADMINISTRADOR',
      },
    });
    usuarioId = usuario.id;
  }, 120000);

  afterAll(async () => {
    if (!hayBase || !prisma) return;
    // Se limpia lo creado, para poder volver a correrla sin arrastrar nada.
    const codigos = ARTICULOS.map((_, i) => CODIGO(i));
    const productos = await prisma.producto.findMany({
      where: { codigo: { in: codigos } },
      select: { id: true },
    });
    const ids = productos.map((p) => p.id);
    if (ids.length) {
      await prisma.precioProducto.deleteMany({ where: { productoId: { in: ids } } });
      await prisma.producto.deleteMany({ where: { id: { in: ids } } });
    }
    // El lote de importación apunta al usuario que lo subió, así que va primero: si no,
    // el borrado choca contra `importaciones_lotes_creadoPorId_fkey`.
    await prisma.importacionLote.deleteMany({ where: { creadoPorId: usuarioId } });
    await prisma.usuario.deleteMany({ where: { id: usuarioId } });
    await prisma.$disconnect();
  }, 120000);

  /** Rellena la plantilla real con los artículos de cartera y la deja como un upload. */
  const archivoConArticulos = async (): Promise<Express.Multer.File> => {
    const { data } = await generarPlantillaInventario();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(data as never);
    const hoja = wb.getWorksheet('Artículos')!;

    const columnas = new Map<string, number>();
    hoja.getRow(6).eachCell({ includeEmpty: false }, (celda, numero) => {
      columnas.set(
        String(celda.value ?? '')
          .replace(/\*/g, '')
          .trim()
          .toUpperCase(),
        numero,
      );
    });
    const poner = (fila: number, encabezado: string, valor: string | number) => {
      const col = columnas.get(encabezado.toUpperCase());
      if (!col) throw new Error(`La hoja no tiene la columna "${encabezado}"`);
      hoja.getCell(fila, col).value = valor;
    };

    ARTICULOS.forEach((art, i) => {
      const f = 7 + i;
      poner(f, 'Acción', 'CREAR');
      poner(f, 'Código', CODIGO(i));
      poner(f, 'Nombre del artículo', `Artículo de integración ${i}`);
      poner(f, 'Categoría', CATEGORIA);
      poner(f, 'Costo unitario', art.costo);
      poner(f, 'Divisor del precio', art.divisor);
      art.plazos.forEach((plazo, j) => {
        poner(f, `Meses opción ${j + 1}`, plazo.meses);
      });
    });

    const buffer = await wb.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(buffer),
      originalname: 'inventario-integracion.xlsx',
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: Buffer.from(buffer).length,
    } as Express.Multer.File;
  };

  const describirSiHayBase = hayBase ? describe : describe.skip;

  describirSiHayBase('con la base de pruebas levantada', () => {
    let resultado: Awaited<ReturnType<ImportacionesService['confirmarInventario']>>;

    beforeAll(async () => {
      resultado = await servicio.confirmarInventario(
        await archivoConArticulos(),
        usuarioId,
      );
    }, 180000);

    it('la importación termina sin rechazar ninguna fila', () => {
      expect(resultado.articulosCreados).toBe(ARTICULOS.length);
      expect(resultado.articulosOmitidos).toBe(0);
    });

    it('los artículos quedan guardados, con su costo', async () => {
      const guardados = await prisma.producto.findMany({
        where: { codigo: { in: ARTICULOS.map((_, i) => CODIGO(i)) } },
        select: { codigo: true, costo: true },
      });

      expect(guardados).toHaveLength(ARTICULOS.length);
      for (const [i, art] of ARTICULOS.entries()) {
        const guardado = guardados.find((g) => g.codigo === CODIGO(i));
        // El costo se guarda en pesos enteros: la hoja puede traer centavos.
        expect({ codigo: CODIGO(i), costo: Number(guardado?.costo) }).toEqual({
          codigo: CODIGO(i),
          costo: Math.trunc(art.costo),
        });
      }
    }, 60000);

    /**
     * El corazón de la prueba: los pesos que cartera tiene en su hoja, leídos de la
     * columna de la base. Se tolera un peso por el ruido de coma flotante que ya está
     * medido en `precios-cartera.spec.ts`; dos sería otra fórmula.
     */
    it('los precios de la base son los de cartera, al peso', async () => {
      const desviados: string[] = [];

      for (const [i, art] of ARTICULOS.entries()) {
        const producto = await prisma.producto.findFirst({
          where: { codigo: CODIGO(i) },
          select: { id: true, precios: { select: { meses: true, precio: true } } },
        });

        const esperados = [{ meses: 0, precio: art.contado }, ...art.plazos];
        for (const { meses, precio } of esperados) {
          const enBase = producto?.precios.find((p) => p.meses === meses)?.precio;
          const real = enBase === undefined ? undefined : Number(enBase);
          if (real === undefined || Math.abs(real - precio) > 1) {
            desviados.push(
              `${CODIGO(i)} a ${meses}m: cartera ${precio}, base ${String(real)}`,
            );
          }
        }
      }

      expect(desviados).toEqual([]);
    }, 120000);

    it('cada artículo guarda su precio de contado y sus tres plazos', async () => {
      const productos = await prisma.producto.findMany({
        where: { codigo: { in: ARTICULOS.map((_, i) => CODIGO(i)) } },
        select: { codigo: true, precios: { select: { meses: true } } },
      });

      for (const producto of productos) {
        const meses = producto.precios.map((p) => p.meses).sort((a, b) => a - b);
        // Cuatro: el contado (0 meses) y los tres plazos. Ni uno de más —la plantilla trae
        // los plazos puestos y podría colar opciones que nadie pactó— ni de menos.
        expect({ codigo: producto.codigo, meses }).toEqual({
          codigo: producto.codigo,
          meses: [0, 3, 5, 8],
        });
      }
    }, 60000);

    it('importar el mismo archivo otra vez no duplica artículos', async () => {
      // La hoja dice CREAR, así que la segunda pasada encuentra los códigos ya creados.
      // Lo que no puede pasar es que queden dos productos con el mismo código.
      await servicio.confirmarInventario(await archivoConArticulos(), usuarioId);

      const porCodigo = await prisma.producto.groupBy({
        by: ['codigo'],
        where: { codigo: { in: ARTICULOS.map((_, i) => CODIGO(i)) } },
        _count: { codigo: true },
      });

      const duplicados = porCodigo.filter((g) => g._count.codigo > 1);
      expect(duplicados).toEqual([]);
    }, 180000);
  });

  it('avisa si la base de pruebas no está disponible', () => {
    if (!hayBase) {
      console.warn(
        'Las pruebas de integración se saltaron: no se pudo armar la URL de credito_sur_test.',
      );
    }
    expect(true).toBe(true);
  });
});
