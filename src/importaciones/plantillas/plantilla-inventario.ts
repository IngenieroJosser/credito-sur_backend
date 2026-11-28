import { BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { declararCapacidad } from '../parsers/header-map.util';
import { MAX_OPCIONES_PLAZO } from '../parsers/inventario.parser';
import { formulaMargenSobreVenta, formulaPrecioDelPlazoRespaldado } from '../precios-articulo';
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
const ULTIMA_COLUMNA = PRECIO_CONTADO_MANUAL + MAX_OPCIONES_PLAZO + 1;

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
      key: 'margen_sobre_venta',
      width: 22,
      numFmt: '0%',
    },
    {
      header: 'Precio contado*',
      key: 'precio_contado',
      width: 16,
      numFmt: FORMATO_MONEDA,
      // Un ÚNICO campo visible por precio. Trae el valor resuelto por la fórmula
      // (costo / rentabilidad) pero queda abierto: si hay un precio pactado, se
      // escribe encima. El precio pactado conservado vive en una columna oculta
      // y manda sobre el cálculo, así que no hacen falta dos columnas visibles.
      sugerida: true,
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
        sugerida: true,
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

  // Precios pactados conservados: van en columnas ocultas y mandan sobre el
  // cálculo. Son la fórmula de respaldo que completa el precio cuando existe un
  // valor acordado, sin ofrecer un segundo campo visible del mismo precio.
  columnas.push({ header: 'Precio contado manual', key: 'contado_manual', width: 19, numFmt: FORMATO_MONEDA, oculta: true });
  for (let i = 1; i <= MAX_OPCIONES_PLAZO; i++) {
    columnas.push({ header: `Precio manual opción ${i}`, key: `precio_manual_${i}`, width: 19, numFmt: FORMATO_MONEDA, oculta: true });
  }
  columnas.push({ header: 'Divisor del precio', key: 'divisor_tecnico', width: 16, oculta: true, automatica: true });
  return columnas;
}

const ref = (columna: number) => `$${colLetra(columna)}{f}`;

