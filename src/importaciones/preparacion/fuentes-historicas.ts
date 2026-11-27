import { createHash } from 'node:crypto';
import { ValueType, type Cell, type Worksheet } from 'exceljs';
import { leerTexto, leerValorCelda, type ValorDeCelda } from '../parsers/cell-value.util';
import { FILA_ENCABEZADOS, FILA_INICIO_DATOS, normalizarEncabezado } from '../parsers/header-map.util';
import { loadWorkbookFromBuffer } from '../parsers/xlsx-workbook.loader';
import { esCodigoArticuloHistorico, leerModoHistorico } from '../parsers/control-historico-xlsx';
import { verificarArchivoXlsx } from './validar-archivo-xlsx';

export type TipoFila = 'CLIENTE' | 'ARTICULO' | 'DINERO' | 'CREDITO_ARTICULO';
export type TipoFuente = 'cartera' | 'inventario';
export type Valor = Exclude<ValorDeCelda, Date>;

export interface FuenteHistorica {
  nombre: string;
  bytes: Buffer;
}

export interface EvidenciaCelda {
  celda: string;
  encabezado: string;
  clase: 'FORMULA_CON_RESULTADO' | 'FORMULA_SIN_RESULTADO' | 'CADENA_VACIA' | 'ERROR_EXCEL';
  valor: Valor;
}

export interface FilaOrigen {
  referencia: string;
  tipo: TipoFila;
  fuente: TipoFuente;
  hoja: string;
  fila: number;
  originales: Record<string, Valor>;
  campos: Record<string, Valor>;
  evidencia: EvidenciaCelda[];
}

export const COLUMNAS = {
  CLIENTE: {
    documento: ['CC cliente', 'Cédula'], nombres: ['Nombres'], apellidos: ['Apellidos'],
    telefono: ['Teléfono'], direccion: ['Dirección'], ruta: ['Ruta código'],
    correo: ['Correo'], codigo_cliente: ['Código importación'], cliente_tecnico: ['Referencia de importación'],
    referencia: ['Punto de referencia'], referencia1_nombre: ['Ref1 Nombre'], referencia1_telefono: ['Ref1 Teléfono'],
    referencia2_nombre: ['Ref2 Nombre'], referencia2_telefono: ['Ref2 Teléfono'],
  },
  ARTICULO: {
    codigo: ['Código'], nombre: ['Nombre del artículo', 'Nombre'], categoria: ['Categoría'],
    costo: ['Costo unitario', 'Costo'], precio_contado: ['Precio contado'],
    stock: ['Stock actual', 'Stock'], stock_minimo: ['Stock mínimo'],
    meses_1: ['Meses opción 1', 'Meses financiamiento 1'],
    meses_2: ['Meses opción 2', 'Meses financiamiento 2'],
    meses_3: ['Meses opción 3', 'Meses financiamiento 3'],
  },
  DINERO: {
    documento: ['Cliente / Referencia', 'CC cliente'], monto: ['Monto'], tasa: ['Tasa interés'],
    interes: ['Tipo de interés', 'Tipo amortización'], carga: ['Tipo carga'],
    frecuencia: ['Frecuencia pago'], cuotas: ['Cuotas pactadas', 'Cantidad cuotas'],
    valor_cuota_pactado: ['Valor de cuota pactado'],
    fecha_credito: ['Fecha crédito'], primer_cobro: ['Fecha primer cobro'],
    ultimo_pago: ['Fecha último pago'], abonado: ['Total abonado'],
    saldo_informado: ['Saldo informado por cartera'], saldo_excel: ['Saldo pendiente (automático)'],
    saldo_corte: ['Fecha de corte'], notas: ['Notas'], numero_manual: ['Número de crédito manual'],
  },
  CREDITO_ARTICULO: {
    documento: ['Cliente / Referencia', 'CC cliente'], codigo_articulo: ['Código del artículo', 'Producto código'],
    monto: ['Monto'], financiado: ['Total financiado'], precio_pactado: ['Precio total pactado'],
    inicial: ['Cuota inicial'], plazo: ['Plazo meses'], carga: ['Tipo carga'],
    frecuencia: ['Frecuencia pago'], cuotas: ['Cuotas pactadas', 'Cantidad cuotas'],
    valor_cuota_pactado: ['Valor de cuota pactado'],
    fecha_credito: ['Fecha crédito'], primer_cobro: ['Fecha primer cobro'],
    ultimo_pago: ['Fecha último pago'], abonado: ['Total abonado'],
    saldo_informado: ['Saldo informado por cartera'], saldo_excel: ['Saldo pendiente (automático)'],
    saldo_corte: ['Fecha de corte'], notas: ['Notas'], numero_manual: ['Número de crédito manual'],
  },
} satisfies Record<TipoFila, Record<string, string[]>>;

