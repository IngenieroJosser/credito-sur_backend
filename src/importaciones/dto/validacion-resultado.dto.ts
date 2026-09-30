import type { TipoAmortizacionImportacion } from '../interes-credito';
import type { ValorDeCelda } from '../parsers/cell-value.util';

export interface ErrorValidacion {
  hoja: string;
  fila: number;
  campo: string;
  mensaje: string;
  /**
   * El valor de la celda que provoco el error, para que el usuario lo vea.
   *
   * `ValorDeCelda` y no `any`: es lo que devuelven los lectores de
   * `cell-value.util.ts`, que es de donde sale siempre. Era la RAIZ de cinco `any` mas
   * en los parsers, porque cada `addError` copiaba el tipo de este campo.
   */
  valor: ValorDeCelda;
}

export interface AdvertenciaValidacion {
  hoja: string;
  fila: number;
  campo: string;
  mensaje: string;
  valor: ValorDeCelda;
}

export interface ResumenHoja {
  totalFilas: number;
  filasValidas: number;
  filasConError: number;
}

/** Un movimiento que hará la confirmación, con su motivo y su cifra. */
export interface MovimientoPrevisto {
  fila: number;
  hoja?: string;
  numeroPrestamo?: string;
  ccCliente?: string;
  tipo: 'EFECTIVO' | 'ARTICULO';
  concepto: string;
  porque: string;
  salidaEfectivo: number;
  entradaEfectivo: number;
  unidadesInventario: number;
}

/** Vista previa de lo que la confirmación le hará a la caja y al inventario. */
export interface ImpactoCaja {
  hayMovimientos: boolean;
  creditosHistoricos: number;
  creditosOperativos: number;
  totalSalida: number;
  totalEntrada: number;
  unidadesInventario: number;
  cajaOficinaEncontrada: boolean;
  nombreCaja: string;
  saldoCajaOficina: number;
  alcanzaElSaldo: boolean;
  faltante: number;
  movimientos: MovimientoPrevisto[];
}

export interface ResultadoValidacion {
  tipo: 'clientes-creditos' | 'inventario';
  archivo: string;
  resumen: {
    totalFilas: number;
    filasValidas: number;
    filasConError: number;
    advertencias: number;
    porHoja: Record<string, ResumenHoja>;
  };
  impactoCaja?: ImpactoCaja;
  clientes?: ClienteImportado[];
  creditos?: CreditoImportado[];
  articulos?: ArticuloImportado[];
  precios?: PrecioImportado[];
  errores: ErrorValidacion[];
  advertencias: AdvertenciaValidacion[];
}

/**
 * Las cuatro formas que los parsers de importacion devuelven.
 *
 * Estaban declaradas como `any[]` aqui, y de esta interfaz salia casi todo el `any` del
 * modulo de importaciones: 13 anotaciones `any` producian 313 hallazgos de
 * `no-unsafe-member-access` y hermanas, el peor ratio del backend (24 a 1). El `any` no se
 * queda quieto: cada lectura de un campo de estos arreglos era una lectura insegura mas.
 *
 * Los campos y sus tipos NO se adivinaron: se anotaron los arreglos del parser como
 * `never[]` y se leyo la forma que TypeScript ya infiere de lo que se les empuja.
 */
export interface ClienteImportado {
  accion: string;
  esActualizacion: boolean;
  codigoImp: string;
  cc: string;
  nombres: string;
  apellidos: string;
  telefono: string;
  correo: string;
  direccion: string;
  referencia: string;
  referencia1Nombre: string;
  referencia1Telefono: string;
  referencia2Nombre: string;
  referencia2Telefono: string;
  nivelRiesgo: string;
  rutaCodigo: string;
  observaciones: string;
  /** Numero de fila del Excel, para poder senalar el error donde esta. */
  fila: number;
}

export interface CreditoImportado {
  accion: string;
  esActualizacion: boolean;
  codigoImp: string;
  numeroPrestamo: string;
  ccCliente: string;
  tipoPrestamo: string;
  productoCodigo: string;
  monto: number | null;
  cuotaInicial: number | undefined;
  tasaInteres: number | null;
  tasaInteresMora: number | undefined;
  frecuenciaPago: string;
  cantidadCuotas: number | null;
  /** Fraccionario: lo usa el calculo de interes. */
  plazoMeses: number | null;
  /** Entero: es lo que admite la columna. */
  plazoMesesPersistir: number;
  tipoAmortizacion: TipoAmortizacionImportacion;
  /** `leerFecha` devuelve `Date | null`, no texto. */
  fechaCredito: Date | null;
  fechaPrimerCobro: Date | null;
  tipoCarga: string;
  /**
   * 'SI' o 'NO' como TEXTO, no un booleano: sale de
   * `leerTextoMayus(celda) || (tipoCarga === 'OPERATIVA' ? 'SI' : 'NO')`. Lo declare
   * boolean por error al principio y tsc marco las cuatro comparaciones del servicio
   * contra 'SI'/'NO' como imposibles; el error era mio, no del codigo.
   */
  descontarCaja: string;
  garantia: string;
  notas: string;
  cuotasPagadas: number;
  abonoAdicional: number;
  fechaUltimoPago: Date | null;
  interesTotal: number;
  totalCredito: number;
  valorCuota: number;
  totalAbonado: number;
  saldoPendiente: number;
  fila: number;
  /** De que hoja salio: las dos hojas de credito empiezan en la fila 7. */
  hoja: string;
}

export interface ArticuloImportado {
  accion: string;
  esActualizacion: boolean;
  codigo: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  marca: string;
  modelo: string;
  costo: number | null;
  precioContado: number | undefined;
  stock: number;
  stockMinimo: number;
  activo: string;
  observaciones: string;
  /** Si el codigo ya estaba en la base. */
  yaExiste: boolean;
  /** Cuantas filas de precio traia este articulo. */
  opcionesPrecio: number;
  fila: number;
}

/**
 * Una fila de precio. El parser empuja DOS formas: una con `utilidad` y otra sin ella
 * (de ahi que vaya opcional), y `meses`/`precio` pueden venir vacios en la segunda.
 */
export interface PrecioImportado {
  codigoProducto: string;
  meses: number | null;
  precio: number | null;
  activo: string;
  utilidad?: number | null;
  origen: string;
  fila: number;
}
