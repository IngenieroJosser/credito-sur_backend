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
/**
 * Los plazos que financia la empresa y cuánto recarga por cada uno.
 *
 * Es una TABLA y no una tasa, y eso está medido. Con un costo de 619.900 al 30%
 * la base de contado es 805.870, y los precios reales de ese artículo son
 * 1.047.631 / 1.184.629 / 1.289.392 a 3, 5 y 8 meses: estos recargos los dan
 * exactos. Las tasas mensuales que implican serían 10%, 9,4% y 7,5% —tres
 * distintas, y BAJANDO al alargarse el plazo, lo contrario de lo que hace un
 * interés— así que ninguna fórmula de interés los produce.
 *
 * Si la empresa cambia sus recargos o sus plazos, se cambia aquí: de esta tabla
 * salen el desplegable de la columna de meses y la fórmula del precio.
 */
const PLAZOS: ReadonlyArray<{ meses: number; recargo: number }> = [
  { meses: 3, recargo: 0.3 },
  { meses: 5, recargo: 0.47 },
  { meses: 8, recargo: 0.6 },
];

/**
 * Dónde queda la tabla dentro de la hoja oculta "Valores": los meses en la
 * columna C y el recargo en la D, desde la fila 2 porque la 1 son los títulos.
 * Se derivan del tamaño de `PLAZOS` para que agregar un plazo no deje la fórmula
 * apuntando a un rango corto.
 */
const FILA_FIN_PLAZOS = 1 + PLAZOS.length;
const RANGO_PLAZOS = `Valores!$C$2:$D$${FILA_FIN_PLAZOS}`;

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
        // Sale de los meses elegidos y la tabla de recargos, y se puede escribir
        // encima igual que el de contado.
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
 * El precio de contado: el costo más la rentabilidad, aplicada SOBRE EL COSTO.
 *
 * Ejemplo real de la empresa: costo $829.900 con 30% => 829.900 × 1,30 =
 * $1.078.870. Exacto.
 *
 * La convención importa y antes estaba al revés. Aquí había
 * `costo / (1 - rentabilidad)`, que es margen sobre la VENTA, y con ese mismo
 * 30% da $1.185.571: 106.701 pesos de más. Para sacar el precio real con esa
 * fórmula habría que escribir 23,0769%, y nadie va a escribir eso. Cuando en
 * esta empresa se dice «30% de rentabilidad» se quiere decir costo × 1,30.
 *
 * Va DENTRO de la columna de precio de contado y no en una columna aparte: es
 * el valor que se importa, y tenerlo separado obligaba a copiarlo a mano. La
 * celda queda abierta, así que quien redondee escribe encima y la fórmula de esa
 * fila desaparece, como en cualquier hoja de cálculo.
 */
function formulaPrecioContado(ws: ExcelJS.Worksheet, filas: number) {
  const costo = ref(COL.costo);
  const rentabilidad = ref(COL.rentabilidadObjetivo);
  formulaEnColumna(
    ws,
    COL.precioContado,
    `IF(OR(${costo}="",${rentabilidad}="",${rentabilidad}<0),"",ROUND(${costo}*(1+${rentabilidad}),0))`,
    filas,
  );
}

/**
 * El precio de cada plazo: la base de contado más el recargo de esa opción.
 *
 * Reproduce al peso los precios que la empresa usa. Con un costo de 619.900 y
 * 30% de rentabilidad, la base es 805.870 y los recargos de la tabla —+30% a 3
 * meses, +47% a 5, +60% a 8— dan 1.047.631, 1.184.629 y 1.289.392: los tres
 * exactos.
 *
 * OJO CON LA BASE, que es el detalle que más cuesta ver. La cuenta parte de
 * `costo × (1 + rentabilidad)` y NO de lo que haya escrito en la celda de precio
 * de contado. Esa celda se redondea a mano: para ese mismo artículo la empresa
 * anota 805.900, la base subida a la centena. Si los plazos salieran de 805.900
 * darían +39, +44 y +48 de más. El redondeo es del precio que se muestra, no de
 * la base con la que se calcula.
 *
 * (Y el redondeo es a mano, no una regla: el otro artículo medido anota su
 * contado sin redondear, 1.078.870. Si la plantilla redondeara sola a la
 * centena, ese quedaría en 1.078.900 y estaría mal.)
 *
 * Lo que eso cuesta, asumido a propósito: si se deja la rentabilidad vacía y se
 * escribe el precio de contado a mano, los precios a plazo no se calculan y hay
 * que escribirlos. Es preferible a que se muevan solos cuando alguien redondea
 * un precio.
 *
 * El recargo no se escribe: sale de la tabla `PLAZOS` según los meses elegidos,
 * que la hoja lleva dentro y la fórmula consulta con BUSCARV. Antes era una
 * columna de captura por opción; se quitó porque el operador no tiene por qué
 * escribir tres veces un porcentaje que es el mismo en todos los artículos.
 *
 * Los meses se escriben libres, así que puede llegar un plazo que no esté en la
 * tabla. En ese caso el BUSCARV no encuentra nada y el precio queda vacío para
 * escribirlo a mano, en vez de mostrar #N/D y dejar la fila con pinta de rota.
 *
 * El precio queda abierto: la tabla lo deja resuelto y quien negocie otro número
 * escribe encima y la fórmula de esa celda desaparece.
 */
