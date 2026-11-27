import { BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { declararCapacidad } from '../parsers/header-map.util';
import { MAX_OPCIONES_PLAZO } from '../parsers/inventario.parser';
import { formulaPrecioDelPlazoRespaldado } from '../precios-articulo';
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
  divisorDelPrecio: 6,
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

const COL_UTILIDAD_CONTADO_VALOR = PRIMERA_COLUMNA_CALCULADA;
const COL_UTILIDAD_CONTADO_PCT = PRIMERA_COLUMNA_CALCULADA + 1;
const PRECIO_CONTADO_MANUAL = PRIMERA_COLUMNA_CALCULADA + 2 +
  MAX_OPCIONES_PLAZO * COLUMNAS_CALCULADAS_POR_OPCION;
const ULTIMA_COLUMNA = PRECIO_CONTADO_MANUAL + MAX_OPCIONES_PLAZO;

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
      // El encabezado va CORTO y sin paréntesis: el importador busca la columna por su
      // nombre exacto (`construirMapaColumnas`), así que meter la explicación aquí dejaba
      // la columna sin encontrar y el precio sin poder recalcularse, en silencio. La
      // explicación vive en la hoja de instrucciones y en el aviso de la casilla.
      header: 'Divisor del precio',
      key: 'divisor_del_precio',
      width: 22,
      // Numero normal y NO porcentaje, y ese formato es el arreglo de un error real: con
      // formato de porcentaje, escribir "0,65" quedaba guardado como 0,65% —cien veces
      // menos— y el precio salia casi igual al costo. Como numero, 0,65 es 0,65.
      numFmt: '0.00',
    },
    {
      header: 'Precio contado*',
      key: 'precio_contado',
      width: 16,
      numFmt: FORMATO_MONEDA,
      automatica: true,
    },
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
        automatica: true,
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

  columnas.push({ header: 'Precio contado manual', key: 'contado_manual', width: 19, numFmt: FORMATO_MONEDA });
  for (let i = 1; i <= MAX_OPCIONES_PLAZO; i++) {
    columnas.push({ header: `Precio manual opción ${i}`, key: `precio_manual_${i}`, width: 19, numFmt: FORMATO_MONEDA });
  }
  return columnas;
}

const ref = (columna: number) => `$${colLetra(columna)}{f}`;

function formulaPrecioContado(ws: ExcelJS.Worksheet, filas: number) {
  const costo = ref(COL.costo);
  const divisor = ref(COL.divisorDelPrecio);
  const manual = ref(PRECIO_CONTADO_MANUAL);
  formulaEnColumna(
    ws,
    COL.precioContado,
    `IF(${manual}<>"",${manual},IF(OR(NOT(ISNUMBER(${costo})),${costo}<1,NOT(ISNUMBER(${divisor})),${divisor}<=0,${divisor}>1),"",TRUNC(${costo})/${divisor}))`,
    filas,
  );
}

