import * as ExcelJS from 'exceljs';
import {
  activarFiltro,
  colLetra,
  ColumnaPlantilla,
  comoBuffer,
  congelarEncabezados,
  declararColumnas,
  escribirCabecera,
  etiquetarGrupo,
  FILA_INICIO_DATOS,
  FILAS_PREPARADAS,
  FORMATO_FECHA,
  FORMATO_MONEDA,
  formulaEnColumna,
  protegerAutomaticas,
  forzarRecalculo,
  hojaInicio,
  listaDesplegable,
  resaltarSiContiene,
  ajustarTextoLargo,
} from './plantillas.util';
import {
  ETIQUETA_AMORTIZACION,
  ETIQUETA_INTERES_SIMPLE,
} from '../interes-credito';

/** Tope de filas que se vuelcan en las hojas de referencia de base de datos. */
const MAX_FILAS_REFERENCIA = 8000;

const ULTIMA_FILA_DATOS = FILA_INICIO_DATOS + FILAS_PREPARADAS - 1;

export interface ArticuloReferencia {
  codigo: string;
  nombre: string;
  meses: number;
  precio: number;
  costo: number;
  /** Unidades disponibles hoy: sirve para avisar antes de subir el archivo. */
  stock: number;
}

export interface DatosReferenciaPlantilla {
  /** Clientes ya registrados: permiten avisar de cédulas repetidas antes de subir el archivo. */
  clientes: Array<{ dni: string; nombre: string }>;
  /** Una fila por combinación artículo + plazo, para resolver el precio del plazo. */
  articulos: ArticuloReferencia[];
  codigosArticulo: string[];
  numerosPrestamo: string[];
  rutas: string[];
}

// ── Columnas de la hoja Clientes ───────────────────────────────────────────
// Primero lo obligatorio, enseguida la verificación de la cédula, y al final
// lo opcional.
const CLI = {
  accion: 1,
  // Obligatorios
  cc: 2,
  nombres: 3,
  apellidos: 4,
  telefono: 5,
  // Opcionales, de lo más útil a lo que casi no se usa
  direccion: 6,
  rutaCodigo: 7,
  referencia: 8,
  ref1Nombre: 9,
  ref1Telefono: 10,
  ref2Nombre: 11,
  ref2Telefono: 12,
  correo: 13,
  // Automáticas, al final
  revision: 14,
};

// ── Columnas de "Créditos de dinero" (préstamo en efectivo) ────────────────
const DIN = {
  accion: 1,
  // Obligatorios
  cc: 2,
  monto: 3,
  tasaInteres: 4,
  frecuencia: 5,
  cantidadCuotas: 6,
  fechaCredito: 7,
  tipoCarga: 8,
  // Cambia el cálculo del interés, así que va enseguida
  tipoAmortizacion: 9,
  // Lo ya cobrado, en una sola cifra: cuánta plata lleva pagada el cliente.
  // Cuántas cuotas cubre lo calcula la columna gris "Cuotas pagadas".
  totalAbonado: 10,
  fechaUltimoPago: 11,
  // Opcionales
  fechaPrimerCobro: 12,
  notas: 13,
  // Automáticas / calculadas, al final. El número de crédito va aquí porque el
  // sistema lo genera si se deja vacío (queda gris junto a las demás), aunque
  // sigue siendo editable para conservar números reales al migrar histórico.
  cliente: 14,
  revision: 15,
  plazoMesesAuto: 16,
  interesTotal: 17,
  totalPagar: 18,
  valorCuota: 19,
  cuotasPagadasAuto: 20,
  saldoPendiente: 21,
  movimiento: 22,
  debeCuotaAuto: 23,
  numeroCredito: 24,
};

// ── Columnas de "Créditos de artículo" ─────────────────────────────────────
// El precio del plazo ya incluye el financiamiento, así que aquí no hay tasa
// ni tipo de amortización: el plan del artículo define todo.
const ART = {
  accion: 1,
  // Obligatorios
  cc: 2,
  productoCodigo: 3,
  plazoMeses: 4,
  frecuencia: 5,
  fechaCredito: 6,
  tipoCarga: 7,
  // Baja lo que queda por financiar, así que va enseguida
  cuotaInicial: 8,
  // Lo ya cobrado, en una sola cifra. Las cuotas que cubre salen en la gris.
  totalAbonado: 9,
  fechaUltimoPago: 10,
  // Opcionales
  fechaPrimerCobro: 11,
  monto: 12,
  notas: 13,
  // Automáticas / calculadas, al final (ver nota en DIN sobre el número).
  cliente: 14,
  articulo: 15,
  revision: 16,
  precioPlazo: 17,
  cantidadCuotasAuto: 18,
  totalPagar: 19,
  valorCuota: 20,
  cuotasPagadasAuto: 21,
  saldoPendiente: 22,
  movimiento: 23,
  debeCuotaAuto: 24,
  numeroCredito: 25,
};

const COLUMNAS_CLIENTES: ColumnaPlantilla[] = [
  {
    header: 'Acción',
    key: 'accion',
    width: 14,
  },
  // Obligatorios
  { header: 'CC cliente*', key: 'cc', width: 16 },
  { header: 'Nombres*', key: 'nombres', width: 22 },
  { header: 'Apellidos*', key: 'apellidos', width: 22 },
  { header: 'Teléfono*', key: 'telefono', width: 16 },
  // Opcionales, de lo más útil a lo que casi no se usa
  { header: 'Dirección', key: 'direccion', width: 28 },
  { header: 'Ruta código', key: 'ruta_codigo', width: 14 },
  { header: 'Punto de referencia', key: 'referencia', width: 24 },
  { header: 'Ref1 Nombre', key: 'referencia1_nombre', width: 20 },
  { header: 'Ref1 Teléfono', key: 'referencia1_telefono', width: 16 },
  { header: 'Ref2 Nombre', key: 'referencia2_nombre', width: 20 },
  { header: 'Ref2 Teléfono', key: 'referencia2_telefono', width: 16 },
  { header: 'Correo', key: 'correo', width: 24 },
  // Automáticas, al final
  {
    header: 'Revisión de cédula (automático)',
    key: 'revision_cc',
    width: 38,
    automatica: true,
  },
];

