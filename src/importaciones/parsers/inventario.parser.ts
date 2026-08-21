import * as ExcelJS from 'exceljs';
import {
  ResultadoValidacion,
  ErrorValidacion,
  AdvertenciaValidacion,
  ResumenHoja,
} from '../dto/validacion-resultado.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { loadWorkbookFromBuffer } from './xlsx-workbook.loader';
import { leerNumero, leerTexto, leerTextoMayus } from './cell-value.util';
import {
  avisarFilasFueraDeRango,
  celda,
  construirMapaColumnas,
  filaVaciaEnColumnas,
  FILA_INICIO_DATOS,
} from './header-map.util';

/**
 * Opciones de plazo por artículo que ofrece la plantilla.
 * Tres cubren la operación real y mantienen la hoja legible; más columnas solo
 * agregaban ancho que nadie usaba.
 */
export const MAX_OPCIONES_PLAZO = 3;

/** El precio de contado se guarda como un PrecioProducto con meses = 0. */
export const MESES_CONTADO = 0;

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
  return aliases.map((name) => workbook.getWorksheet(name)).find(Boolean);
}

function normalizeCode(value: any): string {
  return leerTextoMayus(value);
}

/**
 * El sistema maneja pesos enteros (`truncCop` en el backend, `Math.trunc` en el
 * frontend). Si llegan centavos se avisa y se truncan, en vez de guardarlos y
 * perderlos en silencio más adelante.
 */
function tieneCentavos(valor: number | null): boolean {
  return valor !== null && Number.isFinite(valor) && !Number.isInteger(valor);
}

const aPesos = (valor: number | null): number | null =>
  valor === null || !Number.isFinite(valor) ? valor : Math.trunc(valor);