const HOJAS = [
  ['cartera', 'CLIENTE', 'Clientes'],
  ['cartera', 'DINERO', 'Créditos de dinero'],
  ['cartera', 'CREDITO_ARTICULO', 'Créditos de artículo'],
  ['inventario', 'ARTICULO', 'Artículos'],
] as const;

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_FILAS = 20_000;
const MAX_COLUMNAS = 120;

function contieneError(valor: unknown): valor is { error: string } {
  return typeof valor === 'object' && valor !== null &&
    'error' in valor && typeof valor.error === 'string';
}

function dato(celda: Cell): Valor {
  // FormulaValue.value omite propiedades falsy; Cell.result conserva 0 y false.
  const valor = celda.type === ValueType.Formula ? celda.result : celda.value;
  const crudo = leerValorCelda(valor);
  if (crudo instanceof Date) {
    return Number.isNaN(crudo.getTime()) ? null : crudo.toISOString().slice(0, 10);
  }
  return crudo;
}

function leerFilas(
  hoja: Worksheet,
  tipo: TipoFila,
  fuente: TipoFuente,
  huella: string,
): FilaOrigen[] {
  if (hoja.rowCount > MAX_FILAS || hoja.columnCount > MAX_COLUMNAS) {
    throw new Error('La hoja excede los límites de preparación.');
  }

  const encabezados = new Map<number, { clave: string; original: string }>();
  const nombres = new Set<string>();
  hoja.getRow(FILA_ENCABEZADOS).eachCell((celda, columna) => {
    const original = leerTexto(celda.value);
    const clave = normalizarEncabezado(celda.value);
    if (!clave) return;
    if (nombres.has(clave)) throw new Error('Hay encabezados duplicados en ' + hoja.name + '.');
    nombres.add(clave);
    encabezados.set(columna, { clave, original });
  });

  const requeridas: Record<TipoFila, string[]> = {
    CLIENTE: ['documento', 'nombres'],
    ARTICULO: ['codigo', 'nombre', 'costo'],
    DINERO: ['documento', 'monto', 'carga'],
    CREDITO_ARTICULO: ['documento', 'codigo_articulo', 'carga'],
  };
  const indices = new Map<string, number>();
  for (const [campo, aliases] of Object.entries(COLUMNAS[tipo])) {
    const claves = aliases.map(normalizarEncabezado);
    const coincidencias = [...encabezados].filter(([, h]) => claves.includes(h.clave));
    if (coincidencias.length > 1) throw new Error('Hay columnas equivalentes en ' + hoja.name + '.');
    if (coincidencias[0]) indices.set(campo, coincidencias[0][0]);
  }
  if (requeridas[tipo].some((key) => !indices.has(key))) {
    throw new Error('Faltan encabezados obligatorios en ' + hoja.name + '.');
  }

  const filas: FilaOrigen[] = [];
  hoja.eachRow((row, fila) => {
    if (fila < FILA_INICIO_DATOS) return;
    const tieneCaptura = [...encabezados].some(([col, h]) => {
      if (h.clave.includes('AUTOMATICO') || h.clave === 'NUMERO DE CREDITO') return false;
      return leerTexto(row.getCell(col).value) !== '';
    });
    if (!tieneCaptura) return;
    const evidencia: EvidenciaCelda[] = [];
    const originales = new Map<string, Valor>();
    for (const [col, encabezado] of encabezados) {
      const celda = row.getCell(col);
      const valor = dato(celda);
      const formula = celda.type === ValueType.Formula;
      const crudo = formula ? celda.result : celda.value;
      const clase = contieneError(crudo) ? 'ERROR_EXCEL'
        : formula ? crudo == null ? 'FORMULA_SIN_RESULTADO' : 'FORMULA_CON_RESULTADO'
        : valor === '' ? 'CADENA_VACIA' : undefined;
      const evidenciaValor = contieneError(crudo) ? crudo.error : valor;
      originales.set(encabezado.original, evidenciaValor);
      if (clase) evidencia.push({ celda: celda.address, encabezado: encabezado.original, clase, valor: evidenciaValor });
    }
    filas.push({
      referencia: tipo + '-' + huella.slice(0, 12) + '-' + fila,
      tipo, fuente, hoja: hoja.name, fila,
      originales: Object.fromEntries(originales),
      evidencia,
      campos: Object.fromEntries(
        Object.keys(COLUMNAS[tipo]).map((campo) => {
          const indice = indices.get(campo);
          return [campo, indice ? dato(row.getCell(indice)) : null];
        }),
      ),
    });
  });
  return filas;
}