const COLUMNAS_CREDITOS_DINERO: ColumnaPlantilla[] = [
  { header: 'Acción', key: 'accion', width: 14 },
  // Obligatorios
  { header: 'CC cliente*', key: 'cc_cliente', width: 16 },
  { header: 'Monto*', key: 'monto', width: 15, numFmt: FORMATO_MONEDA },
  { header: 'Tasa interés*', key: 'tasa_interes', width: 13 },
  { header: 'Frecuencia pago*', key: 'frecuencia_pago', width: 16 },
  { header: 'Cantidad cuotas*', key: 'cantidad_cuotas', width: 15 },
  {
    header: 'Fecha crédito*',
    key: 'fecha_credito',
    width: 15,
    numFmt: FORMATO_FECHA,
  },
  { header: 'Tipo carga*', key: 'tipo_carga', width: 14 },
  // Cambia el cálculo del interés, así que va enseguida
  { header: 'Tipo de interés', key: 'tipo_amortizacion', width: 18 },
  // Lo ya cobrado, para créditos que vienen andando: una sola cifra en pesos.
  {
    header: 'Total abonado',
    key: 'total_abonado',
    width: 16,
    numFmt: FORMATO_MONEDA,
  },
  {
    header: 'Fecha último pago',
    key: 'fecha_ultimo_pago',
    width: 16,
    numFmt: FORMATO_FECHA,
  },
  // Opcionales
  {
    header: 'Fecha primer cobro',
    key: 'fecha_primer_cobro',
    width: 17,
    numFmt: FORMATO_FECHA,
  },
  { header: 'Notas', key: 'notas', width: 26 },
  // Automáticas, al final
  {
    header: 'Cliente encontrado (automático)',
    key: 'cliente_auto',
    width: 28,
    automatica: true,
  },
  {
    header: 'Revisión de la fila (automático)',
    key: 'revision_auto',
    width: 42,
    automatica: true,
  },
  {
    header: 'Plazo en meses (automático)',
    key: 'plazo_meses_auto',
    width: 16,
    automatica: true,
    numFmt: '0.00',
  },
  {
    header: 'Interés total (automático)',
    key: 'interes_total_auto',
    width: 16,
    automatica: true,
    numFmt: FORMATO_MONEDA,
  },
  {
    header: 'Total en cuotas (automático)',
    key: 'total_pagar_auto',
    width: 16,
    automatica: true,
    numFmt: FORMATO_MONEDA,
  },
  {
    header: 'Valor cuota (automático)',
    key: 'valor_cuota_auto',
    width: 15,
    automatica: true,
    numFmt: FORMATO_MONEDA,
  },
  {
    header: 'Cuotas pagadas (automático)',
    key: 'cuotas_pagadas_auto',
    width: 18,
    automatica: true,
  },
  {
    header: 'Saldo pendiente (automático)',
    key: 'saldo_pendiente_auto',
    width: 17,
    automatica: true,
    numFmt: FORMATO_MONEDA,
  },
  {
    header: 'Al confirmar (automático)',
    key: 'movimiento_auto',
    width: 46,
    automatica: true,
  },
  {
    // Cuánto falta para completar la CUOTA que está a medias. Ej.: cuota de
    // $175 con $150 abonados en ella → "$25". Si la cuota está completa o el
    // crédito ya está pagado, muestra $0.
    header: 'Debe de la cuota actual (automático)',
    key: 'debe_cuota_auto',
    width: 24,
    automatica: true,
    numFmt: FORMATO_MONEDA,
  },
  {
    // Se genera solo si se deja vacío (IMP-<cc>-<n>). Va gris al final junto a
    // las calculadas, pero editable: permite conservar el número real del
    // crédito al migrar cartera histórica.
    header: 'Número de crédito',
    key: 'numero_prestamo',
    width: 26,
    sugerida: true,
  },
];

const COLUMNAS_CREDITOS_ARTICULO: ColumnaPlantilla[] = [
  { header: 'Acción', key: 'accion', width: 14 },
  // Obligatorios
  { header: 'CC cliente*', key: 'cc_cliente', width: 16 },
  { header: 'Código del artículo*', key: 'producto_codigo', width: 20 },
  { header: 'Plazo meses*', key: 'plazo_meses', width: 13 },
  { header: 'Frecuencia pago*', key: 'frecuencia_pago', width: 16 },
  {
    header: 'Fecha crédito*',
    key: 'fecha_credito',
    width: 15,
    numFmt: FORMATO_FECHA,
  },
  { header: 'Tipo carga*', key: 'tipo_carga', width: 14 },
  // Baja lo que queda por financiar, así que va enseguida
  {
    header: 'Cuota inicial*',
    key: 'cuota_inicial',
    width: 14,
    numFmt: FORMATO_MONEDA,
  },
  // Lo ya cobrado, para créditos que vienen andando: una sola cifra en pesos.
  {
    header: 'Total abonado',
    key: 'total_abonado',
    width: 16,
    numFmt: FORMATO_MONEDA,
  },
  {
    header: 'Fecha último pago',
    key: 'fecha_ultimo_pago',
    width: 16,
    numFmt: FORMATO_FECHA,
  },
  // Opcionales
  {
    header: 'Fecha primer cobro',
    key: 'fecha_primer_cobro',
    width: 17,
    numFmt: FORMATO_FECHA,
  },
  { header: 'Monto', key: 'monto', width: 15, numFmt: FORMATO_MONEDA },
  { header: 'Notas', key: 'notas', width: 26 },
  // Automáticas, al final
  {
    header: 'Cliente encontrado (automático)',
    key: 'cliente_auto',
    width: 28,
    automatica: true,
  },
  {
    header: 'Artículo encontrado (automático)',
    key: 'articulo_auto',
    width: 28,
    automatica: true,
  },
  {
    header: 'Revisión de la fila (automático)',
    key: 'revision_auto',
    width: 42,
    automatica: true,
  },
  {
    header: 'Precio del plazo (automático)',
    key: 'precio_plazo_auto',
    width: 18,
    automatica: true,
    numFmt: FORMATO_MONEDA,
  },
  {
    header: 'Cantidad cuotas (automático)',
    key: 'cantidad_cuotas_auto',
    width: 16,
    automatica: true,
  },
  {
    header: 'Total en cuotas (automático)',
    key: 'total_pagar_auto',
    width: 16,
    automatica: true,
    numFmt: FORMATO_MONEDA,
  },
  {
    header: 'Valor cuota (automático)',
    key: 'valor_cuota_auto',
    width: 15,
    automatica: true,
    numFmt: FORMATO_MONEDA,
  },
  {
    header: 'Cuotas pagadas (automático)',
    key: 'cuotas_pagadas_auto',
    width: 18,
    automatica: true,
  },
  {
    header: 'Saldo pendiente (automático)',
    key: 'saldo_pendiente_auto',
    width: 17,
    automatica: true,
    numFmt: FORMATO_MONEDA,
  },
  {
    header: 'Al confirmar (automático)',
    key: 'movimiento_auto',
    width: 46,
    automatica: true,
  },
  {
    header: 'Debe de la cuota actual (automático)',
    key: 'debe_cuota_auto',
    width: 24,
    automatica: true,
    numFmt: FORMATO_MONEDA,
  },
  {
    // Se genera solo si se deja vacío (IMP-<cc>-<n>). Va gris al final junto a
    // las calculadas, pero editable: permite conservar el número real del
    // crédito al migrar cartera histórica.
    header: 'Número de crédito',
    key: 'numero_prestamo',
    width: 26,
    sugerida: true,
  },
];

function ref(columna: number): string {
  return `$${colLetra(columna)}{f}`;
}

/** Cuotas que caben en un mes según la frecuencia, como fórmula de Excel. */
function factorFrecuencia(colFrecuencia: number): string {
  const f = ref(colFrecuencia);
  return `IF(${f}="DIARIO",30,IF(${f}="SEMANAL",4,IF(${f}="QUINCENAL",2,1)))`;
}

/** Nombre del cliente: primero en la base, si no en la hoja Clientes del archivo. */
function formulaCliente(colCc: number): string {
  const cc = ref(colCc);
  return (
    `IF(${cc}="","",` +
    `IFERROR(VLOOKUP(${cc},'BD Clientes'!$A:$B,2,FALSE),` +
    `IFERROR(VLOOKUP(${cc},Clientes!$B:$D,2,FALSE)&" "&VLOOKUP(${cc},Clientes!$B:$D,3,FALSE),` +
    `"⚠ Cliente no encontrado")))`
  );
}

/**
 * Valor de la cuota, con el mismo redondeo que usa el sistema al crear el
 * crédito: trunca el capital y el interés por separado (`Math.floor`) y deja el
 * residuo en la última cuota. Repartir el total con `ROUND` daría un peso de
 * diferencia frente a lo que el sistema va a guardar.
 */