function formulasPrecioCredito(ws: ExcelJS.Worksheet, filas: number) {
  const costo = ref(COL.costo);
  const rentabilidad = ref(COL.rentabilidadObjetivo);
  // La base va redondeada al peso antes de aplicarle el recargo, igual que el
  // precio de contado que se muestra: los precios de la empresa son enteros y la
  // cadena de redondeos tiene que ser la misma.
  const base = `ROUND(${costo}*(1+${rentabilidad}),0)`;

  for (let i = 1; i <= MAX_OPCIONES_PLAZO; i++) {
    const columnas = columnasDeOpcion(i);
    const meses = ref(columnas.meses);
    const recargo = `VLOOKUP(${meses},${RANGO_PLAZOS},2,FALSE)`;
    formulaEnColumna(
      ws,
      columnas.precio,
      `IF(OR(${costo}="",${rentabilidad}="",${meses}=""),"",` +
        `IFERROR(ROUND(${base}*(1+${recargo}),0),""))`,
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
      `IF(AND(COUNT(${meses})>0,COUNT(${precios})<COUNT(${meses})),"⚠ Hay plazos con meses pero sin precio: elija el plazo en la lista para que salga solo, o escriba el precio a mano",` +
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

  // La tabla de plazos y recargos, de la que sale el precio de cada opción.
  // Vive aquí y no en una columna de la hoja de artículos porque es la misma en
  // todos los artículos: no hay por qué escribirla mil veces.
  ws.getCell('C1').value = 'Meses';
  ws.getCell('D1').value = 'Recargo';
  PLAZOS.forEach(({ meses, recargo }, indice) => {
    const fila = indice + 2;
    ws.getCell(`C${fila}`).value = meses;
    ws.getCell(`D${fila}`).value = recargo;
    ws.getCell(`D${fila}`).numFmt = FORMATO_PORCENTAJE;
  });

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
      formulae: [0, 3],
      showErrorMessage: true,
      errorTitle: 'Rentabilidad no válida',
      error:
        'Escriba el porcentaje que se le suma al costo, entre 0% y 300%. Por ejemplo 30%, que sobre un costo de $829.900 da un precio de contado de $1.078.870.',
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
    '# El precio de contado se calcula solo',
    'Escriba el costo unitario y la rentabilidad deseada como porcentaje, y el Precio contado aparece solo.',
    'La cuenta es costo + ese porcentaje SOBRE EL COSTO: un costo de $619.900 con 30% da $805.870 (619.900 × 1,30).',
    'Es el porcentaje que uno le suma a lo que le costó, no el margen sobre la venta. Con 30% el precio queda un 30% por encima del costo.',
    '',
    '# Los precios a plazo salen de elegir el plazo',
    'Cada opción tiene dos casillas: los meses y el Precio total. Elija los meses en el desplegable y el precio aparece solo; no hay que escribir ningún porcentaje.',
    'La plantilla lleva por dentro el recargo de cada plazo: +30% a 3 meses, +47% a 5 meses y +60% a 8 meses, sobre el precio de contado. Con un costo de $619.900 al 30% los precios salen en $1.047.631, $1.184.629 y $1.289.392.',
    'Ese recargo va por PLAZO y no es una tasa mensual: esos mismos precios equivalen a 10%, 9,4% y 7,5% por mes, o sea que el porcentaje por mes BAJA cuando el plazo se alarga. Por eso es una tabla por plazo y no un interés.',
    '',
    '# Si redondea el precio de contado, los plazos NO se mueven',
    'Los precios a plazo se calculan desde el costo y la rentabilidad, no desde lo que quede escrito en Precio contado. Así, ese costo de $619.900 al 30% da una base de $805.870, y si usted prefiere mostrar $805.900 y lo escribe encima, los tres precios a plazo siguen siendo $1.047.631, $1.184.629 y $1.289.392. Si salieran del precio redondeado darían entre $39 y $48 de más cada uno.',
    'Lo que eso implica: si deja la rentabilidad vacía y escribe el precio de contado a mano, los precios a plazo NO se calculan y hay que escribirlos también.',
    '',
    '# Los cuatro precios son un punto de partida, no el precio final',
    'Salen en gris pero NO están bloqueados, y ahí está la idea: es más fácil corregir un número que inventarlo desde una celda vacía. Si el precio de ese artículo es otro, escríbalo encima y la fórmula de esa celda se reemplaza por su número.',
    'Lo que se importa es lo que quede escrito. La rentabilidad NO se importa: solo sirve para calcular.',
    '',
    '# Utilidad automática (columnas grises)',
    'Al final de la hoja Excel calcula, para el contado y para cada plazo, la utilidad en pesos: precio de venta menos costo.',
    'El porcentaje va sobre el COSTO, igual que la rentabilidad de arriba: un artículo de 619.900 vendido de contado en 805.870 deja 185.970, o sea 30% sobre lo que costó. Por eso en la venta de contado la utilidad y la rentabilidad dan el mismo número.',
    'No lo confunda con el margen sobre la venta, que es el que sale en los informes del sistema y con esos mismos números da 23,1%. La utilidad en pesos es la misma; lo que cambia es contra qué se divide. El del costo siempre da un número más alto.',
    'No hay que diligenciarlas y el sistema no las lee al importar. Si una sale en rojo, ese precio está por debajo del costo.',
    'La columna "Revisión de la fila" resume en una sola celda lo que le falta o le sobra a ese artículo. Si dice OK, la fila está lista para subir.',
    '',
    '# Al confirmar la importación',
    'Con ACTUALIZAR: se corrigen los datos del artículo y sus precios.',
    'Con CREAR y un código que ya existe: no se toca el artículo, solo se le agregan las opciones de precio que aún no tenga.',
    'Los artículos nuevos se crean con su stock inicial y todos sus precios.',
  ]);

  const ws = await construirHojaArticulos(workbook, {
    subtitulo: `Una fila por artículo: con el costo y la rentabilidad sale el precio de contado, y eligiendo los meses salen los precios a crédito (hasta ${MAX_OPCIONES_PLAZO} opciones). Todos se pueden cambiar.`,
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
    ['Costo unitario*', '619.900'],
    [
      'Rentabilidad deseada',
      '30%  → sobre el costo: 619.900 × 1,30. Sale el precio de contado',
    ],
    ['Marca / Modelo', 'Samsung / A15  (opcional)'],
    [
      'Precio contado',
      '805.870 automático  → utilidad: $185.970 (30% sobre el costo)',
    ],
    [
      'Si lo quiere redondeado',
      'Escriba 805.900 encima. Los tres precios a plazo NO se mueven: salen del costo y la rentabilidad, no de esta casilla.',
    ],
    ['Stock / Stock mínimo', '10 / 2  (si se dejan vacíos quedan en 0)'],
    ['Activo', 'Se asume SI si se deja vacío'],
    ['Opción 1', 'Elija 3 meses  →  1.047.631 automático (recargo 30%)'],
    ['Opción 2', 'Elija 5 meses  →  1.184.629 automático (recargo 47%)'],
    ['Opción 3', 'Elija 8 meses  →  1.289.392 automático (recargo 60%)'],
    [
      'Por qué el recargo va por plazo',
      'Porque no es un interés mensual. Esos tres precios equivalen a 10%, 9,4% y 7,5% por mes: el porcentaje por mes BAJA cuando el plazo se alarga, que es lo contrario de lo que hace un interés. Ninguna tasa única da los tres. Son una tabla comercial, un recargo decidido para cada plazo, y la plantilla la lleva por dentro.',
    ],
    [
      'Si el precio es otro',
      'Escríbalo encima del automático. La fórmula de esa celda se reemplaza por el número, y lo que se importa es lo que quede escrito.',
    ],
    ['Opciones sin usar', 'Se dejan vacías si el artículo no maneja ese plazo'],
    ['', ''],
    ['CÓMO LEER LA UTILIDAD', ''],
    ['Contado (805.870)', 'Utilidad $185.970 · 30% sobre el costo'],
    ['Opción 1 (3 meses, 1.047.631)', 'Utilidad $427.731 · 69% sobre el costo'],
    [
      'Opción 3 (8 meses, 1.289.392)',
      'Utilidad $669.492 · 108% sobre el costo',
    ],
    [
      'Conclusión',
      'El plazo más largo deja más utilidad en total, pero se demora más en volver. Compare esa ganancia contra el tiempo que la plata queda afuera: el de 8 meses deja 241.761 más que el de 3, y tarda cinco meses más.',
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
