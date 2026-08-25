import * as ExcelJS from 'exceljs';
import { MAX_OPCIONES_PLAZO } from '../parsers/inventario.parser';
import {
  activarFiltro,
  colLetra,
  ColumnaPlantilla,
  comoBuffer,
  congelarEncabezados,
  declararColumnas,
  escribirCabecera,
  etiquetarGrupo,
  FILAS_PREPARADAS,
  FORMATO_MONEDA,
  FORMATO_PORCENTAJE,
  forzarRecalculo,
  formulaEnColumna,
  protegerAutomaticas,
  hojaInicio,
  listaDesplegable,
  resaltarNegativos,
  resaltarSiContiene,
} from './plantillas.util';

/**
 * Índices (1-based) de las columnas de la hoja "Artículos".
 *
 * El orden sigue cómo se llena la hoja: primero lo obligatorio, enseguida la
 * columna de Revisión que avisa qué falta, después lo opcional, luego los plazos
 * y al final los cálculos. Las columnas grises quedan agrupadas al final para
 * que no interrumpan el tabulador mientras se escribe.
 */
const COL = {
  accion: 1,
  // Obligatorios
  codigo: 2,
  nombre: 3,
  categoria: 4,
  costo: 5,
  precioContado: 6,
  // Verificación
  revision: 7,
  // Opcionales
  descripcion: 8,
  marca: 9,
  modelo: 10,
  stock: 11,
  stockMinimo: 12,
  activo: 13,
};

const PRIMERA_COLUMNA_OPCION = 14;
/** Cada opción de plazo aporta dos columnas de captura: meses y precio. */
const COLUMNAS_POR_OPCION = 2;

/** Las columnas calculadas van todas juntas, después de las opciones de plazo. */
const PRIMERA_COLUMNA_CALCULADA =
  PRIMERA_COLUMNA_OPCION + MAX_OPCIONES_PLAZO * COLUMNAS_POR_OPCION;
const COLUMNAS_CALCULADAS_POR_OPCION = 2;

export function columnasDeOpcion(numeroOpcion: number) {
  const captura =
    PRIMERA_COLUMNA_OPCION + (numeroOpcion - 1) * COLUMNAS_POR_OPCION;
  const calculo =
    PRIMERA_COLUMNA_CALCULADA +
    2 + // las dos columnas de utilidad del precio de contado
    (numeroOpcion - 1) * COLUMNAS_CALCULADAS_POR_OPCION;

  return {
    meses: captura,
    precio: captura + 1,
    utilidadValor: calculo,
    utilidadPct: calculo + 1,
  };
}

const COL_UTILIDAD_CONTADO_VALOR = PRIMERA_COLUMNA_CALCULADA;
const COL_UTILIDAD_CONTADO_PCT = PRIMERA_COLUMNA_CALCULADA + 1;

const ULTIMA_COLUMNA =
  PRIMERA_COLUMNA_CALCULADA +
  2 +
  MAX_OPCIONES_PLAZO * COLUMNAS_CALCULADAS_POR_OPCION -
  1;

function construirColumnas(): ColumnaPlantilla[] {
  // Obligatorios primero: es lo que hay que llenar sí o sí.
  const columnas: ColumnaPlantilla[] = [
    { header: 'Acción', key: 'accion', width: 14 },
    { header: 'Código*', key: 'codigo', width: 18 },
    { header: 'Nombre del artículo*', key: 'nombre', width: 32 },
    { header: 'Categoría*', key: 'categoria', width: 20 },
    {
      header: 'Costo unitario*',
      key: 'costo',
      width: 15,
      numFmt: FORMATO_MONEDA,
    },
    {
      header: 'Precio contado*',
      key: 'precio_contado',
      width: 16,
      numFmt: FORMATO_MONEDA,
    },
    // Verificación: avisa qué falta o qué está mal en la fila.
    {
      header: 'Revisión de la fila (automático)',
      key: 'revision',
      width: 40,
      automatica: true,
    },
    // Opcionales
    { header: 'Descripción', key: 'descripcion', width: 30 },
    { header: 'Marca', key: 'marca', width: 16 },
    { header: 'Modelo', key: 'modelo', width: 16 },
    { header: 'Stock actual', key: 'stock', width: 10 },
    { header: 'Stock mínimo', key: 'stock_minimo', width: 12 },
    { header: 'Activo', key: 'activo', width: 10 },
  ];

  // Opciones de plazo: solo lo que se escribe (meses y precio).
  for (let i = 1; i <= MAX_OPCIONES_PLAZO; i++) {
    columnas.push(
      { header: `Meses opción ${i}`, key: `meses_${i}`, width: 13 },
      {
        header: `Precio total opción ${i}`,
        key: `precio_${i}`,
        width: 16,
        numFmt: FORMATO_MONEDA,
      },
    );
  }

  // Cálculos, todos juntos al final.
  columnas.push(
    {
      header: 'Utilidad contado $ (automático)',
      key: 'utilidad_contado_valor',
      width: 16,
      automatica: true,
      numFmt: FORMATO_MONEDA,
    },
    {
      header: 'Utilidad contado % (automático)',
      key: 'utilidad_contado_pct',
      width: 14,
      automatica: true,
      numFmt: FORMATO_PORCENTAJE,
    },
  );

  for (let i = 1; i <= MAX_OPCIONES_PLAZO; i++) {
    columnas.push(
      {
        header: `Utilidad opción ${i} $ (automático)`,
        key: `utilidad_${i}_valor`,
        width: 15,
        automatica: true,
        numFmt: FORMATO_MONEDA,
      },
      {
        header: `Utilidad opción ${i} % (automático)`,
        key: `utilidad_${i}_pct`,
        width: 13,
        automatica: true,
        numFmt: FORMATO_PORCENTAJE,
      },
    );
  }

  return columnas;
}