function formulaValorCuota(
  colTotal: number,
  colCuotas: number,
  colInteres?: number,
  colTipoAmortizacion?: number,
): string {
  const total = ref(colTotal);
  const cuotas = ref(colCuotas);
  const guarda = `OR(NOT(ISNUMBER(${total})),NOT(ISNUMBER(${cuotas})),${cuotas}=0)`;

  // Sin columna de interés (créditos de artículo) el interés es cero, así que
  // los dos métodos coinciden y basta con repartir el total.
  if (!colInteres || !colTipoAmortizacion) {
    return `IF(${guarda},"",INT(${total}/${cuotas}))`;
  }

  const interes = ref(colInteres);
  // Amortización reparte el total de una vez; interés simple trunca el capital
  // y el interés por separado. No es lo mismo: los residuos caen distinto y dan
  // un peso de diferencia.
  const amortizacion = `INT(${total}/${cuotas})`;
  const simple = `INT((${total}-${interes})/${cuotas})+INT(${interes}/${cuotas})`;

  return (
    `IF(${guarda},"",` +
    `IF(${ref(colTipoAmortizacion)}="${ETIQUETA_AMORTIZACION}",${amortizacion},${simple}))`
  );
}

/**
 * Cuántas cuotas completas cubre la plata que el cliente lleva pagada.
 *
 * Antes esto se escribía a mano en dos casillas —"lleva 12 cuotas y abonó
 * 10.000"— y nadie veía que se sumaban: quien anotaba una cuota pagada y un
 * abono de 150.000 esperaba que el saldo bajara 150.000 y bajaba 325.000. Con
 * dos casillas de captura no hay fórmula capaz de distinguirlo, porque las dos
 * lecturas son filas legales. Por eso ahora se escribe una sola cifra —la
 * plata— y las cuotas se deducen de ella.
 *
 * El tope es la cantidad de cuotas del crédito: la última absorbe el residuo y
 * puede valer unos pesos más que las demás, así que sin tope un crédito saldado
 * podría arrojar una cuota de más.
 */
function formulaCuotasPagadas(
  colTotalAbonado: number,
  colValorCuota: number,
  colCuotas: number,
): string {
  const cuota = ref(colValorCuota);
  const cuotas = ref(colCuotas);
  const abonado = `IF(${ref(colTotalAbonado)}="",0,${ref(colTotalAbonado)})`;

  return (
    `IF(OR(NOT(ISNUMBER(${cuota})),${cuota}<=0,NOT(ISNUMBER(${cuotas}))),"",` +
    `MIN(${cuotas},INT(${abonado}/${cuota})))`
  );
}

/**
 * El número con el que va a quedar guardado el crédito.
 *
 * El importador lo genera solo cuando la celda viene vacía, pero la columna
 * parecía un dato más que había que llenar. Mostrando aquí el número que va a
 * salir, no hay nada que escribir: se ve antes de subir el archivo.
 *
 * El consecutivo cuenta los créditos que el cliente ya tiene en el sistema más
 * los que trae este archivo, así que dos importaciones seguidas del mismo
 * cliente no chocan.
 *
 * La celda queda abierta a propósito: para ACTUALIZAR un crédito, o para
 * conservar la numeración de un sistema anterior, hay que escribir encima.
 */
function formulaNumeroCredito(colCc: number, hojaPrevia?: string): string {
  const cc = ref(colCc);
  const letra = colLetra(colCc);
  const enEsteArchivo = `COUNTIF($${letra}$${FILA_INICIO_DATOS}:${cc},${cc})`;
  const enLaBase = `COUNTIF('BD Préstamos'!$A:$A,"IMP-"&${cc}&"-*")`;
  const enLaOtraHoja = hojaPrevia
    ? `+COUNTIF('${hojaPrevia}'!$${letra}$${FILA_INICIO_DATOS}:$${letra}$${ULTIMA_FILA_DATOS},${cc})`
    : '';

  return (
    `IF(${cc}="","",` +
    `"IMP-"&${cc}&"-"&(${enLaBase}${enLaOtraHoja}+${enEsteArchivo}))`
  );
}

/**
 * Qué va a pasar con la caja al confirmar esta fila, dicho en una frase y con
 * la cifra. La decisión sale del tipo de carga, así que aquí se traduce a algo
 * que se entienda sin saber cómo funciona el importador por dentro.
 */
/**
 * El importe se compone con FIXED y no con TEXT.
 *
 * TEXT lleva la máscara escrita dentro de la fórmula ("$#,##0"), y Excel la
 * interpreta con los separadores del idioma de quien abre el archivo: en
 * configuración española la coma es el separador DECIMAL, así que leía la
 * máscara como "un decimal" y escribía «$500000,0» en vez de «$500.000».
 * FIXED no lleva máscara: aplica los separadores que ya use ese Excel.
 */
function formulaMovimientoDinero(colTipoCarga: number, colMonto: number) {
  const carga = ref(colTipoCarga);
  const monto = ref(colMonto);
  return (
    `IF(${carga}="","",` +
    `IF(${carga}="OPERATIVA",` +
    `IF(${monto}="","Saldrá el monto del crédito de la Caja de Oficina",` +
    `"Saldrán $"&FIXED(${monto},0)&" de la Caja de Oficina, porque el crédito se entrega hoy"),` +
    `"No mueve caja: el crédito ya venía cobrándose"))`
  );
}

function formulaMovimientoArticulo(
  colTipoCarga: number,
  colCuotaInicial: number,
) {
  const carga = ref(colTipoCarga);
  const inicial = ref(colCuotaInicial);
  return (
    `IF(${carga}="","",` +
    `IF(${carga}="OPERATIVA",` +
    `"Sale 1 unidad del inventario, porque el artículo se entrega hoy"&` +
    `IF(IF(${inicial}="",0,${inicial})>0,` +
    `" · Entran $"&FIXED(${inicial},0)&" de cuota inicial a la Caja de Oficina",""),` +
    `"No mueve caja ni inventario: el crédito ya venía cobrándose"))`
  );
}

function formulaSaldo(colTotal: number, colAbonado: number): string {
  const total = ref(colTotal);
  // Lo abonado es ahora una casilla de captura: vacía significa cero, no
  // "todavía no se puede calcular".
  const abonado = `IF(${ref(colAbonado)}="",0,${ref(colAbonado)})`;
  return `IF(OR(NOT(ISNUMBER(${total})),NOT(ISNUMBER(${abonado}))),"",${total}-${abonado})`;
}

/**
 * Cuánto falta para completar la CUOTA que está a medias.
 * Ej.: cuota de $175 con $150 abonados en ella → $25.
 * Si la cuota está justa (múltiplo exacto) o el crédito ya está pagado → $0.
 */
function formulaDebeCuota(
  colValorCuota: number,
  colAbonado: number,
  colTotalPagar: number,
): string {
  const cuota = ref(colValorCuota);
  const total = ref(colTotalPagar);
  const abonado = `IF(${ref(colAbonado)}="",0,${ref(colAbonado)})`;
  return (
    `IF(OR(NOT(ISNUMBER(${cuota})),${cuota}=0),"",` +
    `IF(${abonado}>=${total},0,` +
    `IF(MOD(${abonado},${cuota})=0,0,` +
    `${cuota}-MOD(${abonado},${cuota}))))`
  );
}

// ── Tramos reutilizables de la columna Revisión ────────────────────────────

