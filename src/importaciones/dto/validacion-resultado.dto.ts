export interface ErrorValidacion {
  hoja: string;
  fila: number;
  campo: string;
  mensaje: string;
  valor: any;
}

export interface AdvertenciaValidacion {
  hoja: string;
  fila: number;
  campo: string;
  mensaje: string;
  valor: any;
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
  clientes?: any[];
  creditos?: any[];
  articulos?: any[];
  precios?: any[];
  errores: ErrorValidacion[];
  advertencias: AdvertenciaValidacion[];
}
