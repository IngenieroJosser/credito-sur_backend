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
  clientes?: any[];
  creditos?: any[];
  articulos?: any[];
  precios?: any[];
  errores: ErrorValidacion[];
  advertencias: AdvertenciaValidacion[];
}