/** Un aviso de la columna Revisión: cuándo salta y qué dice. */
interface TramoRevision {
  condicion: string;
  mensaje: string;
}

/**
 * Encadena los avisos y cierra los paréntesis contándolos.
 *
 * Antes el cierre era un `")))))"` escrito a mano al final de la cadena, lejos
 * de los tramos que lo abrían. Al agregar un aviso el conteo dejó de cuadrar y
 * la fórmula quedó con un paréntesis de menos: Excel la descartaba entera y
 * abría el archivo pidiendo repararlo. Contándolos aquí, agregar o quitar un
 * aviso no puede volver a descuadrarlo.
 */
function cadenaRevision(tramos: TramoRevision[], siTodoVaBien: string): string {
  const aperturas = tramos
    .map(({ condicion, mensaje }) => `IF(${condicion},${mensaje},`)
    .join('');
  return aperturas + siTodoVaBien + ')'.repeat(tramos.length);
}

function creditoYaExiste(colNumero: number): TramoRevision {
  const numero = ref(colNumero);
  return {
    condicion: `AND(${numero}<>"",COUNTIF('BD Préstamos'!$A:$A,${numero})>0)`,
    mensaje: '"⚠ El número de crédito ya existe en el sistema"',
  };
}

function operativaConAbonos(
  colTipoCarga: number,
  colTotalAbonado: number,
): TramoRevision {
  return {
    condicion:
      `AND(${ref(colTipoCarga)}="OPERATIVA",` +
      `IF(${ref(colTotalAbonado)}="",0,${ref(colTotalAbonado)})>0)`,
    mensaje:
      '"⚠ Un crédito OPERATIVA se entrega hoy: no puede traer nada abonado"',
  };
}

function abonoSuperaTotal(colAbonado: number, colTotal: number): TramoRevision {
  const abonado = ref(colAbonado);
  const total = ref(colTotal);
  return {
    condicion: `AND(ISNUMBER(${abonado}),ISNUMBER(${total}),${abonado}>${total})`,
    mensaje: '"⚠ Lo abonado supera el total del crédito"',
  };
}

function hojasDeReferencia(
  workbook: ExcelJS.Workbook,
  datos: DatosReferenciaPlantilla,
) {
  // Estas hojas alimentan las columnas automáticas. Se ocultan porque son
  // datos de apoyo: nadie tiene que verlas ni tocarlas.
  const wsClientes = workbook.addWorksheet('BD Clientes', {
    state: 'veryHidden',
  });
  wsClientes.getColumn(1).width = 18;
  wsClientes.getColumn(1).numFmt = '@';
  wsClientes.getColumn(2).width = 36;
  wsClientes.getCell('A1').value = 'CC';
  wsClientes.getCell('B1').value = 'Cliente';
  wsClientes.getRow(1).font = { bold: true };
  datos.clientes.slice(0, MAX_FILAS_REFERENCIA).forEach((c, i) => {
    wsClientes.getCell(`A${i + 2}`).value = String(c.dni);
    wsClientes.getCell(`B${i + 2}`).value = c.nombre;
  });

  const wsArticulos = workbook.addWorksheet('BD Artículos', {
    state: 'veryHidden',
  });
  ['Clave', 'Código', 'Nombre', 'Meses', 'Precio', 'Costo', 'Stock'].forEach(
    (h, i) => {
      wsArticulos.getCell(1, i + 1).value = h;
    },
  );
  wsArticulos.getRow(1).font = { bold: true };
  wsArticulos.getColumn(1).width = 22;
  wsArticulos.getColumn(2).width = 18;
  wsArticulos.getColumn(3).width = 34;
  datos.articulos.slice(0, MAX_FILAS_REFERENCIA).forEach((a, i) => {
    const fila = i + 2;
    wsArticulos.getCell(`A${fila}`).value = `${a.codigo}|${a.meses}`;
    wsArticulos.getCell(`B${fila}`).value = a.codigo;
    wsArticulos.getCell(`C${fila}`).value = a.nombre;
    wsArticulos.getCell(`D${fila}`).value = a.meses;
    wsArticulos.getCell(`E${fila}`).value = a.precio;
    wsArticulos.getCell(`F${fila}`).value = a.costo;
    wsArticulos.getCell(`G${fila}`).value = a.stock;
  });

  const wsPrestamos = workbook.addWorksheet('BD Préstamos', {
    state: 'veryHidden',
  });
  wsPrestamos.getColumn(1).width = 24;
  wsPrestamos.getCell('A1').value = 'Número préstamo';
  wsPrestamos.getRow(1).font = { bold: true };
  datos.numerosPrestamo.slice(0, MAX_FILAS_REFERENCIA).forEach((n, i) => {
    wsPrestamos.getCell(`A${i + 2}`).value = n;
  });

  return { wsClientes, wsArticulos, wsPrestamos };
}

function hojaValores(
  workbook: ExcelJS.Workbook,
  datos: DatosReferenciaPlantilla,
) {
  const ws = workbook.addWorksheet('Valores', { state: 'veryHidden' });

  ws.getCell('A1').value = 'Acción';
  ws.getCell('A2').value = 'CREAR';
  ws.getCell('A3').value = 'ACTUALIZAR';

  ws.getCell('B1').value = 'Nivel Riesgo';
  ['Mínimo', 'Leve', 'Precaución', 'Moderado', 'Crítico'].forEach((v, i) => {
    ws.getCell(`B${i + 2}`).value = v;
  });

  ws.getCell('D1').value = 'Frecuencia Pago';
  ['DIARIO', 'SEMANAL', 'QUINCENAL', 'MENSUAL'].forEach((v, i) => {
    ws.getCell(`D${i + 2}`).value = v;
  });

  ws.getCell('E1').value = 'Tipo Amortización';
  ws.getCell('E2').value = ETIQUETA_INTERES_SIMPLE;
  ws.getCell('E3').value = ETIQUETA_AMORTIZACION;

  ws.getCell('F1').value = 'Tipo Carga';
  ws.getCell('F2').value = 'HISTORICA';
  ws.getCell('F3').value = 'OPERATIVA';

  ws.getCell('H1').value = 'Código artículo';
  ws.getColumn(8).width = 20;
  datos.codigosArticulo.slice(0, MAX_FILAS_REFERENCIA).forEach((c, i) => {
    ws.getCell(`H${i + 2}`).value = c;
  });

  ws.getCell('I1').value = 'Código ruta';
  ws.getColumn(9).width = 16;
  datos.rutas.slice(0, MAX_FILAS_REFERENCIA).forEach((c, i) => {
    ws.getCell(`I${i + 2}`).value = c;
  });

  ws.getRow(1).font = { bold: true };
  return ws;
}

