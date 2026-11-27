import type { TipoFuente } from './fuentes-historicas';
import { VERSION_PREPARACION } from './version-preparacion';

const CAMPOS = [
  'consolidar_cliente', 'identidad_distinta', 'cliente_ref', 'articulo_ref', 'interpretacion_monto',
  'precio_pactado', 'financiado', 'inicial', 'abonado', 'saldo_informado', 'saldo_corte', 'sin_ajustes',
  'fecha_credito', 'primer_cobro', 'ultimo_pago', 'cuotas', 'verificar_condiciones', 'autorizar_saldo',
] as const;
export type CampoDecision = (typeof CAMPOS)[number];
export type InterpretacionMonto = 'PRECIO_TOTAL' | 'FINANCIADO';
export const FRECUENCIAS_HISTORICAS = ['DIARIO', 'SEMANAL', 'QUINCENAL', 'MENSUAL'] as const;
export type FrecuenciaHistorica = (typeof FRECUENCIAS_HISTORICAS)[number];

interface Aprobacion<T> {
  valor: T;
  evidencia: string;
}

export interface DecisionFila extends Aprobacion<string | number | boolean> {
  referencia: string;
  campo: CampoDecision;
  metodoVerificacion?: 'TARJETA_FISICA' | 'SALDO_CARTERA';
}

export interface DecisionesHistoricas {
  version: typeof VERSION_PREPARACION.esquema;
  versiones: typeof VERSION_PREPARACION;
  responsable?: string;
  aprobadasEn?: string;
  rechazos?: { referencia: string; campo: string; evidencia: string }[];
  fuentes: Record<TipoFuente, string>;
  reglas: {
    fechaCorteCartera?: Aprobacion<string>;
    cerosIniciales?: Aprobacion<true>;
    montoArticulo?: Aprobacion<InterpretacionMonto>;
    cuotasPorFrecuencia?: Aprobacion<true>;
    cuotasPorFrecuenciaIndividual?: Partial<Record<FrecuenciaHistorica, Aprobacion<true>>>;
  };
  filas: DecisionFila[];
}

