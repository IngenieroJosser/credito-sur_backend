import * as ExcelJS from 'exceljs';
import {
  ResultadoValidacion,
  ErrorValidacion,
  AdvertenciaValidacion,
  ResumenHoja,
} from '../dto/validacion-resultado.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { loadWorkbookFromBuffer } from './xlsx-workbook.loader';

const DATA_START_ROW = 7;

const SHEETS = {
  articulos: ['Artículos', 'Articulos'],
  precios: ['Precios'],
};

const SHEET_DISPLAY = {
  articulos: 'Artículos',
  precios: 'Precios',
};

function getWorksheetByAliases(
  workbook: ExcelJS.Workbook,
  aliases: string[],
): ExcelJS.Worksheet | undefined {
  return aliases
    .map((name) => workbook.getWorksheet(name))
    .find(Boolean);
}

function parseNumberCell(value: any): number | null {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export class InventarioParser {
  constructor(private readonly prisma: PrismaService) {}

  async parseAndValidate(
    buffer: Buffer,
    fileName: string,
  ): Promise<ResultadoValidacion> {
    const workbook = await loadWorkbookFromBuffer(buffer);

    const errores: ErrorValidacion[] = [];
    const advertencias: AdvertenciaValidacion[] = [];
    const articulosValidar: any[] = [];
    const preciosValidar: any[] = [];
    const porHoja: Record<string, ResumenHoja> = {};

    let totalFilas = 0;
    let filasConError = 0;

    // Verificar hojas requeridas
    const hojaArticulos = getWorksheetByAliases(workbook, SHEETS.articulos);
    const hojaPrecios = getWorksheetByAliases(workbook, SHEETS.precios);

    if (!hojaArticulos || !hojaPrecios) {
      errores.push({
        hoja: 'GLOBAL',
        fila: 0,
        campo: 'Hojas',
        mensaje: 'Faltan hojas requeridas. Se requiere la hoja "Artículos" y la hoja "Precios". Descargue nuevamente la plantilla oficial.',
        valor: '',
      });
      return {
        tipo: 'inventario',
        archivo: fileName,
        resumen: {
          totalFilas: 0,
          filasValidas: 0,
          filasConError: 1,
          advertencias: 0,
          porHoja: {},
        },
        errores,
        advertencias,
      };
    }

    const normalizeUpper = (value: any) => String(value ?? '').trim().toUpperCase();
    const normalizeCode = (value: any) => String(value ?? '').trim().toUpperCase();

    // --- Validar ARTICULOS ---
    let totalArticulos = 0;
    let articulosConError = 0;
    const codigosArticulos = new Set<string>();

    hojaArticulos.eachRow((row, rowNumber) => {
      if (rowNumber < DATA_START_ROW) return; // Cabeceras y explicaciones

      const values = Array.isArray(row.values) ? row.values.slice(1) : Object.values(row.values || {}).slice(1);
      const filaVacia = values.every((v) => v === undefined || v === null || String(v).trim() === '');
      if (filaVacia) return; // Ignorar filas vacías

      totalFilas++;
      totalArticulos++;
      let tieneError = false;

      const accion = normalizeUpper(row.getCell(1).value);
      const codigo = normalizeCode(row.getCell(2).value);
      const nombre = String(row.getCell(3).value || '').trim();
      const descripcion = String(row.getCell(4).value || '').trim();
      const categoria = String(row.getCell(5).value || '').trim();
      const marca = String(row.getCell(6).value || '').trim();
      const modelo = String(row.getCell(7).value || '').trim();
      const costo = parseNumberCell(row.getCell(8).value);
      const stock = parseNumberCell(row.getCell(9).value);
      const stockMinimo = parseNumberCell(row.getCell(10).value);
      const activo = normalizeUpper(row.getCell(11).value);

      const addError = (campo: string, mensaje: string, valor: any) => {
        errores.push({ hoja: SHEET_DISPLAY.articulos, fila: rowNumber, campo, mensaje, valor });
        tieneError = true;
      };

      if (accion !== 'CREAR') addError('accion', 'Solo se permite CREAR', accion);
      if (!codigo) addError('codigo', 'Es requerido', codigo);
      else if (codigosArticulos.has(codigo)) addError('codigo', 'Duplicado en el archivo', codigo);
      else codigosArticulos.add(codigo);

      if (!nombre) addError('nombre', 'Es requerido', nombre);
      if (!categoria) addError('categoria', 'Es requerida', categoria);

      if (costo === null || costo < 0) addError('costo', 'Debe ser mayor o igual a 0', row.getCell(8).value);
      if (stock === null || stock < 0) addError('stock', 'Debe ser mayor o igual a 0', row.getCell(9).value);
      if (stockMinimo === null || stockMinimo < 0) addError('stock_minimo', 'Debe ser mayor o igual a 0', row.getCell(10).value);
      if (activo !== 'SI' && activo !== 'NO') addError('activo', 'Debe ser SI o NO', activo);

      if (tieneError) {
        filasConError++;
        articulosConError++;
      } else {
        articulosValidar.push({
          codigo,
          nombre,
          descripcion,
          categoria,
          marca,
          modelo,
          costo,
          stock,
          stockMinimo,
          activo,
          fila: rowNumber,
        });
      }
    });

    porHoja[SHEET_DISPLAY.articulos] = {
      totalFilas: totalArticulos,
      filasValidas: totalArticulos - articulosConError,
      filasConError: articulosConError,
    };

    // Consultar códigos en BD para validación de precios si no están en la hoja
    const codigosBD = new Set(
      (
        await this.prisma.producto.findMany({
          where: { eliminadoEn: null },
          select: { codigo: true },
        })
      ).map((p) => normalizeCode(p.codigo)),
    );

    // --- Validar PRECIOS ---
    let totalPrecios = 0;
    let preciosConError = 0;
    const combinacionesPrecios = new Set<string>();

    hojaPrecios.eachRow((row, rowNumber) => {
      if (rowNumber < DATA_START_ROW) return; // Cabeceras y explicaciones

      const values = Array.isArray(row.values) ? row.values.slice(1) : Object.values(row.values || {}).slice(1);
      const filaVacia = values.every((v) => v === undefined || v === null || String(v).trim() === '');
      if (filaVacia) return; // Ignorar filas vacías

      totalFilas++;
      totalPrecios++;
      let tieneError = false;

      const codigoProducto = normalizeCode(row.getCell(1).value);
      const meses = parseNumberCell(row.getCell(2).value);
      const precio = parseNumberCell(row.getCell(3).value);
      const activo = normalizeUpper(row.getCell(4).value);

      const addError = (campo: string, mensaje: string, valor: any) => {
        errores.push({ hoja: SHEET_DISPLAY.precios, fila: rowNumber, campo, mensaje, valor });
        tieneError = true;
      };

      if (!codigoProducto) addError('codigo_producto', 'Es requerido', codigoProducto);
      else if (!codigosArticulos.has(codigoProducto) && !codigosBD.has(codigoProducto)) {
        addError('codigo_producto', 'El producto no existe en la hoja Artículos ni en la base de datos', codigoProducto);
      }

      if (meses === null || meses <= 0) addError('meses', 'Debe ser mayor a 0', row.getCell(2).value);
      if (precio === null || precio <= 0) addError('precio', 'Debe ser mayor a 0', row.getCell(3).value);
      
      const combinacion = `${codigoProducto}-${meses}`;
      if (codigoProducto && meses !== null && meses > 0) {
        if (combinacionesPrecios.has(combinacion)) {
            addError('meses', 'Duplicado para este producto (ya existe este mes)', meses);
        } else {
            combinacionesPrecios.add(combinacion);
        }
      }

      if (activo !== 'SI' && activo !== 'NO') addError('activo', 'Debe ser SI o NO', activo);

      if (tieneError) {
        filasConError++;
        preciosConError++;
      } else {
        preciosValidar.push({ codigoProducto, meses, precio, activo, fila: rowNumber });
      }
    });

    porHoja[SHEET_DISPLAY.precios] = {
      totalFilas: totalPrecios,
      filasValidas: totalPrecios - preciosConError,
      filasConError: preciosConError,
    };

    return {
      tipo: 'inventario',
      archivo: fileName,
      resumen: {
        totalFilas,
        filasValidas: totalFilas - filasConError,
        filasConError,
        advertencias: advertencias.length,
        porHoja,
      },
      articulos: articulosValidar,
      precios: preciosValidar,
      errores,
      advertencias,
    };
  }
}