export async function generarPlantillaClientesCreditos(
  datos: DatosReferenciaPlantilla,
): Promise<{ data: Buffer; contentType: string; filename: string }> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Créditos del Sur';
  forzarRecalculo(workbook);

  hojaInicio(workbook, 'MÓDULO DE IMPORTACIÓN DE CLIENTES Y CRÉDITOS', [
    '# Cómo diligenciar esta plantilla',
    '1. Registre los clientes NUEVOS en la hoja "Clientes".',
    '2. Registre sus créditos en la hoja que corresponda al tipo:',
    '   • "Créditos de dinero" para los préstamos en efectivo.',
    '   • "Créditos de artículo" para los créditos de electrodomésticos.',
    'Son dos hojas porque los datos no son los mismos: en un préstamo usted fija el monto y la tasa; en un crédito de artículo el precio del plazo ya trae el financiamiento adentro.',
    '3. Escriba los datos desde la fila 7 hacia abajo.',
    '',
    '# Qué es obligatorio',
    'Solo las columnas marcadas con asterisco (*), que están todas al principio de cada hoja.',
    'Clientes: CC, Nombres, Apellidos y Teléfono.',
    'Créditos de dinero: CC cliente, Monto, Tasa interés, Frecuencia, Cantidad cuotas, Fecha crédito y Tipo carga.',
    'Créditos de artículo: CC cliente, Código del artículo, Plazo meses, Frecuencia, Fecha crédito, Tipo carga y Cuota inicial.',
    '',
    '# Para qué sirve el "Número de crédito"',
    'Es el identificador del crédito. No hay que escribirlo: la columna ya viene con el número que le va a quedar, calculado con la cédula y un consecutivo.',
    'Escriba encima solo en dos casos: si quiere conservar la numeración que ya usaba en su sistema anterior, o si va a ACTUALIZAR un crédito, porque es la llave con la que el sistema sabe cuál corregir.',
    '',
    '# Clientes que ya están en el sistema',
    'No los repita en la hoja "Clientes": basta con escribir su cédula en la hoja de créditos.',
    'La columna "Revisión de cédula (automático)" avisa en rojo si la cédula ya está registrada, antes de subir el archivo.',
    '',
    '# Corregir algo que ya está en el sistema',
    'Escriba ACTUALIZAR en la columna Acción para corregir un registro existente, en vez de crearlo de nuevo. Vacío equivale a CREAR.',
    'En Clientes se busca por cédula; en las hojas de crédito, por número de crédito. Las columnas que deje vacías conservan lo que ya tenía el registro.',
    'Un crédito que ya tenga pagos registrados no se puede actualizar por importación: hay que corregirlo desde su ficha.',
    '',
    '# Diferencias entre los dos tipos de crédito',
    'Préstamo en efectivo: usted escribe el monto, la tasa y cuántas cuotas. El plazo en meses se deduce de las cuotas y la frecuencia.',
    'Crédito de artículo: usted escribe el artículo y el plazo del plan. El monto sale del precio de ese plazo y las cuotas se deducen del plazo. No lleva tasa ni tipo de amortización.',
    '',
    '# Los dos métodos de interés (solo créditos de dinero)',
    '• Interés simple: la tasa se aplica por cada mes de plazo. $500.000 al 10% a 2 meses = $100.000 de interés.',
    '• Amortización: la tasa se aplica una sola vez sobre el capital. $500.000 al 10% a 2 meses = $50.000 de interés.',
    'Coinciden cuando el plazo es de un mes, que es lo habitual en los créditos diarios. Si deja la columna vacía se asume Interés simple.',
    '',
    '# Tipo de carga: HISTORICA u OPERATIVA',
    'Es lo único que decide si el crédito mueve la caja HOY o no. No es "activo vs archivado": en ambos casos el crédito queda vivo y cobrable en la ruta.',
    '• OPERATIVA: el dinero sale hoy de la caja (se registra el desembolso con fecha de hoy). Es para créditos que usted entrega ahora, por eso no puede traer nada abonado.',
    '• HISTORICA: el dinero ya salió antes de usar el sistema, así que NO toca la caja de hoy. Es la opción para cargar créditos que ya llevan tiempo, con sus cuotas pagadas y abonos.',
    'Regla simple: si el crédito ya tiene pagos o lleva tiempo cobrándose, va como HISTORICA. Si lo está entregando hoy, OPERATIVA.',
    '',
    '# Créditos ya existentes y avanzados',
    'Las dos hojas admiten créditos que ya llevan tiempo cobrándose:',
    '• Total abonado: cuánta plata lleva pagada el cliente en total. Una sola cifra, en pesos.',
    '   La columna gris "Cuotas pagadas" le dice sola cuántas cuotas cubre esa plata: esas quedan como PAGADAS y la siguiente como PARCIAL con lo que sobre.',
    '   Se escribe la plata y no el número de cuotas a propósito: antes eran dos casillas que se sumaban, y quien anotaba una cuota y un abono de 150.000 veía bajar el saldo 325.000 sin entender por qué.',
    '   De cada peso se cobra primero el interés de la cuota y después su capital, igual que en un pago de mostrador.',
    '• Fecha último pago: fecha del último abono recibido (opcional).',
    'Solo aplica con Tipo carga = HISTORICA. No se generan movimientos de caja: ese dinero se recibió antes de usar el sistema.',
    '',
    '# Lo que el sistema completa solo',
    'Acción: se asume CREAR.',
    'Número de crédito: viene calculado con la cédula y un consecutivo. Se muestra en gris para que lo vea antes de subir el archivo.',
    'Tipo de interés: se asume Interés simple.',
    'Plazo en meses: sale de las cuotas y la frecuencia (créditos de dinero) o del plan del artículo.',
    'Si descuenta o no de caja: se deduce del tipo de carga (HISTORICA no mueve caja, OPERATIVA sí).',
    'Fecha primer cobro: se asume igual a la fecha del crédito.',
    'Si quiere usar sus propios números o fechas, escríbalos y el sistema respeta lo que usted puso.',
    '',
    '# Columnas automáticas (gris)',
    'Las de verificación van justo después de lo obligatorio, para avisar de inmediato si algo no cuadra. Las de cálculo van al final, para no estorbar al escribir.',
    'Son de solo lectura y el sistema no las lee al importar: se calculan para que usted vea lo que va a quedar guardado antes de subir el archivo.',
    'La única gris que sí se puede escribir es "Número de crédito": viene resuelta, y solo hay que corregirla para ACTUALIZAR o para conservar una numeración anterior.',
    '',
    '# Limpieza automática de los datos',
    'Los nombres en MAYÚSCULAS se guardan con formato normal, se quitan espacios de más, los teléfonos quedan solo con dígitos y los correos en minúsculas.',
    'También se avisa si dos filas tienen el mismo nombre con cédulas distintas, por si fue un error al escribir la cédula.',
    '',
    '# Ruta',
    'Si escribe el código de una ruta activa, el cliente queda asignado a esa ruta con su cobrador. Un cliente solo puede estar en una ruta a la vez.',
    '',
    '# Cuándo se mueve la plata (léalo antes de confirmar)',
    'Nada se mueve por subir el archivo. Revisar la plantilla es seguro: la caja y el inventario solo se tocan cuando usted le da CONFIRMAR.',
    '',
    'Y lo decide una sola columna: Tipo carga. No hay nada más que escribir.',
    '',
    'HISTORICA → no se mueve nada.',
    '   Es un crédito que ya venía cobrándose. Esa plata se entregó antes de',
    '   usar el sistema, así que registrar hoy la salida inventaría un egreso',
    '   que nunca ocurrió y le descuadraría la caja. Solo se crea el crédito',
    '   con sus cuotas y lo que ya se le abonó.',
    '',
    'OPERATIVA en un crédito de dinero → sale efectivo de la Caja de Oficina.',
    '   Es un crédito que usted entrega hoy. Al confirmar se registra el egreso',
    '   y su asiento contable, igual que si lo hubiera hecho desde la pantalla',
    '   de crear crédito.',
    '',
    'OPERATIVA en un crédito de artículo → sale mercancía, no efectivo.',
    '   Se descuenta una unidad del inventario y se registra la venta. Si el',
    '   cliente dio cuota inicial, esa plata sí entra como ingreso a la Caja',
    '   de Oficina.',
    '',
    '# Antes de mover un peso, el sistema revisa',
    'Suma lo que va a desembolsar por todos los créditos OPERATIVA del archivo y lo compara contra el saldo de la Caja de Oficina. Si no alcanza, no importa nada: le avisa cuánto hay y cuánto hacía falta. Así diez créditos de un millón no pasan contra una caja que tiene tres.',
    'Con los artículos hace lo mismo con el inventario: si a uno no le queda stock, esa fila detiene la importación en vez de dejar el stock en negativo.',
    '',
    '# Si algo no cuadra, no se importa a medias',
    'Todo el archivo entra o no entra nada. Si una fila hace fallar la confirmación, se deshace lo ya hecho y la caja queda como estaba: no se quedan cinco créditos cargados y cinco afuera.',
    '',
    '# El riesgo no se importa',
    'No hay columna de nivel de riesgo: el sistema lo calcula solo con los días de mora, y lo actualiza en cada pago. Cualquier valor que se pusiera aquí quedaría pisado.',
  ]);

  // ── Hoja Clientes ─────────────────────────────────────────────────────────
  const wsClientes = workbook.addWorksheet('Clientes');
  declararColumnas(wsClientes, COLUMNAS_CLIENTES);
  escribirCabecera(
    wsClientes,
    'Gestión de Clientes',
    'Una fila por cliente NUEVO. Los clientes que ya están en el sistema no se registran aquí.',
    '📝 Escriba los datos desde la fila 7 hacia abajo. La columna "Revisión de cédula" avisa si la cédula ya existe.',
    colLetra(CLI.revision),
  );

  etiquetarGrupo(wsClientes, CLI.cc, CLI.telefono, 'DATOS OBLIGATORIOS');
  etiquetarGrupo(wsClientes, CLI.direccion, CLI.correo, 'DATOS OPCIONALES');
  etiquetarGrupo(wsClientes, CLI.revision, CLI.revision, 'VERIFICACIÓN');

  [CLI.cc, CLI.telefono, CLI.ref1Telefono, CLI.ref2Telefono].forEach((col) => {
    wsClientes.getColumn(col).numFmt = '@';
  });

  const rangoCc = `$${colLetra(CLI.cc)}$${FILA_INICIO_DATOS}:$${colLetra(CLI.cc)}$${ULTIMA_FILA_DATOS}`;
  formulaEnColumna(
    wsClientes,
    CLI.revision,
    `IF(${ref(CLI.cc)}="","",` +
      `IF(COUNTIF('BD Clientes'!$A:$A,${ref(CLI.cc)})>0,` +
      `"⚠ Cédula ya registrada: "&IFERROR(VLOOKUP(${ref(CLI.cc)},'BD Clientes'!$A:$B,2,FALSE),""),` +
      `IF(COUNTIF(${rangoCc},${ref(CLI.cc)})>1,"⚠ Cédula repetida en el archivo","OK")))`,
  );
  resaltarSiContiene(wsClientes, CLI.revision, '⚠');

  congelarEncabezados(wsClientes, CLI.cc);
  activarFiltro(wsClientes, CLI.revision);
  await protegerAutomaticas(wsClientes);

  // ── Hoja Créditos de dinero ───────────────────────────────────────────────
  const wsDinero = workbook.addWorksheet('Créditos de dinero');
  declararColumnas(wsDinero, COLUMNAS_CREDITOS_DINERO);
  escribirCabecera(
    wsDinero,
    'Créditos de dinero (préstamo en efectivo)',
    'Una fila por préstamo. Admite créditos nuevos y créditos que ya llevan tiempo cobrándose.',
    '📝 Escriba los datos desde la fila 7 hacia abajo. Las columnas grises se calculan solas.',
    colLetra(DIN.movimiento),
  );

  etiquetarGrupo(wsDinero, DIN.cc, DIN.tipoCarga, 'DATOS OBLIGATORIOS');
  etiquetarGrupo(
    wsDinero,
    DIN.tipoAmortizacion,
    DIN.tipoAmortizacion,
    'MÉTODO',
  );
  etiquetarGrupo(
    wsDinero,
    DIN.fechaPrimerCobro,
    DIN.notas,
    'DATOS OPCIONALES',
  );
  etiquetarGrupo(wsDinero, DIN.cliente, DIN.revision, 'VERIFICACIÓN');
  etiquetarGrupo(
    wsDinero,
    DIN.totalAbonado,
    DIN.fechaUltimoPago,
    'ESTADO ACTUAL',
  );
  etiquetarGrupo(
    wsDinero,
    DIN.plazoMesesAuto,
    DIN.numeroCredito,
    'CÁLCULOS AUTOMÁTICOS',
  );

  wsDinero.getColumn(DIN.cc).numFmt = '@';

  formulaEnColumna(wsDinero, DIN.cliente, formulaCliente(DIN.cc));

  // El sistema no pide el plazo: lo deriva de las cuotas y la frecuencia, y
  // admite fracciones (45 cuotas diarias = 1,5 meses).
  formulaEnColumna(
    wsDinero,
    DIN.plazoMesesAuto,
    `IF(OR(${ref(DIN.cantidadCuotas)}="",${ref(DIN.frecuencia)}=""),"",` +
      `${ref(DIN.cantidadCuotas)}/${factorFrecuencia(DIN.frecuencia)})`,
  );

  // Amortización aplica la tasa una sola vez; Interés simple, una vez por mes.
  formulaEnColumna(
    wsDinero,
    DIN.interesTotal,
    `IF(OR(${ref(DIN.monto)}="",${ref(DIN.tasaInteres)}=""),"",` +
      `IF(${ref(DIN.tipoAmortizacion)}="${ETIQUETA_AMORTIZACION}",` +
      // INT trunca (nunca cobra de más); el sistema hace lo mismo con Math.trunc.
      `INT(${ref(DIN.monto)}*(${ref(DIN.tasaInteres)}/100)),` +
      `IF(${ref(DIN.plazoMesesAuto)}="","",` +
      // Se multiplica todo y se divide al final, en ese orden: dividir la tasa
      // primero deja un residuo de coma flotante que, al truncar, podría caer
      // para el otro lado y dar un peso de diferencia contra lo que se guarda.
      `INT(${ref(DIN.monto)}*${ref(DIN.tasaInteres)}*MAX(1,${ref(DIN.plazoMesesAuto)})/100))))`,
  );

  formulaEnColumna(
    wsDinero,
    DIN.totalPagar,
    `IF(OR(${ref(DIN.monto)}="",${ref(DIN.interesTotal)}=""),"",${ref(DIN.monto)}+${ref(DIN.interesTotal)})`,
  );
  formulaEnColumna(
    wsDinero,
    DIN.valorCuota,
    formulaValorCuota(
      DIN.totalPagar,
      DIN.cantidadCuotas,
      DIN.interesTotal,
      DIN.tipoAmortizacion,
    ),
  );
  formulaEnColumna(
    wsDinero,
    DIN.cuotasPagadasAuto,
    formulaCuotasPagadas(
      DIN.totalAbonado,
      DIN.valorCuota,
      DIN.cantidadCuotas,
    ),
  );
  formulaEnColumna(
    wsDinero,
    DIN.saldoPendiente,
    formulaSaldo(DIN.totalPagar, DIN.totalAbonado),
  );
  formulaEnColumna(
    wsDinero,
    DIN.debeCuotaAuto,
    formulaDebeCuota(DIN.valorCuota, DIN.totalAbonado, DIN.totalPagar),
  );

  formulaEnColumna(
    wsDinero,
    DIN.numeroCredito,
    formulaNumeroCredito(DIN.cc),
  );

  formulaEnColumna(
    wsDinero,
    DIN.movimiento,
    formulaMovimientoDinero(DIN.tipoCarga, DIN.monto),
  );

  formulaEnColumna(
    wsDinero,
    DIN.revision,
    cadenaRevision(
      [
        { condicion: `${ref(DIN.cc)}=""`, mensaje: '""' },
        {
          condicion: `${ref(DIN.monto)}=""`,
          mensaje: '"⚠ Falta el monto"',
        },
        {
          condicion: `${ref(DIN.tasaInteres)}=""`,
          mensaje: '"⚠ Falta la tasa de interés"',
        },
        creditoYaExiste(DIN.numeroCredito),
        operativaConAbonos(DIN.tipoCarga, DIN.totalAbonado),
        abonoSuperaTotal(DIN.totalAbonado, DIN.totalPagar),
      ],
      '"OK"',
    ),
  );
  resaltarSiContiene(wsDinero, DIN.revision, '⚠');
  ajustarTextoLargo(wsDinero, [DIN.revision, DIN.movimiento]);

  congelarEncabezados(wsDinero, DIN.cc);
  activarFiltro(wsDinero, DIN.movimiento);
  await protegerAutomaticas(wsDinero);

  // ── Hoja Créditos de artículo ─────────────────────────────────────────────
  const wsArticulo = workbook.addWorksheet('Créditos de artículo');
  declararColumnas(wsArticulo, COLUMNAS_CREDITOS_ARTICULO);
  escribirCabecera(
    wsArticulo,
    'Créditos de artículo',
    'Una fila por crédito de artículo. El precio del plazo ya incluye el financiamiento: aquí no se escribe tasa.',
    '📝 Escriba los datos desde la fila 7 hacia abajo. Las columnas grises se calculan solas.',
    colLetra(ART.movimiento),
  );

  etiquetarGrupo(wsArticulo, ART.cc, ART.cuotaInicial, 'DATOS OBLIGATORIOS');
  etiquetarGrupo(
    wsArticulo,
    ART.fechaPrimerCobro,
    ART.notas,
    'DATOS OPCIONALES',
  );
  etiquetarGrupo(wsArticulo, ART.cliente, ART.revision, 'VERIFICACIÓN');
  etiquetarGrupo(
    wsArticulo,
    ART.totalAbonado,
    ART.fechaUltimoPago,
    'ESTADO ACTUAL',
  );
  etiquetarGrupo(
    wsArticulo,
    ART.precioPlazo,
    ART.numeroCredito,
    'CÁLCULOS AUTOMÁTICOS',
  );

  wsArticulo.getColumn(ART.cc).numFmt = '@';

  formulaEnColumna(wsArticulo, ART.cliente, formulaCliente(ART.cc));
  formulaEnColumna(
    wsArticulo,
    ART.articulo,
    `IF(${ref(ART.productoCodigo)}="","",` +
      `IFERROR(VLOOKUP(${ref(ART.productoCodigo)},'BD Artículos'!$B:$C,2,FALSE),"⚠ Artículo no existe"))`,
  );

  formulaEnColumna(
    wsArticulo,
    ART.precioPlazo,
    `IF(OR(${ref(ART.productoCodigo)}="",${ref(ART.plazoMeses)}=""),"",` +
      `IFERROR(VLOOKUP(${ref(ART.productoCodigo)}&"|"&${ref(ART.plazoMeses)},'BD Artículos'!$A:$E,5,FALSE),` +
      `"⚠ Sin precio para ese plazo"))`,
  );

  // En artículo manda el plan: el plazo define cuántas cuotas salen.
  formulaEnColumna(
    wsArticulo,
    ART.cantidadCuotasAuto,
    `IF(OR(${ref(ART.plazoMeses)}="",${ref(ART.frecuencia)}=""),"",` +
      `ROUNDUP(${ref(ART.plazoMeses)}*${factorFrecuencia(ART.frecuencia)},0))`,
  );

  // El total es el precio del plazo: el financiamiento ya está adentro.
  formulaEnColumna(
    wsArticulo,
    ART.totalPagar,
    // Lo que se financia, que es sobre lo que se reparten las cuotas.
    //
    // La cuota inicial se resta: el cliente ya la entregó y no la vuelve a
    // pagar en cuotas. Antes esta fórmula tomaba el precio completo, así que
    // en un artículo con inicial el Excel mostraba una cuota más alta que la
    // que el sistema iba a crear. Con 980.000 a 12 quincenas y 150.000 de
    // inicial, eran 81.666 contra 69.166: 12.500 por cuota.
    //
    // Si se escribe el monto a mano no se resta nada, porque en ese caso el
    // monto ya es lo que se financia. Es el mismo criterio del parser.
    `IF(${ref(ART.monto)}<>"",${ref(ART.monto)},` +
      `IF(ISNUMBER(${ref(ART.precioPlazo)}),` +
      `MAX(0,${ref(ART.precioPlazo)}-IF(${ref(ART.cuotaInicial)}="",0,${ref(ART.cuotaInicial)})),` +
      `""))`,
  );
  formulaEnColumna(
    wsArticulo,
    ART.valorCuota,
    formulaValorCuota(ART.totalPagar, ART.cantidadCuotasAuto),
  );
  formulaEnColumna(
    wsArticulo,
    ART.cuotasPagadasAuto,
    formulaCuotasPagadas(
      ART.totalAbonado,
      ART.valorCuota,
      ART.cantidadCuotasAuto,
    ),
  );
  formulaEnColumna(
    wsArticulo,
    ART.saldoPendiente,
    formulaSaldo(ART.totalPagar, ART.totalAbonado),
  );
  formulaEnColumna(
    wsArticulo,
    ART.debeCuotaAuto,
    formulaDebeCuota(ART.valorCuota, ART.totalAbonado, ART.totalPagar),
  );

  // El consecutivo cuenta también los créditos de dinero del archivo, que se
  // leen antes que esta hoja.
  formulaEnColumna(
    wsArticulo,
    ART.numeroCredito,
    formulaNumeroCredito(ART.cc, 'Créditos de dinero'),
  );

  formulaEnColumna(
    wsArticulo,
    ART.movimiento,
    formulaMovimientoArticulo(ART.tipoCarga, ART.cuotaInicial),
  );

  formulaEnColumna(
    wsArticulo,
    ART.revision,
    cadenaRevision(
      [
        { condicion: `${ref(ART.cc)}=""`, mensaje: '""' },
        {
          condicion: `${ref(ART.productoCodigo)}=""`,
          mensaje: '"⚠ Falta el código del artículo"',
        },
        {
          condicion: `${ref(ART.plazoMeses)}=""`,
          mensaje: '"⚠ Falta el plazo en meses"',
        },
        {
          condicion: `NOT(ISNUMBER(${ref(ART.precioPlazo)}))`,
          mensaje: '"⚠ El artículo no tiene precio para ese plazo"',
        },
        // En un crédito de artículo el cliente siempre entrega algo al
        // llevarse la mercancía, así que la inicial no puede quedar en blanco.
        // Vacía y cero significan lo mismo, y las dos se avisan.
        {
          condicion:
            `OR(${ref(ART.cuotaInicial)}="",${ref(ART.cuotaInicial)}=0)`,
          mensaje: '"⚠ Falta la cuota inicial"',
        },
        // Si la inicial cubre el precio no queda nada que financiar, y un
        // crédito sin monto no es un crédito.
        {
          condicion:
            `AND(ISNUMBER(${ref(ART.precioPlazo)}),` +
            `IF(${ref(ART.cuotaInicial)}="",0,${ref(ART.cuotaInicial)})>=${ref(ART.precioPlazo)})`,
          mensaje:
            '"⚠ La cuota inicial cubre el precio del artículo: no queda nada que financiar"',
        },
        // Un crédito OPERATIVA entrega el artículo al confirmar. Si no queda
        // stock, esa fila hace fallar toda la importación, así que conviene
        // saberlo aquí y no después de subir el archivo.
        {
          condicion:
            `AND(${ref(ART.tipoCarga)}="OPERATIVA",` +
            `IFERROR(VLOOKUP(${ref(ART.productoCodigo)},'BD Artículos'!$B:$G,6,FALSE),0)<1)`,
          mensaje:
            '"⚠ No queda stock de este artículo: la importación se detendría"',
        },
        creditoYaExiste(ART.numeroCredito),
        operativaConAbonos(ART.tipoCarga, ART.totalAbonado),
        abonoSuperaTotal(ART.totalAbonado, ART.totalPagar),
      ],
      '"OK"',
    ),
  );
  resaltarSiContiene(wsArticulo, ART.revision, '⚠');
  ajustarTextoLargo(wsArticulo, [ART.revision, ART.movimiento]);

  congelarEncabezados(wsArticulo, ART.cc);
  activarFiltro(wsArticulo, ART.movimiento);
  await protegerAutomaticas(wsArticulo);

  // ── Hojas de apoyo ────────────────────────────────────────────────────────
  hojaValores(workbook, datos);
  hojasDeReferencia(workbook, datos);

  listaDesplegable(wsClientes, CLI.accion, 'Valores!$A$2:$A$3', true);
  if (datos.rutas.length > 0) {
    listaDesplegable(
      wsClientes,
      CLI.rutaCodigo,
      `Valores!$I$2:$I$${datos.rutas.length + 1}`,
      true,
    );
  }

  // Créditos de dinero
  listaDesplegable(wsDinero, DIN.accion, 'Valores!$A$2:$A$3', true);
  listaDesplegable(wsDinero, DIN.frecuencia, 'Valores!$D$2:$D$5');
  listaDesplegable(wsDinero, DIN.tipoAmortizacion, 'Valores!$E$2:$E$3', true);
  listaDesplegable(wsDinero, DIN.tipoCarga, 'Valores!$F$2:$F$3');

  // Créditos de artículo
  listaDesplegable(wsArticulo, ART.accion, 'Valores!$A$2:$A$3', true);
  listaDesplegable(wsArticulo, ART.frecuencia, 'Valores!$D$2:$D$5');
  listaDesplegable(wsArticulo, ART.tipoCarga, 'Valores!$F$2:$F$3');
  if (datos.codigosArticulo.length > 0) {
    listaDesplegable(
      wsArticulo,
      ART.productoCodigo,
      `Valores!$H$2:$H$${datos.codigosArticulo.length + 1}`,
    );
  }

  // ── Hoja Ejemplos ─────────────────────────────────────────────────────────
  const wsEjemplos = workbook.addWorksheet('Ejemplos');
  wsEjemplos.getColumn(1).width = 34;
  wsEjemplos.getColumn(2).width = 70;
  wsEjemplos.getCell('A1').value = 'GUÍA DE EJEMPLOS';
  wsEjemplos.getCell('A1').font = { bold: true, size: 14 };

  // Cada ejemplo nombra las columnas tal como salen en la hoja. Antes esta
  // guía hablaba de columnas que ya no existen —código de importación, nivel
  // de riesgo, tipo de crédito, plazo— y mandaba a llenar cosas que no están.
  const bloques: Array<[string, string]> = [
    ['HOJA "Clientes" — un cliente nuevo', ''],
    ['CC cliente*', '12345678'],
    ['Nombres* / Apellidos*', 'Juan Carlos / Pérez Gómez'],
    ['Teléfono*', '3001234567'],
    ['Ruta código', 'El código de la ruta, si va a quedar asignado a una'],
    ['El resto', 'Opcional: correo, dirección, referencias'],
    ['', ''],

    ['HOJA "Créditos de dinero" — crédito nuevo que se entrega hoy', ''],
    ['CC cliente*', '12345678'],
    ['Monto* / Tasa interés*', '500.000 / 10'],
    ['Frecuencia pago* / Cantidad cuotas*', 'DIARIO / 30'],
    ['Fecha crédito* / Tipo carga*', '2026-05-01 / OPERATIVA'],
    ['Total abonado', 'Vacío: un crédito que se entrega hoy no trae abonos'],
    [
      'Lo que aparece solo',
      'Plazo 1 mes · Interés 50.000 · Total 550.000 · Cuota 18.333',
    ],
    ['', ''],

    ['HOJA "Créditos de dinero" — crédito que ya venía cobrándose', ''],
    ['CC cliente*', '12345678'],
    ['Monto* / Tasa interés*', '600.000 / 10'],
    ['Frecuencia pago* / Cantidad cuotas*', 'DIARIO / 30'],
    ['Fecha crédito* / Tipo carga*', '2026-06-01 / HISTORICA'],
    [
      'Total abonado',
      '274.000  → la plata que el cliente lleva pagada, en una sola cifra',
    ],
    [
      'Cuotas pagadas (gris)',
      'Sale sola: 12 cuotas de 22.000 quedan PAGADAS y la 13 PARCIAL con 10.000',
    ],
    ['Fecha último pago', '2026-07-10'],
    ['', ''],

    ['HOJA "Créditos de artículo"', ''],
    ['CC cliente*', '12345678'],
    [
      'Código del artículo*',
      'CEL-A15  (el mismo código que tiene en el inventario)',
    ],
    ['Plazo meses*', '6  (debe ser un plazo con precio en ese artículo)'],
    ['Frecuencia pago* / Fecha crédito*', 'SEMANAL / 2026-08-01'],
    ['Tipo carga*', 'OPERATIVA'],
    [
      'Cuota inicial*',
      '150.000  → lo que el cliente entregó al llevarse el artículo. Obligatoria: se resta del precio y el resto es lo que se financia',
    ],
    [
      'Aquí no se escribe',
      'Ni monto ni tasa: salen del precio del plazo, que ya trae el financiamiento',
    ],
    ['', ''],

    ['¿Y el descuento de caja?', ''],
    [
      'No hay que escribirlo',
      'Sale del tipo de carga: OPERATIVA entrega la plata hoy y descuenta de la caja; HISTORICA es un crédito que ya venía andando y no la toca.',
    ],
    ['', ''],

    ['¿Y el número de crédito?', ''],
    [
      'Puede dejarlo vacío',
      'El sistema lo genera. Escríbalo solo para conservar su numeración anterior, o para ACTUALIZAR un crédito ya cargado.',
    ],
  ];

  bloques.forEach(([campo, valor], indice) => {
    const fila = indice + 3;
    wsEjemplos.getCell(`A${fila}`).value = campo;
    wsEjemplos.getCell(`A${fila}`).font = { bold: !valor };
    wsEjemplos.getCell(`B${fila}`).value = valor;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return comoBuffer(buffer as ArrayBuffer, 'plantilla-clientes-creditos.xlsx');
}
