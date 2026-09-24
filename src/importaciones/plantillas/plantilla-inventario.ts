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
/** Cada opción de plazo aporta dos columnas de captura: meses y precio. */
const COLUMNAS_POR_OPCION = 2;
const COLUMNAS_CALCULADAS_POR_OPCION = 2;

/**
 * Los precios a crédito van pegados a lo obligatorio: son la razón de ser del
 * artículo en este negocio, y quien llena la fila los tiene a mano.
 */
const PRIMERA_COLUMNA_OPCION = 8;

/** Lo opcional arranca donde terminan las opciones de plazo. */
const PRIMERA_COLUMNA_OPCIONAL =
  PRIMERA_COLUMNA_OPCION + MAX_OPCIONES_PLAZO * COLUMNAS_POR_OPCION;

const COL = {
  accion: 1,
  // Obligatorios
  codigo: 2,
  nombre: 3,
  categoria: 4,
  costo: 5,
  rentabilidadObjetivo: 6,
  precioContado: 7,
  // (aquí van las opciones de plazo)
  // Opcionales, de lo más útil a lo que casi no se usa
  stock: PRIMERA_COLUMNA_OPCIONAL,
  stockMinimo: PRIMERA_COLUMNA_OPCIONAL + 1,
  marca: PRIMERA_COLUMNA_OPCIONAL + 2,
  modelo: PRIMERA_COLUMNA_OPCIONAL + 3,
  descripcion: PRIMERA_COLUMNA_OPCIONAL + 4,
  activo: PRIMERA_COLUMNA_OPCIONAL + 5,
  // Automáticas, al final
  revision: PRIMERA_COLUMNA_OPCIONAL + 6,
};

const PRIMERA_COLUMNA_CALCULADA = COL.revision + 1;

export function columnasDeOpcion(numeroOpcion: number) {
  const captura =
    PRIMERA_COLUMNA_OPCION + (numeroOpcion - 1) * COLUMNAS_POR_OPCION;
  const calculo =
    PRIMERA_COLUMNA_CALCULADA +
    2 + // las dos columnas de utilidad de contado
    (numeroOpcion - 1) * COLUMNAS_CALCULADAS_POR_OPCION;

  return {
    meses: captura,
    precio: captura + 1,
    utilidadValor: calculo,
    utilidadPct: calculo + 1,
  };
}

/**
 * Ya no hay columna de "precio sugerido" aparte: la sugerencia vive dentro de
 * "Precio contado", que trae la fórmula puesta y se puede escribir encima.
 * Tenerla en una columna gris al final obligaba a mirarla y copiarla a mano, y
 * nadie copia bien un número de seis cifras mil veces.
 */
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
      header: 'Rentabilidad deseada',
      key: 'rentabilidad_objetivo',
      width: 17,
      numFmt: FORMATO_PORCENTAJE,
    },
    {
      // Llega con la fórmula costo / (1 - rentabilidad) y en gris, pero abierta:
      // el precio redondeado comercialmente se escribe encima y la fórmula de
      // esa celda se va. Es el valor que se importa, no la rentabilidad.
      header: 'Precio contado*',
      key: 'precio_contado',
      width: 16,
      sugerida: true,
      numFmt: FORMATO_MONEDA,
    },
  ];

  // Opciones de plazo: solo lo que se escribe (meses y precio).
  for (let i = 1; i <= MAX_OPCIONES_PLAZO; i++) {
    columnas.push(
      { header: `Meses opción ${i}`, key: `meses_${i}`, width: 13 },
      {
        // Sale de la tasa mensual y los meses, y se puede pisar igual que el de
        // contado: la fórmula es el punto de partida de la negociación.
        header: `Precio total opción ${i}`,
        key: `precio_${i}`,
        width: 16,
        sugerida: true,
        numFmt: FORMATO_MONEDA,
      },
    );
  }

  // Opcionales, de lo más útil a lo que casi no se usa.
  columnas.push(
    { header: 'Stock actual', key: 'stock', width: 10 },
    { header: 'Stock mínimo', key: 'stock_minimo', width: 12 },
    { header: 'Marca', key: 'marca', width: 16 },
    { header: 'Modelo', key: 'modelo', width: 16 },
    { header: 'Descripción', key: 'descripcion', width: 30 },
    { header: 'Activo', key: 'activo', width: 10 },
  );

  // Verificación: avisa qué falta o qué está mal en la fila.
  columnas.push({
    header: 'Revisión de la fila (automático)',
    key: 'revision',
    width: 40,
    automatica: true,
  });

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
      header: 'Utilidad contado % sobre costo (automático)',
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
        header: `Utilidad opción ${i} % sobre costo (automático)`,
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

