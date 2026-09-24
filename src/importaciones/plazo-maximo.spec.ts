// Los decoradores del DTO lo necesitan, y ninguna otra prueba valida un DTO,
// asi que no hay un setup de jest que ya lo cargue.
import 'reflect-metadata';
import * as ExcelJS from 'exceljs';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { MAX_MESES_PLAZO } from '../common/plazos';
import { CreateInventoryDto } from '../inventory/dto/create-inventory.dto';
import {
  columnasDeOpcion,
  generarPlantillaInventario,
} from './plantillas/plantilla-inventario';

/**
 * El negocio financia hasta tres meses, y hasta ahora eso no estaba escrito en
 * ninguna parte del código.
 *
 * El DTO solo pedía `@Min(1)`, el parser del importador solo pedía que los
 * meses fueran mayores a 0, y los formularios ofrecían una lista de hasta 24
 * meses. Por eso en la base de desarrollo hay precios a 6 y a 12 meses. Estas
 * pruebas cierran las tres puertas por las que entraban.
 *
 * Ojo con el nombre parecido: `MAX_OPCIONES_PLAZO` cuenta cuántas opciones de
 * precio caben en una fila de la plantilla, no cuántos meses dura un plazo.
 */

const articuloValido = (meses: number) => ({
  codigo: 'ART-1',
  nombre: 'Nevera',
  costo: 480000,
  stock: 1,
  stockMinimo: 0,
  precios: [{ meses, precio: 690000 }],
});

const erroresDe = async (dto: object) => {
  const instancia = plainToInstance(CreateInventoryDto, dto);
  const errores = await validate(instancia, {
    whitelist: true,
    forbidNonWhitelisted: false,
  });
  // Los errores de los elementos del arreglo llegan anidados.
  const planos: string[] = [];
  const recorrer = (lista: any[]) => {
    for (const e of lista) {
      if (e.constraints) planos.push(...Object.values<string>(e.constraints));
      if (e.children?.length) recorrer(e.children);
    }
  };
  recorrer(errores);
  return planos;
};

describe('El plazo de un crédito de artículo no pasa de tres meses', () => {
  it('la constante vale 3', () => {
    // Si alguien la sube, que sea a propósito y no de refilón.
    expect(MAX_MESES_PLAZO).toBe(3);
  });

  describe('por la API de inventario', () => {
    it.each([1, 2, 3])('acepta un plazo de %i mes(es)', async (meses) => {
      const mensajes = await erroresDe(articuloValido(meses));
      expect(mensajes.join(' | ')).not.toContain('plazo');
    });

    it.each([4, 6, 12, 24])('rechaza un plazo de %i meses', async (meses) => {
      const mensajes = await erroresDe(articuloValido(meses));
      expect(mensajes).toContain('El plazo no puede pasar de 3 meses');
    });

    it('sigue rechazando el 0 y los negativos, que ya estaban prohibidos', async () => {
      // El precio de contado se manda por `precioContado`, no como un plazo de
      // 0 meses: este camino nunca aceptó el 0 y no se toca.
      for (const meses of [0, -1]) {
        expect((await erroresDe(articuloValido(meses))).length).toBeGreaterThan(
          0,
        );
      }
    });
  });

  describe('por la plantilla de Excel', () => {
    it('la casilla de meses avisa antes de subir el archivo', async () => {
      // Quien llena mil filas con un plazo de 12 meses prefiere enterarse en la
      // primera, no después de subir el archivo entero.
      const { data } = await generarPlantillaInventario();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(data as any);
      const ws = wb.getWorksheet('Artículos')!;

      const columnaMeses = columnasDeOpcion(1).meses;
      const validacion = ws.getCell(7, columnaMeses).dataValidation;

      expect(validacion).toEqual(
        expect.objectContaining({
          type: 'whole',
          operator: 'between',
          formulae: [1, MAX_MESES_PLAZO],
        }),
      );
      expect((validacion as any).error).toContain('hasta 3 meses');
    }, 60000);

    it('las tres opciones de plazo la llevan, no solo la primera', async () => {
      const { data } = await generarPlantillaInventario();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(data as any);
      const ws = wb.getWorksheet('Artículos')!;

      for (const opcion of [1, 2, 3]) {
        const celda = ws.getCell(7, columnasDeOpcion(opcion).meses);
        expect({
          opcion,
          tope: (celda.dataValidation as any)?.formulae,
        }).toEqual({ opcion, tope: [1, MAX_MESES_PLAZO] });
      }
    }, 60000);
  });
});