function formulasPrecioCredito(ws: ExcelJS.Worksheet, filas: number) {
  const base = ref(COL.precioContado);
  for (let i = 1; i <= MAX_OPCIONES_PLAZO; i++) {
    const columnas = columnasDeOpcion(i);
    const meses = ref(columnas.meses);
    const manual = ref(PRECIO_CONTADO_MANUAL + i);
    formulaEnColumna(
      ws,
      columnas.precio,
      `IF(${meses}="","",IF(${manual}<>"",${manual},` +
        `IF(${base}="","",IFERROR(${formulaPrecioDelPlazoRespaldado(base, meses)},""))))`,
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

/**
 * Semáforo por artículo: resume en una sola celda lo que hay que corregir.
 *
 * Cuando falta un precio, el aviso DA EL NÚMERO que le corresponde en vez de
 * explicar cómo obtenerlo. Es el único sitio de la hoja que puede hacerlo: su
 * fórmula está bloqueada, así que sigue ahí aunque se haya borrado la de la
 * celda de precio, que es precisamente cuando hace falta.
 *
 * Antes decía «escriba la rentabilidad deseada y sale solo». Era verdad en una
 * fila intacta y mentira en la única situación en la que alguien lee el aviso:
 * si la celda de precio se borró, su fórmula se fue con ella y escribir la
 * columna que ya no existe. El aviso mandaba a probar justo lo que
 * no podía funcionar. Tampoco hay lista de plazos desde que los meses se
 * escriben libres, así que «elija el plazo en la lista» señalaba a algo que ya
 * no existe.
 */
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

  // Si hay costo y divisor, la fórmula puede decir cuánto tendría que ser
  // el precio que falta. Se reconstruye la cuenta aquí en vez de leer la celda
  // de precio de contado, porque en el caso que importa esa celda está vacía.
  const costo = ref(COL.costo);
  const divisor = ref(COL.divisorDelPrecio);
  const hayDivisor = `AND(${divisor}<>"",${divisor}>0,${divisor}<=1)`;
  const base = `TEXT(TRUNC(${costo}/${divisor}),"#,##0")`;

  formulaEnColumna(
    ws,
    COL.revision,
    `IF(${ref(COL.codigo)}="","",` +
      `IF(${costo}="","⚠ Falta el costo",` +
      `IF(${ref(COL.precioContado)}="",` +
      `IF(${hayDivisor},` +
      `"⚠ Revise el precio de contado. La base calculada es "&${base}&"; cualquier ajuste va en Precio contado manual",` +
      `"⚠ Falta el precio de contado: escriba el divisor (0,65) o el precio a mano"),` +
      `IF(${ref(COL.precioContado)}<${costo},"⚠ El precio de contado está por debajo del costo",` +
      `IF(AND(COUNT(${meses})>0,COUNT(${precios})<COUNT(${meses})),` +
      `"⚠ Hay plazos con meses pero sin precio: registre el precio manual. Solo 3, 5 y 8 meses se calculan automáticamente",` +
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
    COL.divisorDelPrecio,
    COL.divisorDelPrecio,
    'GANANCIA',
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

  // La captura de cada opción y su utilidad viven en bloques separados:
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
  valoresCompartidos?: ExcelJS.Worksheet,
) {
  const ws = valoresCompartidos ?? workbook.addWorksheet('Valores', { state: 'veryHidden' });
  const activo = valoresCompartidos ? 'J' : 'B';
  ws.getCell('A1').value = 'Acción';
  ws.getCell('A2').value = 'CREAR';
  ws.getCell('A3').value = 'ACTUALIZAR';

  ws.getCell(activo + '1').value = 'Activo';
  ws.getCell(activo + '2').value = 'SI';
  ws.getCell(activo + '3').value = 'NO';

  ws.getRow(1).font = { bold: true };

  listaDesplegable(wsArticulos, COL.accion, 'Valores!$A$2:$A$3', true, filas);
  listaDesplegable(wsArticulos, COL.activo, `Valores!$${activo}$2:$${activo}$3`, true, filas);

  const columnaDivisor = colLetra(COL.divisorDelPrecio);
  // `dataValidations` existe en ExcelJS en ejecucion pero no esta en sus tipos (por eso
  // el resto del archivo la usa a traves del helper `listaDesplegable`). El cast es de la
  // definicion de la libreria, no del dato, y va acotado a esta propiedad.
  (
    wsArticulos as ExcelJS.Worksheet & {
      dataValidations: { add: (rango: string, regla: unknown) => void };
    }
  ).dataValidations.add(
    `${columnaDivisor}7:${columnaDivisor}${filas + 6}`,
    {
      type: 'decimal',
      operator: 'between',
      allowBlank: true,
      // Entre 0,01 y 1: el divisor es la parte del precio que se va en costo, así que
      // nunca pasa de 1. Más de 1 sería vender por debajo del costo.
      formulae: [0.01, 1],
      showErrorMessage: true,
      errorTitle: 'Divisor no válido',
      error:
        'Escriba el divisor con el que fija el precio: 0,70 para ganar 30%, 0,65 para ganar 35%, 0,55 para ganar 45%. Tiene que estar entre 0,01 y 1, y SIN el signo de porcentaje.',
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
    // BadRequestException y no Error a secas: con un Error el filtro global lo
    // toma por un fallo inesperado, responde 500 y le enseña al usuario
    // "Ocurrió un error inesperado... reporte el código ERR-XXXX". Entonces
    // vuelve a pulsar Exportar, que nunca va a funcionar, y reporta un código
    // cuando el sistema ya sabía exactamente qué pasaba y cómo arreglarlo.
    throw new BadRequestException(
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
      // El divisor con el que se fijó ese precio, deshaciendo la cuenta: si salió de
      // `costo / divisor`, el divisor es `costo / precio`. Así quien abre un archivo
      // exportado ve el mismo número que escribiría al cargarlo.
      fila.getCell(COL.divisorDelPrecio).value =
        articulo.costo / articulo.precioContado;
    }
    fila.getCell(PRECIO_CONTADO_MANUAL).value = articulo.precioContado;
  }
  fila.getCell(COL.stock).value = articulo.stock;
  fila.getCell(COL.stockMinimo).value = articulo.stockMinimo;
  fila.getCell(COL.activo).value = articulo.activo ? 'SI' : 'NO';

  articulo.opciones.forEach((opcion, indice) => {
    const columnas = columnasDeOpcion(indice + 1);
    fila.getCell(columnas.meses).value = opcion.meses;
    fila.getCell(PRECIO_CONTADO_MANUAL + indice + 1).value = opcion.precio;
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
  declararCapacidad(workbook);
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
    `Cada artículo admite hasta ${MAX_OPCIONES_PLAZO} opciones. Escriba los meses y, si tiene un precio acordado, el importe en la columna de precio manual de la opción.`,
    'Use solo las opciones que necesite; las que deje vacías se ignoran. No repita el mismo número de meses en un artículo.',
    '',
    '# El precio de contado se calcula solo',
    'Escriba el costo unitario y el divisor del precio, y el Precio contado aparece solo.',
    'La cuenta es costo / divisor: un costo de $829.900 con divisor 0,70 da $1.185.571.',
    'Los divisores que se usan hoy son 0,70 (gana 30%), 0,65 (gana 35%) y 0,55 (gana 45%), según el artículo.',
    'Escriba el número tal cual: 0,65. SIN el signo de porcentaje: "0,65%" es cien veces menos y el precio saldría casi igual al costo.',
    '',
    '# Los precios a plazo salen de elegir el plazo',
    'La hoja muestra el resultado automático solo para 3, 5 y 8 meses: recargos del 30%, 47% y 60% sobre el contado, respectivamente.',
    'El recargo se aplica una vez al plazo completo: no es una tasa mensual. Para los demás plazos se exige un precio manual, sin interpolar ni extrapolar.',
    'Ejemplo: $178.123 divididos entre 0,65 dan $274.035,38 de base. A 3 meses se agrega el 30% y se trunca a $356.246.',
    '',
    '# Cambiar un precio',
    'Escriba el valor acordado en Precio contado manual o Precio manual opción N. La fórmula queda protegida y muestra el precio acordado. Si se borra la captura, vuelve a calcularse cuando hay una regla respaldada.',
    'Para quitar un plazo, borre los meses y el precio manual de esa opción.',
    '',
    '# Utilidad automática (columnas grises)',
    'Al final de la hoja Excel calcula, para el contado y para cada plazo, la utilidad en pesos: precio de venta menos costo.',
    'Ojo con la diferencia: este porcentaje es sobre el COSTO, mientras que el divisor fija la ganancia sobre la VENTA. Un artículo de 829.900 vendido en 1.185.571 deja 355.671, que es 35,7% de la venta (divisor 0,70) pero 42,9% de lo que costó.',
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
    subtitulo: 'Una fila por artículo. Los precios automáticos están protegidos; los valores pactados se capturan en las columnas de precio manual.',
    instruccion:
      '📝 Escriba los datos desde la fila 7 hacia abajo. Las columnas grises las calcula Excel y están bloqueadas; los precios vienen calculados pero se pueden cambiar.',
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