const AVISO_CENTAVOS =
  'El sistema maneja pesos enteros: los centavos se descartaron.';

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

    const hojaArticulos = getWorksheetByAliases(workbook, SHEETS.articulos);
    const hojaPrecios = getWorksheetByAliases(workbook, SHEETS.precios);

    const salidaVacia = (mensaje: string): ResultadoValidacion => {
      errores.push({
        hoja: 'GLOBAL',
        fila: 0,
        campo: 'Hojas',
        mensaje,
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
    };

    if (!hojaArticulos) {
      return salidaVacia(
        'Falta la hoja requerida "Artículos". Descargue nuevamente la plantilla oficial.',
      );
    }

    // Catálogo existente: se usa para avisar de artículos repetidos y para permitir
    // que la hoja de Precios (formato anterior) apunte a productos ya creados.
    const productosBd = await this.prisma.producto.findMany({
      where: { eliminadoEn: null },
      select: { codigo: true, nombre: true },
    });
    const codigosBD = new Map<string, string>(
      productosBd.map((p) => [normalizeCode(p.codigo), p.nombre]),
    );

    // ── Hoja Artículos ──────────────────────────────────────────────────────
    const cols = construirMapaColumnas(hojaArticulos);
    const colAccion = cols.indice('Acción');
    const colCodigo = cols.indice('Código');
    const colNombre = cols.indice('Nombre del artículo', 'Nombre');
    const colDescripcion = cols.indice('Descripción');
    const colCategoria = cols.indice('Categoría');
    const colMarca = cols.indice('Marca');
    const colModelo = cols.indice('Modelo');
    const colCosto = cols.indice('Costo unitario', 'Costo');
    const colPrecioContado = cols.indice('Precio contado', 'Precio de contado');
    const colStock = cols.indice('Stock actual', 'Stock');
    const colStockMinimo = cols.indice('Stock mínimo');
    const colActivo = cols.indice('Activo');
    const colObservaciones = cols.indice('Observaciones');

    if (!colCodigo || !colNombre || !colCosto) {
      return salidaVacia(
        'No se encontraron los encabezados obligatorios (Código, Nombre, Costo) en la fila 6 de la hoja "Artículos". Descargue nuevamente la plantilla oficial.',
      );
    }

    const columnasOpciones: Array<{ meses: number; precio: number }> = [];
    for (let i = 1; i <= MAX_OPCIONES_PLAZO; i++) {
      const colMesesOpcion = cols.indice(`Meses opción ${i}`, `Meses op ${i}`);
      const colPrecioOpcion = cols.indice(
        `Precio total opción ${i}`,
        `Precio opción ${i}`,
        `Precio op ${i}`,
      );
      if (colMesesOpcion && colPrecioOpcion) {
        columnasOpciones.push({
          meses: colMesesOpcion,
          precio: colPrecioOpcion,
        });
      }
    }

    const columnasEntradaArticulos = [
      colAccion,
      colCodigo,
      colNombre,
      colDescripcion,
      colCategoria,
      colMarca,
      colModelo,
      colCosto,
      colPrecioContado,
      colStock,
      colStockMinimo,
      colActivo,
      colObservaciones,
      ...columnasOpciones.flatMap((o) => [o.meses, o.precio]),
    ].filter(Boolean);

    let totalArticulos = 0;
    let articulosConError = 0;
    const codigosArticulos = new Set<string>();
    const filasLeidas: number[] = [];

    hojaArticulos.eachRow((row, rowNumber) => {
      if (rowNumber < FILA_INICIO_DATOS) return;
      if (filaVaciaEnColumnas(row, columnasEntradaArticulos)) return;

      totalFilas++;
      totalArticulos++;
      filasLeidas.push(rowNumber);
      let tieneError = false;

      const accion = leerTextoMayus(celda(row, colAccion)) || 'CREAR';
      const esActualizacion = accion === 'ACTUALIZAR';
      const codigo = normalizeCode(celda(row, colCodigo));
      const nombre = leerTexto(celda(row, colNombre));
      const descripcion = leerTexto(celda(row, colDescripcion));
      const categoria = leerTexto(celda(row, colCategoria));
      const marca = leerTexto(celda(row, colMarca));
      const modelo = leerTexto(celda(row, colModelo));
      const costoCelda = leerNumero(celda(row, colCosto));
      const precioContadoCelda = leerNumero(celda(row, colPrecioContado));
      const costo = aPesos(costoCelda);
      const precioContado = aPesos(precioContadoCelda);
      const stock = leerNumero(celda(row, colStock));
      const stockMinimo = leerNumero(celda(row, colStockMinimo));
      const activo = leerTextoMayus(celda(row, colActivo));

      const addError = (campo: string, mensaje: string, valor: any) => {
        errores.push({
          hoja: SHEET_DISPLAY.articulos,
          fila: rowNumber,
          campo,
          mensaje,
          valor,
        });
        tieneError = true;
      };
      const addAdver = (campo: string, mensaje: string, valor: any) => {
        advertencias.push({
          hoja: SHEET_DISPLAY.articulos,
          fila: rowNumber,
          campo,
          mensaje,
          valor,
        });
      };

      if (accion !== 'CREAR' && accion !== 'ACTUALIZAR') {
        addError(
          'accion',
          'Debe ser CREAR o ACTUALIZAR (o dejarse vacía, que equivale a CREAR)',
          accion,
        );
      }

      if (tieneCentavos(costoCelda)) {
        addAdver('costo', AVISO_CENTAVOS, celda(row, colCosto));
      }
      if (tieneCentavos(precioContadoCelda)) {
        addAdver(
          'precio_contado',
          AVISO_CENTAVOS,
          celda(row, colPrecioContado),
        );
      }

      if (!codigo) {
        addError('codigo', 'Es requerido', codigo);
      } else if (codigosArticulos.has(codigo)) {
        addError('codigo', 'Duplicado en el archivo', codigo);
      } else {
        codigosArticulos.add(codigo);
        const yaExiste = codigosBD.has(codigo);

        if (esActualizacion && !yaExiste) {
          addError(
            'codigo',
            'No hay ningún artículo con este código para actualizar. Use CREAR si es un artículo nuevo.',
            codigo,
          );
        }

        if (!esActualizacion && yaExiste) {
          addAdver(
            'codigo',
            `El artículo ya existe en el sistema ("${codigosBD.get(codigo)}"). No se modificarán sus datos actuales; solo se agregarán las opciones de precio que aún no tenga. Escriba ACTUALIZAR en la columna Acción si quiere corregirlos.`,
            codigo,
          );
        }
      }

      if (!nombre) addError('nombre', 'Es requerido', nombre);
      if (!categoria) addError('categoria', 'Es requerida', categoria);

      if (costo === null || Number.isNaN(costo) || costo < 0) {
        addError(
          'costo',
          'Debe ser un número mayor o igual a 0',
          celda(row, colCosto),
        );
      }
      if (stock !== null && (Number.isNaN(stock) || stock < 0)) {
        addError(
          'stock',
          'Debe ser un número mayor o igual a 0',
          celda(row, colStock),
        );
      }
      if (
        stockMinimo !== null &&
        (Number.isNaN(stockMinimo) || stockMinimo < 0)
      ) {
        addError(
          'stock_minimo',
          'Debe ser un número mayor o igual a 0',
          celda(row, colStockMinimo),
        );
      }
      if (activo && activo !== 'SI' && activo !== 'NO') {
        addError('activo', 'Debe ser SI o NO (o dejarse vacío)', activo);
      }

      const costoValido = costo !== null && !Number.isNaN(costo) ? costo : null;
      const preciosFila: Array<{ meses: number; precio: number }> = [];

      // ── Precio de contado (opción de 0 meses) ─────────────────────────────
      // Todo artículo debe poder venderse de contado, así que el precio es obligatorio.
      if (precioContado === null) {
        addError(
          'precio_contado',
          'Es requerido: todo artículo debe poder venderse de contado',
          celda(row, colPrecioContado),
        );
      } else {
        if (Number.isNaN(precioContado) || precioContado <= 0) {
          addError(
            'precio_contado',
            'Debe ser un número mayor a 0',
            celda(row, colPrecioContado),
          );
        } else {
          preciosFila.push({ meses: MESES_CONTADO, precio: precioContado });
          if (costoValido !== null && precioContado < costoValido) {
            addAdver(
              'precio_contado',
              'El precio de contado es menor que el costo: este artículo se vendería con pérdida.',
              precioContado,
            );
          }
        }
      }

      // ── Opciones de plazo (meses / precio) ────────────────────────────────
      const mesesVistos = new Set<number>();

      columnasOpciones.forEach((opcion, indice) => {
        const numeroOpcion = indice + 1;
        const meses = leerNumero(celda(row, opcion.meses));
        const precioCelda = leerNumero(celda(row, opcion.precio));
        const precio = aPesos(precioCelda);

        if (meses === null && precio === null) return;

        if (tieneCentavos(precioCelda)) {
          addAdver(
            `opcion_${numeroOpcion}_precio`,
            AVISO_CENTAVOS,
            celda(row, opcion.precio),
          );
        }

        if (meses === null || Number.isNaN(meses) || meses <= 0) {
          addError(
            `opcion_${numeroOpcion}_meses`,
            `Opción ${numeroOpcion}: los meses deben ser un número mayor a 0`,
            celda(row, opcion.meses),
          );
          return;
        }

        if (!Number.isInteger(meses)) {
          addError(
            `opcion_${numeroOpcion}_meses`,
            `Opción ${numeroOpcion}: los meses deben ser un número entero`,
            meses,
          );
          return;
        }

        if (precio === null || Number.isNaN(precio) || precio <= 0) {
          addError(
            `opcion_${numeroOpcion}_precio`,
            `Opción ${numeroOpcion}: el precio para ${meses} mes(es) debe ser un número mayor a 0`,
            celda(row, opcion.precio),
          );
          return;
        }

        if (mesesVistos.has(meses)) {
          addError(
            `opcion_${numeroOpcion}_meses`,
            `Opción ${numeroOpcion}: el plazo de ${meses} mes(es) está repetido en este artículo`,
            meses,
          );
          return;
        }

        mesesVistos.add(meses);
        preciosFila.push({ meses, precio });

        if (costoValido !== null && precio < costoValido) {
          addAdver(
            `opcion_${numeroOpcion}_precio`,
            `Opción ${numeroOpcion}: el precio de ${meses} mes(es) es menor que el costo.`,
            precio,
          );
        }
      });

      if (
        !tieneError &&
        columnasOpciones.length > 0 &&
        preciosFila.filter((p) => p.meses > 0).length === 0
      ) {
        addAdver(
          'opciones_plazo',
          'El artículo no tiene ninguna opción de crédito (meses / precio). Solo podrá venderse de contado.',
          codigo,
        );
      }

      if (tieneError) {
        filasConError++;
        articulosConError++;
        return;
      }

      articulosValidar.push({
        accion,
        esActualizacion,
        codigo,
        nombre,
        descripcion,
        categoria,
        marca,
        modelo,
        costo,
        precioContado: precioContado ?? undefined,
        stock: stock ?? 0,
        stockMinimo: stockMinimo ?? 0,
        activo: activo || 'SI',
        observaciones: leerTexto(celda(row, colObservaciones)),
        yaExiste: codigosBD.has(codigo),
        opcionesPrecio: preciosFila.length,
        fila: rowNumber,
      });

      preciosFila.forEach((p) => {
        preciosValidar.push({
          codigoProducto: codigo,
          meses: p.meses,
          precio: p.precio,
          activo: activo === 'NO' ? 'NO' : 'SI',
          utilidad: costoValido !== null ? p.precio - costoValido : null,
          origen: 'ARTICULOS',
          fila: rowNumber,
        });
      });
    });

    const avisoRango = avisarFilasFueraDeRango(
      filasLeidas,
      SHEET_DISPLAY.articulos,
    );
    if (avisoRango) {
      advertencias.push({ hoja: SHEET_DISPLAY.articulos, ...avisoRango });
    }

    porHoja[SHEET_DISPLAY.articulos] = {
      totalFilas: totalArticulos,
      filasValidas: totalArticulos - articulosConError,
      filasConError: articulosConError,
    };

    // ── Hoja Precios (formato anterior; se conserva por compatibilidad) ─────
    if (hojaPrecios) {
      const colsPrecios = construirMapaColumnas(hojaPrecios);
      const colCodigoProducto = colsPrecios.indice('Código producto');
      const colMeses = colsPrecios.indice('Meses');
      const colPrecio = colsPrecios.indice('Precio');
      const colActivoPrecio = colsPrecios.indice('Activo');

      // Solo se procesa cuando trae los encabezados del formato anterior.
      if (colCodigoProducto && colMeses && colPrecio) {
        const columnasEntradaPrecios = [
          colCodigoProducto,
          colMeses,
          colPrecio,
          colActivoPrecio,
        ].filter(Boolean);

        let totalPrecios = 0;
        let preciosConError = 0;
        const combinacionesPrecios = new Set<string>(
          preciosValidar.map((p) => `${p.codigoProducto}-${p.meses}`),
        );

        hojaPrecios.eachRow((row, rowNumber) => {
          if (rowNumber < FILA_INICIO_DATOS) return;
          if (filaVaciaEnColumnas(row, columnasEntradaPrecios)) return;

          totalFilas++;
          totalPrecios++;
          let tieneError = false;

          const codigoProducto = normalizeCode(celda(row, colCodigoProducto));
          const meses = leerNumero(celda(row, colMeses));
          const precio = leerNumero(celda(row, colPrecio));
          const activo = leerTextoMayus(celda(row, colActivoPrecio));

          const addError = (campo: string, mensaje: string, valor: any) => {
            errores.push({
              hoja: SHEET_DISPLAY.precios,
              fila: rowNumber,
              campo,
              mensaje,
              valor,
            });
            tieneError = true;
          };

          if (!codigoProducto) {
            addError('codigo_producto', 'Es requerido', codigoProducto);
          } else if (
            !codigosArticulos.has(codigoProducto) &&
            !codigosBD.has(codigoProducto)
          ) {
            addError(
              'codigo_producto',
              'El producto no existe en la hoja Artículos ni en la base de datos',
              codigoProducto,
            );
          }

          if (meses === null || Number.isNaN(meses) || meses < 0) {
            addError(
              'meses',
              'Debe ser un número mayor o igual a 0',
              celda(row, colMeses),
            );
          }
          if (precio === null || Number.isNaN(precio) || precio <= 0) {
            addError(
              'precio',
              'Debe ser un número mayor a 0',
              celda(row, colPrecio),
            );
          }

          if (
            codigoProducto &&
            meses !== null &&
            !Number.isNaN(meses) &&
            meses >= 0
          ) {
            const combinacion = `${codigoProducto}-${meses}`;
            if (combinacionesPrecios.has(combinacion)) {
              addError(
                'meses',
                'Este plazo ya está definido para el producto (en la hoja Artículos o en otra fila)',
                meses,
              );
            } else {
              combinacionesPrecios.add(combinacion);
            }
          }

          if (activo !== 'SI' && activo !== 'NO') {
            addError('activo', 'Debe ser SI o NO', activo);
          }

          if (tieneError) {
            filasConError++;
            preciosConError++;
          } else {
            preciosValidar.push({
              codigoProducto,
              meses,
              precio,
              activo,
              origen: 'PRECIOS',
              fila: rowNumber,
            });
          }
        });

        porHoja[SHEET_DISPLAY.precios] = {
          totalFilas: totalPrecios,
          filasValidas: totalPrecios - preciosConError,
          filasConError: preciosConError,
        };
      }
    }

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