const ref = (columna: number) => `$${colLetra(columna)}{f}`;

/** Utilidad de la venta de contado: precio menos costo, en pesos y en porcentaje. */
function formulasUtilidadContado(ws: ExcelJS.Worksheet, filas: number) {
  const precio = ref(COL.precioContado);
  const costo = ref(COL.costo);

  formulaEnColumna(
    ws,
    COL_UTILIDAD_CONTADO_VALOR,
    `IF(OR(${precio}="",${costo}=""),"",${precio}-${costo})`,
    filas,
  );
  formulaEnColumna(
    ws,
    COL_UTILIDAD_CONTADO_PCT,
    `IF(OR(${precio}="",${costo}="",${costo}=0),"",(${precio}-${costo})/${costo})`,
    filas,
  );

  resaltarNegativos(ws, COL_UTILIDAD_CONTADO_VALOR, filas);
  resaltarNegativos(ws, COL_UTILIDAD_CONTADO_PCT, filas);
}

/** Utilidad de una opción de plazo: precio menos costo, en pesos y en porcentaje. */
function formulasUtilidadCredito(
  ws: ExcelJS.Worksheet,
  numeroOpcion: number,
  filas: number,
) {
  const opcion = columnasDeOpcion(numeroOpcion);
  const precio = ref(opcion.precio);
  const costo = ref(COL.costo);

  formulaEnColumna(
    ws,
    opcion.utilidadValor,
    `IF(OR(${precio}="",${costo}=""),"",${precio}-${costo})`,
    filas,
  );
  formulaEnColumna(
    ws,
    opcion.utilidadPct,
    `IF(OR(${precio}="",${costo}="",${costo}=0),"",(${precio}-${costo})/${costo})`,
    filas,
  );

  resaltarNegativos(ws, opcion.utilidadValor, filas);
  resaltarNegativos(ws, opcion.utilidadPct, filas);
}

/** Semáforo por artículo: resume en una sola celda lo que hay que corregir. */
function formulaRevision(ws: ExcelJS.Worksheet, filas: number) {
  const utilidades = Array.from({ length: MAX_OPCIONES_PLAZO }, (_, i) =>
    ref(columnasDeOpcion(i + 1).utilidadValor),
  ).join(',');

  formulaEnColumna(
    ws,
    COL.revision,
    `IF(${ref(COL.codigo)}="","",` +
      `IF(${ref(COL.costo)}="","⚠ Falta el costo",` +
      `IF(${ref(COL.precioContado)}="","⚠ Falta el precio de contado",` +
      `IF(${ref(COL.precioContado)}<${ref(COL.costo)},"⚠ El precio de contado está por debajo del costo",` +
      `IF(COUNT(${utilidades})=0,"ℹ Sin opciones de crédito: solo venta de contado",` +
      `IF(MIN(${utilidades})<0,"⚠ Hay plazos que dan pérdida","OK"))))))`,
    filas,
  );

  resaltarSiContiene(ws, COL.revision, '⚠', filas);
}

/**
 * Construye la hoja "Artículos" con su layout completo.
 * La usan tanto la plantilla en blanco como la exportación compatible con
 * importación, para que ambas tengan exactamente las mismas columnas.
 */