export function leerDecisiones(
  entrada: unknown,
  fuentes: DecisionesHistoricas['fuentes'],
): DecisionesHistoricas {
  const base: DecisionesHistoricas = {
    version: VERSION_PREPARACION.esquema, versiones: VERSION_PREPARACION, fuentes, reglas: {}, filas: [],
  };
  if (entrada == null) return base;
  const datos = objeto(entrada);
  const huellas = objeto(datos.fuentes);
  if (huellas.cartera !== fuentes.cartera || huellas.inventario !== fuentes.inventario) {
    throw new Error('Las decisiones no corresponden a las huellas de estos archivos.');
  }

  const reglasCrudas = datos.reglas === undefined ? {} : objeto(datos.reglas);
  const esV3 = datos.version === 2 && datos.versiones != null &&
    typeof datos.versiones === 'object' && 'preparador' in datos.versiones &&
    datos.versiones.preparador === '3.0.0';
  if ((datos.version === 1 || esV3) && Object.keys(reglasCrudas).length === 0 &&
      Array.isArray(datos.filas) && datos.filas.length === 0 &&
      (datos.rechazos == null || (Array.isArray(datos.rechazos) && datos.rechazos.length === 0))) return base;
  const versiones = objeto(datos.versiones);
  if (datos.version !== VERSION_PREPARACION.esquema ||
      versiones.preparador !== VERSION_PREPARACION.preparador ||
      versiones.esquema !== VERSION_PREPARACION.esquema ||
      versiones.reglas !== VERSION_PREPARACION.reglas) {
    throw new Error('Las decisiones corresponden a otra versión del preparador o de sus reglas.');
  }
  const reglas: DecisionesHistoricas['reglas'] = {};
  if (reglasCrudas.fechaCorteCartera !== undefined) {
    const aprobada = objeto(reglasCrudas.fechaCorteCartera);
    const valor = aprobada.valor;
    if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor) ||
        !Number.isFinite(Date.parse(valor)) || new Date(valor).toISOString().slice(0, 10) !== valor) {
      throw new Error('Indique una fecha de corte de cartera válida.');
    }
    reglas.fechaCorteCartera = { valor, evidencia: evidencia(aprobada.evidencia) };
  }
  if (reglasCrudas.cerosIniciales !== undefined) {
    const aprobada = objeto(reglasCrudas.cerosIniciales);
    if (aprobada.valor !== true) throw new Error('La equivalencia de ceros solo se aplica con aprobación explícita.');
    reglas.cerosIniciales = { valor: true, evidencia: evidencia(aprobada.evidencia) };
  }
  if (reglasCrudas.cuotasPorFrecuencia !== undefined) {
    const aprobada = objeto(reglasCrudas.cuotasPorFrecuencia);
    if (aprobada.valor !== true) throw new Error('La equivalencia de cuotas requiere aprobación explícita.');
    reglas.cuotasPorFrecuencia = { valor: true, evidencia: evidencia(aprobada.evidencia) };
  }
  if (reglasCrudas.cuotasPorFrecuenciaIndividual !== undefined) {
    const porFrecuencia = objeto(reglasCrudas.cuotasPorFrecuenciaIndividual);
    reglas.cuotasPorFrecuenciaIndividual = {};
    for (const [clave, dato] of Object.entries(porFrecuencia)) {
      const frecuencia = FRECUENCIAS_HISTORICAS.find((f) => f === clave);
      const aprobacion = objeto(dato);
      if (!frecuencia || aprobacion.valor !== true) {
        throw new Error('Cada frecuencia requiere una aprobación explícita.');
      }
      reglas.cuotasPorFrecuenciaIndividual[frecuencia] = { valor: true, evidencia: evidencia(aprobacion.evidencia) };
    }
  }
  if (reglasCrudas.montoArticulo !== undefined) {
    const aprobada = objeto(reglasCrudas.montoArticulo);
    if (!esInterpretacion(aprobada.valor)) throw new Error('La regla de monto no es válida.');
    reglas.montoArticulo = { valor: aprobada.valor, evidencia: evidencia(aprobada.evidencia) };
  }
  if (!Array.isArray(datos.filas) || datos.filas.length > 100_000) {
    throw new Error('La lista de decisiones por fila no es válida.');
  }

  const claves = new Set<string>();
  const canonicos = datos.filas.map((item: unknown): DecisionFila => {
    const d = objeto(item);
    const referencia = d.referencia;
    const campo = CAMPOS.find((opcion) => opcion === d.campo);
    const valor = d.valor;
    if (typeof referencia !== 'string' || !campo || !valorAdmisible(campo, valor)) {
      throw new Error('Una decisión por fila contiene un campo o valor no válido.');
    }
    const clave = referencia + '/' + campo;
    if (claves.has(clave)) throw new Error('Hay más de una decisión para el mismo campo de una fila.');
    claves.add(clave);
    const metodoVerificacion = d.metodoVerificacion;
    if (campo === 'autorizar_saldo' && metodoVerificacion !== 'TARJETA_FISICA' && metodoVerificacion !== 'SALDO_CARTERA') {
      throw new Error('La autorización de saldo requiere un método de verificación.');
    }
    return { referencia, campo, valor, evidencia: evidencia(d.evidencia),
      ...(campo === 'autorizar_saldo' ? { metodoVerificacion: metodoVerificacion as DecisionFila['metodoVerificacion'] } : {}),
    };
  });
  canonicos.sort((a, b) => (a.referencia + '/' + a.campo).localeCompare(b.referencia + '/' + b.campo));
  const responsable = datos.responsable === undefined ? undefined : evidencia(datos.responsable);
  let aprobadasEn: string | undefined;
  if (datos.aprobadasEn !== undefined) {
    if (typeof datos.aprobadasEn !== 'string' || !Number.isFinite(Date.parse(datos.aprobadasEn))) {
      throw new Error('La fecha de aprobación de las decisiones no es válida.');
    }
    aprobadasEn = new Date(datos.aprobadasEn).toISOString();
  }
  if ((responsable === undefined) !== (aprobadasEn === undefined)) {
    throw new Error('La aprobación requiere responsable y fecha.');
  }
  let rechazos: DecisionesHistoricas['rechazos'];
  if (datos.rechazos !== undefined) {
    if (!Array.isArray(datos.rechazos) || datos.rechazos.length > 100_000) throw new Error('La lista de rechazos no es válida.');
    const clavesRechazos = new Set<string>();
    rechazos = datos.rechazos.map((item: unknown) => {
      const rechazo = objeto(item);
      if (typeof rechazo.referencia !== 'string' || typeof rechazo.campo !== 'string' || rechazo.campo.length > 64) {
        throw new Error('El rechazo debe identificar una fila y un campo.');
      }
      const clave = rechazo.referencia + '/' + rechazo.campo;
      if (clavesRechazos.has(clave) || claves.has(clave)) throw new Error('Hay decisiones contradictorias para el mismo campo.');
      clavesRechazos.add(clave);
      return { referencia: rechazo.referencia, campo: rechazo.campo, evidencia: evidencia(rechazo.evidencia) };
    }).sort((a, b) => (a.referencia + '/' + a.campo).localeCompare(b.referencia + '/' + b.campo));
  }
  return { ...base, reglas, filas: canonicos, responsable, aprobadasEn, rechazos };
}

function objeto(v: unknown): Record<string, unknown> {
  if (typeof v !== 'object' || !v || Array.isArray(v)) throw new Error('Formato de decisiones inválido.');
  return v as Record<string, unknown>;
}

function evidencia(v: unknown): string {
  if (typeof v !== 'string' || v.trim().length < 3 || v.length > 500) {
    throw new Error('Cada aprobación debe identificar la evidencia que la respalda.');
  }
  return v.trim();
}

export function esInterpretacion(v: unknown): v is InterpretacionMonto {
  return v === 'PRECIO_TOTAL' || v === 'FINANCIADO';
}

function valorAdmisible(campo: CampoDecision, valor: unknown): valor is DecisionFila['valor'] {
  switch (campo) {
    case 'interpretacion_monto':
      return esInterpretacion(valor);
    case 'identidad_distinta':
    case 'sin_ajustes':
    case 'verificar_condiciones':
      return valor === true;
    case 'consolidar_cliente':
    case 'cliente_ref':
    case 'articulo_ref':
      return typeof valor === 'string' && /^[A-Z_0-9a-z-]{5,80}$/.test(valor);
    case 'fecha_credito':
    case 'primer_cobro':
    case 'ultimo_pago':
    case 'saldo_corte':
      return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor);
    default:
      return typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= 0;
  }
}