/**
 * El precio de contado, a partir del margen deseado sobre la venta.
 *
 * Ejemplo: costo $187.000 y margen 30% => 187.000 / (1 - 30%) = $267.143.
 *
 * Va DENTRO de la columna de precio de contado y no en una columna aparte: es
 * el valor que se importa, y tenerlo separado obligaba a copiarlo a mano. La
 * celda queda abierta, así que quien redondee a $267.000 escribe encima y la
 * fórmula de esa fila desaparece, como en cualquier hoja de cálculo.
 */
function formulaPrecioContado(ws: ExcelJS.Worksheet, filas: number) {
  const costo = ref(COL.costo);
  const margen = ref(COL.rentabilidadObjetivo);
  formulaEnColumna(
    ws,
    COL.precioContado,
    `IF(OR(${costo}="",${margen}="",${margen}<0,${margen}>=1),"",ROUND(${costo}/(1-${margen}),0))`,
    filas,
  );
}

/**
 * Los precios a crédito, a partir del de contado y de los meses de cada plazo.
 *
 * No hay ninguna columna nueva: se reutiliza la rentabilidad deseada, que ya
 * está en la hoja. Es a propósito, y hubo un intento peor antes. Había una
 * columna "Tasa mensual crédito" y era una palabra traída de los créditos de
 * dinero, donde sí existe (`tasaInteres` en el préstamo). En artículos no: un
 * crédito de artículo se crea con `tasaInteres: 0`, así que el precio de la
 * opción es todo el costo de financiar, y esos precios son comerciales, no el
 * resultado de una tasa. Con los precios que trae el ejemplo de la hoja
 * —540.000 de contado y 580.000 / 635.000 / 690.000 a 1, 2 y 3 meses— las tasas
 * implícitas son 7,41%, 8,80% y 9,26%: ningún porcentaje único produce esos
 * tres precios.
 *
 * Lo que hay que saber del acoplamiento, porque es real: la rentabilidad hace
 * dos trabajos, cuánto se remarca y cuánto se cobra por esperar. Con un costo
 * de 480.000, subirla de 11,1% a 15% mueve el contado 24.800 y el precio a 3
 * meses 99.100. Estos tres precios son un PUNTO DE PARTIDA para no escribir
 * sobre una celda vacía; el precio que el negocio cobra se escribe encima y la
 * fórmula de esa celda se reemplaza por el número.
 *
 * Interés simple —la tasa multiplicada por los meses— y no compuesto, para
 * coincidir con la única cuenta de interés que hace el sistema:
 * `capital * tasa * meses / 100` (loans.service.ts).
 */