export async function construirHojaArticulos(
  workbook: ExcelJS.Workbook,
  opciones: { subtitulo: string; instruccion: string; filas: number },
): Promise<ExcelJS.Worksheet> {
  const { subtitulo, instruccion, filas } = opciones;

  const ws = workbook.addWorksheet('Artículos');
  declararColumnas(ws, construirColumnas(), filas);
  escribirCabecera(
    ws,
    'Catálogo de Artículos',
    subtitulo,
    instruccion,
    colLetra(ULTIMA_COLUMNA),
  );

  etiquetarGrupo(ws, COL.codigo, COL.precioContado, 'DATOS OBLIGATORIOS');
  etiquetarGrupo(ws, COL.revision, COL.revision, 'VERIFICACIÓN');
  etiquetarGrupo(ws, COL.descripcion, COL.activo, 'DATOS OPCIONALES');
  etiquetarGrupo(
    ws,
    COL_UTILIDAD_CONTADO_VALOR,
    COL_UTILIDAD_CONTADO_PCT,
    'UTILIDAD DE CONTADO',
  );

  formulasUtilidadContado(ws, filas);

  // La captura de cada opción y su rentabilidad viven en bloques separados:
  // lo que se escribe queda junto, y los cálculos quedan todos al final.
  for (let i = 1; i <= MAX_OPCIONES_PLAZO; i++) {
    const opcion = columnasDeOpcion(i);
    etiquetarGrupo(ws, opcion.meses, opcion.precio, `PRECIO A CRÉDITO ${i}`);
    etiquetarGrupo(
      ws,
      opcion.utilidadValor,
      opcion.utilidadPct,
      `UTILIDAD OPCIÓN ${i}`,
    );
    formulasUtilidadCredito(ws, i, filas);
  }

  formulaRevision(ws, filas);

  congelarEncabezados(ws, COL.nombre);
  activarFiltro(ws, ULTIMA_COLUMNA, filas);
  await protegerAutomaticas(ws);

  return ws;
}

/** Hoja de listas de valores del inventario, más las validaciones de la hoja principal. */
export function agregarValoresInventario(
  workbook: ExcelJS.Workbook,
  wsArticulos: ExcelJS.Worksheet,
  filas: number,
) {
  const ws = workbook.addWorksheet('Valores', { state: 'veryHidden' });
  ws.getCell('A1').value = 'Acción';
  ws.getCell('A2').value = 'CREAR';
  ws.getCell('A3').value = 'ACTUALIZAR';

  ws.getCell('B1').value = 'Activo';
  ws.getCell('B2').value = 'SI';
  ws.getCell('B3').value = 'NO';
  ws.getRow(1).font = { bold: true };

  listaDesplegable(wsArticulos, COL.accion, 'Valores!$A$2:$A$3', true, filas);
  listaDesplegable(wsArticulos, COL.activo, 'Valores!$B$2:$B$3', true, filas);

  return ws;
}

/** Escribe una fila de artículo respetando las columnas de opciones de plazo. */
export function escribirFilaArticulo(
  ws: ExcelJS.Worksheet,
  numeroFila: number,
  articulo: {
    codigo: string;
    nombre: string;
    descripcion?: string | null;
    categoria: string;
    marca?: string | null;
    modelo?: string | null;
    costo: number;
    precioContado?: number | null;
    stock: number;
    stockMinimo: number;
    activo: boolean;
    opciones: Array<{ meses: number; precio: number }>;
  },
) {
  const fila = ws.getRow(numeroFila);
  fila.getCell(COL.accion).value = 'CREAR';
  fila.getCell(COL.codigo).value = articulo.codigo;
  fila.getCell(COL.nombre).value = articulo.nombre;
  fila.getCell(COL.descripcion).value = articulo.descripcion || '';
  fila.getCell(COL.categoria).value = articulo.categoria;
  fila.getCell(COL.marca).value = articulo.marca || '';
  fila.getCell(COL.modelo).value = articulo.modelo || '';
  fila.getCell(COL.costo).value = articulo.costo;
  if (articulo.precioContado !== null && articulo.precioContado !== undefined) {
    fila.getCell(COL.precioContado).value = articulo.precioContado;
  }
  fila.getCell(COL.stock).value = articulo.stock;
  fila.getCell(COL.stockMinimo).value = articulo.stockMinimo;
  fila.getCell(COL.activo).value = articulo.activo ? 'SI' : 'NO';

  articulo.opciones.slice(0, MAX_OPCIONES_PLAZO).forEach((opcion, indice) => {
    const columnas = columnasDeOpcion(indice + 1);
    fila.getCell(columnas.meses).value = opcion.meses;
    fila.getCell(columnas.precio).value = opcion.precio;
  });
}

export const COLUMNAS_ARTICULOS = COL;
export const ULTIMA_COLUMNA_ARTICULOS = ULTIMA_COLUMNA;