function formulaPrecioContado(ws: ExcelJS.Worksheet, filas: number) {
  const costo = ref(COL.costo);
  const divisor = ref(ULTIMA_COLUMNA);
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
  const divisor = ref(ULTIMA_COLUMNA);
  const hayDivisor = `AND(${divisor}<>"",${divisor}>0,${divisor}<=1)`;
  const base = `TEXT(TRUNC(${costo}/${divisor}),"#,##0")`;

  formulaEnColumna(
    ws,
    COL.revision,
    `IF(${ref(COL.codigo)}="","",` +
      `IF(${costo}="","⚠ Falta el costo",` +
      `IF(${ref(COL.precioContado)}="",` +
      `IF(${hayDivisor},` +
      `"⚠ Revise el precio de contado: la base calculada es "&${base}&". Escriba ese valor, o el pactado, en la casilla Precio contado",` +
      `"⚠ Indique la rentabilidad en porcentaje o escriba el precio de contado"),` +
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
    'RENTABILIDAD',
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

  const margen = ref(COL.divisorDelPrecio);
  const sugerido = formulaMargenSobreVenta(ref(COL.categoria));
  formulaEnColumna(ws, ULTIMA_COLUMNA,
    `IF(${margen}<>"",IF(AND(ISNUMBER(${margen}),${margen}>=0,${margen}<1),1-${margen},""),IF(ISNUMBER(${sugerido}),1-(${sugerido}),""))`,
    filas);
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
      formulae: [0, 0.9999],
      showErrorMessage: true,
      errorTitle: 'Rentabilidad no válida',
      error:
        'Escriba un porcentaje menor a 100%, por ejemplo 35%. Es el margen sobre el precio de venta.',
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
    if (articulo.precioContado > 0 && articulo.costo > 0 && articulo.costo <= articulo.precioContado) {
      fila.getCell(COL.divisorDelPrecio).value =
        1 - articulo.costo / articulo.precioContado;
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

  const wsInicio = hojaInicio(workbook, 'MÓDULO DE IMPORTACIÓN DE INVENTARIO', [
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
    `Cada artículo admite hasta ${MAX_OPCIONES_PLAZO} opciones. Escriba los meses y, si tiene un precio acordado, el importe encima del precio que aparece solo en esa opción.`,
    'Use solo las opciones que necesite; las que deje vacías se ignoran. No repita el mismo número de meses en un artículo.',
    '',
    '# El precio de contado se calcula solo',
    'Escriba el costo unitario y la rentabilidad deseada, y el Precio contado aparece solo.',
    'Indique un porcentaje como 30%. Si lo deja vacío, se usa el margen de la categoría cuando está definido.',
    'Precio = costo dividido por (1 menos el margen). Con costo de $829.900 y margen del 30%, el precio de contado es $1.185.571.',
    '',
    '# Los precios a plazo salen de elegir el plazo',
    'La hoja muestra el resultado automático solo para 3, 5 y 8 meses: recargos del 30%, 47% y 60% sobre el contado, respectivamente.',
    'El recargo se aplica una vez al plazo completo: no es una tasa mensual. Para los demás plazos se exige un precio manual, sin interpolar ni extrapolar.',
    'Ejemplo: $178.123 divididos entre 0,65 dan $274.035,38 de base. A 3 meses se agrega el 30% y se trunca a $356.246.',
    '',
    '# Cambiar un precio',
    'Escriba el valor acordado encima del precio que aparece solo: en Precio contado o en el precio de la opción. La casilla queda abierta y conserva lo escrito.',
    'Si borra lo escrito, el precio vuelve a calcularse con el costo y la rentabilidad cuando hay una regla respaldada.',
    'Para quitar un plazo, borre los meses y el precio de esa opción.',
    '',
    '# Utilidad automática (columnas grises)',
    'Al final de la hoja Excel calcula, para el contado y para cada plazo, la utilidad en pesos: precio de venta menos costo.',
    'La utilidad porcentual se calcula sobre el costo. La rentabilidad deseada se calcula sobre el precio de venta.',
    'No hay que diligenciarlas y el sistema no las lee al importar. Si una sale en rojo, ese precio está por debajo del costo.',
    'La columna "Revisión de la fila" resume en una sola celda lo que le falta o le sobra a ese artículo. Si dice OK, la fila está lista para subir.',
    '',
    '# Al confirmar la importación',
    'Con ACTUALIZAR: se corrigen los datos del artículo y sus precios.',
    'Con CREAR y un código que ya existe: no se toca el artículo, solo se le agregan las opciones de precio que aún no tenga.',
    'Los artículos nuevos se crean con su stock inicial y todos sus precios.',
  ]);

  const ws = await construirHojaArticulos(workbook, {
    subtitulo: 'Una fila por artículo. El precio sale solo del costo y la rentabilidad; si hay un precio pactado, escríbalo encima.',
    instruccion:
      '📝 Escriba los datos desde la fila 7 hacia abajo. Las columnas grises las calcula Excel; el precio viene calculado pero se puede cambiar escribiendo encima.',
    filas: FILAS_PREPARADAS,
  });

  agregarValoresInventario(workbook, ws, FILAS_PREPARADAS);

  // ── Ejemplo breve, dentro de Inicio ───────────────────────────────────────
  // El libro de operación solo muestra Inicio y Artículos: el ejemplo va al
  // final de Inicio y no suma una pestaña. Y va con la CUENTA REAL
  // (costo / rentabilidad), no con el atajo de «multiplicar por 1,30», que es
  // el margen sobre el COSTO: 0,70 deja un margen del 30% sobre la VENTA, que
  // no es lo mismo. Antes este ejemplo enseñaba justo esa confusión.
  const ejemplos: Array<[string, string]> = [
    ['EJEMPLO DE UN ARTÍCULO COMPLETO', ''],
    ['Código*', 'CEL-A15'],
    ['Nombre del artículo*', 'Samsung Galaxy A15'],
    ['Categoría*', 'Celulares'],
    ['Costo unitario*', '619.900'],
    [
      'Rentabilidad deseada',
      '30% de margen sobre la venta: el precio de contado es $885.571.',
    ],
    [
      'Ojo con la equivalencia',
      'Escriba 30% en Rentabilidad deseada, no un divisor.',
    ],
    ['Marca / Modelo', 'Samsung / A15  (opcional)'],
    ['Precio contado', '$885.571, calculado sobre el costo y el margen de venta'],
    [
      'Si lo quiere redondeado',
      'Escriba el valor encima del que sale solo. Los plazos de 3, 5 y 8 meses se recalculan sobre ese precio.',
    ],
    ['Stock / Stock mínimo', '10 / 2  (si se dejan vacíos quedan en 0)'],
    ['Activo', 'Se asume SI si se deja vacío'],
    ['Opción 1', 'Escriba 3 meses  →  precio a plazo automático (recargo 30%)'],
    ['Opción 2', 'Escriba 5 meses  →  precio a plazo automático (recargo 47%)'],
    ['Opción 3', 'Escriba 8 meses  →  precio a plazo automático (recargo 60%)'],
    ['Opciones sin usar', 'Se dejan vacías si el artículo no maneja ese plazo'],
  ];

  wsInicio.getColumn(2).width = 90;
  const filaEjemplo = wsInicio.rowCount + 2;
  ejemplos.forEach(([campo, valor], indice) => {
    const fila = filaEjemplo + indice;
    wsInicio.getCell(`A${fila}`).value = campo;
    wsInicio.getCell(`A${fila}`).font = { bold: !valor };
    wsInicio.getCell(`B${fila}`).value = valor;
    wsInicio.getCell(`B${fila}`).alignment = { wrapText: true, vertical: 'top' };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return comoBuffer(buffer, 'plantilla-inventario.xlsx');
}