function formulasPrecioCredito(ws: ExcelJS.Worksheet, filas: number) {
  const contado = ref(COL.precioContado);
  const rentabilidad = ref(COL.rentabilidadObjetivo);

  for (let i = 1; i <= MAX_OPCIONES_PLAZO; i++) {
    const columnas = columnasDeOpcion(i);
    const meses = ref(columnas.meses);
    formulaEnColumna(
      ws,
      columnas.precio,
      `IF(OR(${contado}="",${meses}="",${rentabilidad}=""),"",` +
        `ROUND(${contado}*(1+${rentabilidad}*${meses}),0))`,
      filas,
    );
  }
}

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
  const meses = Array.from({ length: MAX_OPCIONES_PLAZO }, (_, i) =>
    ref(columnasDeOpcion(i + 1).meses),
  ).join(',');
  const precios = Array.from({ length: MAX_OPCIONES_PLAZO }, (_, i) =>
    ref(columnasDeOpcion(i + 1).precio),
  ).join(',');

  formulaEnColumna(
    ws,
    COL.revision,
    `IF(${ref(COL.codigo)}="","",` +
      `IF(${ref(COL.costo)}="","⚠ Falta el costo",` +
      `IF(${ref(COL.precioContado)}="","⚠ Falta el precio de contado: escriba la rentabilidad deseada y sale solo, o póngalo a mano",` +
      `IF(${ref(COL.precioContado)}<${ref(COL.costo)},"⚠ El precio de contado está por debajo del costo",` +
      `IF(AND(COUNT(${meses})>0,COUNT(${precios})<COUNT(${meses})),"⚠ Hay plazos con meses pero sin precio: escriba la rentabilidad deseada, o el precio del plazo a mano",` +
      `IF(COUNT(${utilidades})=0,"ℹ Sin opciones de crédito: solo venta de contado",` +
      `IF(MIN(${utilidades})<0,"⚠ Hay plazos que dan pérdida","OK")))))))`,
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

  etiquetarGrupo(ws, COL.codigo, COL.costo, 'DATOS OBLIGATORIOS');
  etiquetarGrupo(
    ws,
    COL.rentabilidadObjetivo,
    COL.rentabilidadObjetivo,
    'ASISTENTE DE RENTABILIDAD',
  );
  etiquetarGrupo(ws, COL.precioContado, COL.precioContado, 'SALE SOLO');
  etiquetarGrupo(ws, COL.stock, COL.activo, 'DATOS OPCIONALES');
  etiquetarGrupo(ws, COL.revision, COL.revision, 'VERIFICACIÓN');
  etiquetarGrupo(
    ws,
    COL_UTILIDAD_CONTADO_VALOR,
    COL_UTILIDAD_CONTADO_PCT,
    'UTILIDAD DE CONTADO',
  );

  formulaPrecioContado(ws, filas);
  formulasPrecioCredito(ws, filas);
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

  const columnaRentabilidad = colLetra(COL.rentabilidadObjetivo);
  (wsArticulos as any).dataValidations.add(
    `${columnaRentabilidad}7:${columnaRentabilidad}${filas}`,
    {
      type: 'decimal',
      operator: 'between',
      allowBlank: true,
      formulae: [0, 0.99],
      showErrorMessage: true,
      errorTitle: 'Rentabilidad no válida',
      error: 'Escriba un porcentaje entre 0% y 99%.',
    },
  );

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
  if (articulo.opciones.length > MAX_OPCIONES_PLAZO) {
    throw new Error(
      `El artículo ${articulo.codigo} tiene ${articulo.opciones.length} plazos y la plantilla admite ${MAX_OPCIONES_PLAZO}. No se generó el archivo para evitar perder precios.`,
    );
  }

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
    if (articulo.precioContado > 0) {
      fila.getCell(COL.rentabilidadObjetivo).value =
        (articulo.precioContado - articulo.costo) / articulo.precioContado;
    }
    fila.getCell(COL.precioContado).value = articulo.precioContado;
  }
  fila.getCell(COL.stock).value = articulo.stock;
  fila.getCell(COL.stockMinimo).value = articulo.stockMinimo;
  fila.getCell(COL.activo).value = articulo.activo ? 'SI' : 'NO';

  articulo.opciones.forEach((opcion, indice) => {
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
    'Los campos obligatorios son Código, Nombre del artículo, Categoría, Costo unitario y Precio contado.',
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
    `Cada artículo admite hasta ${MAX_OPCIONES_PLAZO} opciones de plazo, y el negocio financia hasta 3 meses. Escriba los meses y el precio total de ese plazo (por ejemplo: 3 meses / $690.000).`,
    'Use solo las opciones que necesite; las que deje vacías se ignoran. No repita el mismo número de meses en un artículo.',
    '',
    '# Los precios se calculan solos (y se pueden cambiar)',
    'Escriba solo dos cosas —el costo unitario y la rentabilidad deseada como porcentaje— y los cuatro precios aparecen solos.',
    'Precio contado: costo / (1 - rentabilidad). Un costo de $480.000 con 11,1% da $539.933, que se puede redondear a mano a $540.000: para eso la celda queda abierta.',
    'Precio de cada plazo: el de contado más esa misma rentabilidad por cada mes. Con $540.000 al 11,1%, un plazo de 3 meses arranca en $719.820.',
    '',
    '# Esos cuatro precios son un punto de partida, no el precio final',
    'Salen en gris pero NO están bloqueados, y ahí está la idea: es más fácil corregir un número que inventarlo desde una celda vacía. Si el precio a 3 meses de ese artículo es $690.000, escríbalo encima y la fórmula de esa celda se reemplaza por su número.',
    'Lo que se importa es lo que quede escrito. La rentabilidad NO se importa: solo sirve para calcular. Si prefiere escribir los cuatro precios a mano, déjela vacía.',
    'Tenga en cuenta que la rentabilidad hace dos trabajos: fija el precio de contado y también cuánto se recarga por cada mes de plazo. Con un costo de $480.000, subirla de 11,1% a 15% sube el contado $24.800 pero sube el precio a 3 meses $99.100. Por eso conviene revisar los plazos después de tocarla, y para eso están las columnas de utilidad.',
    '',
    '# Utilidad automática (columnas grises)',
    'Al final de la hoja Excel calcula, para el contado y para cada plazo, la utilidad en pesos: precio de venta menos costo.',
    'El porcentaje va sobre el COSTO, que es como se mira cuando uno compra y remarca: un artículo de 480.000 vendido en 540.000 deja 60.000, o sea 12,5% sobre lo que costó.',
    'No lo confunda con el margen sobre la venta, que es el que sale en los informes del sistema y con esos mismos números da 11,1%. La utilidad en pesos es la misma; lo que cambia es contra qué se divide. El de costo siempre da un número más alto.',
    'No hay que diligenciarlas y el sistema no las lee al importar. Si una sale en rojo, ese precio está por debajo del costo.',
    'La columna "Revisión de la fila" resume en una sola celda lo que le falta o le sobra a ese artículo. Si dice OK, la fila está lista para subir.',
    '',
    '# Al confirmar la importación',
    'Con ACTUALIZAR: se corrigen los datos del artículo y sus precios.',
    'Con CREAR y un código que ya existe: no se toca el artículo, solo se le agregan las opciones de precio que aún no tenga.',
    'Los artículos nuevos se crean con su stock inicial y todos sus precios.',
  ]);

  const ws = await construirHojaArticulos(workbook, {
    subtitulo: `Una fila por artículo: con el costo y la rentabilidad deseada salen los cuatro precios —contado y hasta ${MAX_OPCIONES_PLAZO} plazos—, y todos se pueden cambiar.`,
    instruccion:
      '📝 Escriba los datos desde la fila 7 hacia abajo. Las columnas grises se calculan solas; las de precio se pueden escribir encima.',
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
    [
      'Rentabilidad deseada',
      '11,1%  → con esto solo, salen los cuatro precios de abajo',
    ],
    ['Marca / Modelo', 'Samsung / A15  (opcional)'],
    ['Precio contado', '540.000  → utilidad automática: $60.000 (12,5%)'],
    ['Stock / Stock mínimo', '10 / 2  (si se dejan vacíos quedan en 0)'],
    ['Activo', 'Se asume SI si se deja vacío'],
    ['Opción 1', '1 mes  →  599.940 automático, se dejó en 580.000'],
    ['Opción 2', '2 meses →  659.880 automático, se dejó en 635.000'],
    ['Opción 3', '3 meses →  719.820 automático, se dejó en 690.000'],
    [
      'Por qué se escriben encima',
      'Los tres automáticos aplican la misma rentabilidad por cada mes, y salen más altos que lo que este negocio cobra de verdad. Sirven para no partir de una celda vacía: se corrigen y la fórmula de esa celda se reemplaza por el número escrito. Ningún porcentaje único da 580.000, 635.000 y 690.000 a la vez; esos son precios comerciales, decididos uno por uno.',
    ],
    ['Opciones sin usar', 'Se dejan vacías si el artículo no maneja ese plazo'],
    ['', ''],
    ['CÓMO LEER LA UTILIDAD', ''],
    ['Contado (540.000)', 'Utilidad $60.000 · 12,5% sobre el costo'],
    ['Opción 1 (1 mes, 580.000)', 'Utilidad $100.000 · 20,8% sobre el costo'],
    ['Opción 3 (3 meses, 690.000)', 'Utilidad $210.000 · 43,8% sobre el costo'],
    [
      'Conclusión',
      'El plazo más largo deja más utilidad en total, pero se demora más en volver. Compare esa ganancia contra el tiempo que la plata queda afuera.',
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
  return comoBuffer(buffer, 'plantilla-inventario.xlsx');
}