export async function generarPlantillaInventario(): Promise<{
  data: Buffer;
  contentType: string;
  filename: string;
}> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Créditos del Sur';
  forzarRecalculo(workbook);

  hojaInicio(workbook, 'MÓDULO DE IMPORTACIÓN DE INVENTARIO', [
    '# Cómo diligenciar esta plantilla',
    'Todo el inventario se registra en una sola hoja: "Artículos". Cada fila es un artículo completo.',
    'Escriba los datos desde la fila 7 hacia abajo.',
    '',
    '# Qué es obligatorio',
    'Las primeras cinco columnas: Código, Nombre del artículo, Categoría, Costo unitario y Precio contado.',
    'Todo artículo debe poder venderse de contado, por eso su precio es obligatorio.',
    '',
    '# Corregir algo que ya está en el sistema',
    'Escriba ACTUALIZAR en la columna Acción para corregir un registro existente, en vez de crearlo de nuevo.',
    'Si deja la columna vacía se asume CREAR.',
    'Los artículos se buscan por código. Al actualizar se corrigen sus datos y sus precios; al crear, un código repetido solo agrega los precios que falten.',
    '',
    '# Lo que el sistema completa solo',
    'Stock y Stock mínimo: se asumen en 0 si se dejan vacíos.',
    'Activo: se asume SI si se deja vacío.',
    '',
    '# Opciones de crédito',
    'Cada artículo admite hasta 3 plazos. Escriba los meses y el precio total para ese plazo (por ejemplo: 3 meses / $650.000).',
    'Use solo las opciones que necesite; las que deje vacías se ignoran. No repita el mismo número de meses en un artículo.',
    '',
    '# Utilidad automática (columnas grises)',
    'Al final de la hoja Excel calcula, para el contado y para cada plazo, la utilidad en pesos y en porcentaje: precio de venta menos costo.',
    'No hay que diligenciarlas y el sistema no las lee al importar. Si una sale en rojo, ese precio está por debajo del costo.',
    'La columna "Revisión de la fila" resume en una sola celda lo que le falta o le sobra a ese artículo. Si dice OK, la fila está lista para subir.',
    '',
    '# Al confirmar la importación',
    'Con ACTUALIZAR: se corrigen los datos del artículo y sus precios.',
    'Con CREAR y un código que ya existe: no se toca el artículo, solo se le agregan las opciones de precio que aún no tenga.',
    'Los artículos nuevos se crean con su stock inicial y todos sus precios.',
  ]);

  const ws = await construirHojaArticulos(workbook, {
    subtitulo:
      'Una fila por artículo: datos del producto, precio de contado y hasta 3 opciones de plazo.',
    instruccion:
      '📝 Escriba los datos desde la fila 7 hacia abajo. Las columnas grises se calculan solas.',
    filas: FILAS_PREPARADAS,
  });

  agregarValoresInventario(workbook, ws, FILAS_PREPARADAS);

  // ── Hoja Ejemplos ─────────────────────────────────────────────────────────
  const wsEjemplos = workbook.addWorksheet('Ejemplos');
  wsEjemplos.getColumn(1).width = 30;
  wsEjemplos.getColumn(2).width = 70;
  wsEjemplos.getCell('A1').value = 'EJEMPLO DE UN ARTÍCULO COMPLETO';
  wsEjemplos.getCell('A1').font = { bold: true, size: 14 };

  const ejemplo: Array<[string, string]> = [
    ['Código*', 'CEL-A15'],
    ['Nombre del artículo*', 'Samsung Galaxy A15'],
    ['Categoría*', 'Celulares'],
    ['Costo unitario*', '480.000'],
    ['Marca / Modelo', 'Samsung / A15  (opcional)'],
    ['Precio contado', '540.000  → utilidad automática: $60.000 (12,5%)'],
    ['Stock / Stock mínimo', '10 / 2  (si se dejan vacíos quedan en 0)'],
    ['Activo', 'Se asume SI si se deja vacío'],
    ['Opción 1', '1 mes  →  580.000'],
    ['Opción 2', '3 meses →  690.000'],
    ['Opción 3', '6 meses →  790.000'],
    ['Opciones sin usar', 'Se dejan vacías si el artículo no maneja ese plazo'],
    ['', ''],
    ['CÓMO LEER LA UTILIDAD', ''],
    ['Contado (540.000)', 'Utilidad $60.000 · 12,5% sobre el costo'],
    ['Opción 1 (1 mes, 580.000)', 'Utilidad $100.000 · 20,8% sobre el costo'],
    ['Opción 3 (6 meses, 790.000)', 'Utilidad $310.000 · 64,6% sobre el costo'],
    [
      'Conclusión',
      'El plazo largo deja más utilidad en total, pero se demora más en volver. Compare esa ganancia contra el tiempo que la plata queda afuera.',
    ],
  ];

  ejemplo.forEach(([campo, valor], indice) => {
    const fila = indice + 3;
    wsEjemplos.getCell(`A${fila}`).value = campo;
    wsEjemplos.getCell(`A${fila}`).font = { bold: true };
    wsEjemplos.getCell(`B${fila}`).value = valor;
    wsEjemplos.getCell(`B${fila}`).alignment = { wrapText: true };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return comoBuffer(buffer as ArrayBuffer, 'plantilla-inventario.xlsx');
}