export async function leerFuentes(
  cartera: FuenteHistorica,
  inventario: FuenteHistorica,
) {
  const entradas = { cartera, inventario };
  const metadatos = (key: TipoFuente) => {
    const { nombre, bytes } = entradas[key];
    if (!nombre.toLowerCase().endsWith('.xlsx') || bytes.length > MAX_BYTES || bytes.length < 4 ||
        bytes.readUInt32LE(0) !== 0x04034b50) {
      throw new Error('Se requiere un Excel .xlsx válido de hasta 8 MB por fuente.');
    }
    return { nombre, sha256: createHash('sha256').update(bytes).digest('hex') };
  };

  const fuentes = { cartera: metadatos('cartera'), inventario: metadatos('inventario') };
  const abrir = async (fuente: FuenteHistorica) => {
    await verificarArchivoXlsx(fuente.bytes);
    return loadWorkbookFromBuffer(fuente.bytes);
  };
  const libroCartera = await abrir(cartera);
  const libros = { cartera: libroCartera, inventario: cartera.bytes === inventario.bytes ? libroCartera : await abrir(inventario) };
  const filas = HOJAS.flatMap(([fuente, tipo, nombre]) => {
    const hoja = libros[fuente].worksheets.find(
      (ws) => normalizarEncabezado(ws.name) === normalizarEncabezado(nombre),
    );
    if (!hoja) throw new Error('Falta la hoja ' + nombre + '.');
    const leidas = leerFilas(hoja, tipo, fuente, fuentes[fuente].sha256);
    if (leerModoHistorico(libros[fuente])) {
      for (const f of leidas) {
        if (tipo === 'CLIENTE' && !leerTexto(f.campos.documento)) {
          f.campos.documento = f.campos.cliente_tecnico;
        }
        if ((tipo === 'DINERO' || tipo === 'CREDITO_ARTICULO') &&
            /^HIST-[a-f0-9]{40}$/.test(leerTexto(f.campos.numero_manual))) {
          f.campos.numero_historico = f.campos.numero_manual;
        }
        if (tipo === 'CREDITO_ARTICULO' && esCodigoArticuloHistorico(leerTexto(f.campos.codigo_articulo))) {
          f.campos.referencia_historica_articulo = leerTexto(f.campos.codigo_articulo).toUpperCase();
        }
      }
    }
    return leidas;
  });
  const modoIntegral = libros.cartera === libros.inventario ? leerModoHistorico(libroCartera) : undefined;
  return { fuentes, filas, ...(modoIntegral && { modoIntegral }) };
}
