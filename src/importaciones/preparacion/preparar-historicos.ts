import { esMarcadorDeCedula, esReferenciaHistoricaCliente } from '../cedula-provisional';
import { esCodigoArticuloHistorico } from '../parsers/control-historico-xlsx';
import { calcularInteresTotal, derivarCantidadCuotas, derivarPlazoMeses, mapTipoAmortizacionExcel } from '../interes-credito';
import { claveNombre, limpiarNombre, limpiarTelefono } from '../normalizacion';
import { leerFecha, leerNumero, leerTexto, leerTextoNormalizado } from '../parsers/cell-value.util';
import { FRECUENCIAS_HISTORICAS, leerDecisiones, type CampoDecision, type DecisionFila, type DecisionesHistoricas } from './decisiones-historicas';
import { huellaDecisiones, VERSION_PREPARACION } from './version-preparacion';
import { leerFuentes, type FilaOrigen, type FuenteHistorica, type Valor } from './fuentes-historicas';

type Procedencia = 'ORIGINAL' | 'NORMALIZADO' | 'GENERADO' | 'DEDUCIDO' | 'ESTIMADO' | 'DESCONOCIDO';
type Verificacion = 'SIN_VERIFICAR' | 'PROPUESTO' | 'APROBADO';
type Estado = 'PARA_VALIDAR' | 'REVISAR' | 'CONSOLIDADO';

export interface CambioHistorico {
  campo: string;
  original: Valor;
  propuesta: Valor;
  definitivo: Valor;
  procedencia: Procedencia;
  verificacion: Verificacion;
  metodo: string;
  evidencia?: string;
}

export interface ExcepcionHistorica {
  campo: string;
  motivo: string;
  sugerencia?: string;
}

export interface FilaPreparada extends FilaOrigen {
  valores: Record<string, Valor>;
  estado: Estado;
  cambios: CambioHistorico[];
  excepciones: ExcepcionHistorica[];
  vinculadaA?: string;
}

function problema(fila: FilaPreparada, campo: string, motivo: string, sugerencia?: string) {
  fila.excepciones.push({ campo, motivo, sugerencia });
}

function registrar(
  fila: FilaPreparada, campo: string, valor: Valor, procedencia: Procedencia,
  metodo: string, evidencia?: string, aplicar = true,
) {
  if (aplicar) fila.valores[campo] = valor;
  fila.cambios.push({
    campo, original: fila.campos[campo] ?? null, propuesta: valor,
    definitivo: evidencia && aplicar ? valor : null, procedencia,
    verificacion: evidencia && aplicar ? 'APROBADO' : aplicar ? 'SIN_VERIFICAR' : 'PROPUESTO',
    metodo, evidencia,
  });
}

function agrupar<T>(filas: T[], clave: (fila: T) => string): Map<string, T[]> {
  const grupos = new Map<string, T[]>();
  for (const fila of filas) {
    const k = clave(fila);
    if (!k) continue;
    const grupo = grupos.get(k);
    if (grupo) grupo.push(fila);
    else grupos.set(k, [fila]);
  }
  return grupos;
}

function documento(v: Valor | undefined): string {
  const texto = leerTexto(v);
  return /^[\d.\s]+$/.test(texto) ? texto.replace(/[.\s]/g, '') : texto;
}

function codigoNumerico(codigo: string): string {
  return /^\d+$/.test(codigo) ? codigo.replace(/^0+(?=\d)/, '') : codigo;
}

function importe(input: Valor | undefined): number | null {
  const n = leerNumero(input);
  return n !== null && Number.isSafeInteger(n) && n >= 0 ? n : null;
}

function fecha(input: Valor | undefined): string | null {
  return leerFecha(input)?.toISOString().slice(0, 10) ?? null;
}

function desplazamiento(fechaIso: string, frecuencia: string, signo: 1 | -1): string | null {
  const d = new Date(fechaIso + 'T00:00:00Z');
  if (frecuencia === 'MENSUAL') {
    const dia = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + signo);
    const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(dia, ultimo));
  } else {
    const dias = new Map([['DIARIO', 1], ['SEMANAL', 7], ['QUINCENAL', 15]]).get(frecuencia);
    if (!dias) return null;
    d.setUTCDate(d.getUTCDate() + signo * dias);
  }
  return d.toISOString().slice(0, 10);
}

function copiarCamposNormalizados(fila: FilaPreparada) {
  const clavesTexto = ['documento', 'codigo', 'codigo_articulo', 'nombres', 'apellidos', 'telefono', 'direccion'];
  for (const campo of clavesTexto) {
    const raw = fila.campos[campo];
    if (raw == null || leerTexto(raw) === '') continue;
    const texto = leerTexto(raw);
    const normalizado = campo === 'documento' ? documento(raw)
      : campo === 'telefono' ? limpiarTelefono(texto)
      : campo === 'nombres' || campo === 'apellidos' ? limpiarNombre(texto)
      : campo.startsWith('codigo') ? texto.toUpperCase() : texto;
    if (normalizado !== raw) registrar(fila, campo, normalizado || null, 'NORMALIZADO', 'Formato de captura');
  }
}

type BuscarDecision = (fila: FilaPreparada, campo: CampoDecision) => DecisionFila | undefined;

function resolverClientes(clientes: FilaPreparada[], decision: BuscarDecision) {
  const porReferencia = new Map(clientes.map((c) => [c.referencia, c]));
  const grupos = agrupar(clientes, (c) => documento(c.valores.documento));
  const nombres = agrupar(clientes, (c) => claveNombre(leerTexto(c.valores.nombres), leerTexto(c.valores.apellidos)));
  const consolidados = new Map<string, string>();
  const tieneReferenciaUnica = (fila: FilaPreparada) => {
    const doc = documento(fila.valores.documento);
    const propia = /^\d{6,10}$/.test(doc) ||
      (esReferenciaHistoricaCliente(doc) && doc === documento(fila.campos.cliente_tecnico));
    return propia && (grupos.get(doc)?.filter(c => !c.vinculadaA).length ?? 0) === 1;
  };

  for (const c of clientes) {
    if (!leerTexto(c.valores.nombres)) problema(c, 'nombres', 'No se conoce el nombre.');
    const doc = documento(c.valores.documento);
    if (!doc || esMarcadorDeCedula(doc) || esReferenciaHistoricaCliente(doc)) {
      registrar(c, 'identidad_tecnica', c.referencia, 'GENERADO', 'Referencia estable de archivo y fila; no es cédula');
    } else if (!/^\d{6,10}$/.test(doc)) {
      problema(c, 'documento', 'El documento no tiene un formato reconocido.');
    }
    for (const campo of ['documento', 'apellidos', 'telefono', 'direccion', 'ruta']) {
      if (!leerTexto(c.valores[campo])) registrar(c, campo, null, 'DESCONOCIDO', 'Sin dato en la fuente');
    }

    const d = decision(c, 'consolidar_cliente');
    if (!d) continue;
    const destino = porReferencia.get(String(d.valor));
    if (!destino || destino === c || decision(destino, 'consolidar_cliente')) {
      throw new Error('Una consolidación apunta a sí misma, a otra consolidación o a una referencia inexistente.');
    }
    consolidados.set(c.referencia, destino.referencia);
    c.vinculadaA = destino.referencia;
    registrar(c, 'cliente_ref', destino.referencia, 'DEDUCIDO', 'Consolidación aprobada', d.evidencia);
  }

  const origenesPorDestino = agrupar(clientes, (c) => c.vinculadaA ?? '');
  for (const c of clientes) {
    if (c.vinculadaA) continue;
    const origenes = origenesPorDestino.get(c.referencia) ?? [];
    for (const campo of ['nombres', 'apellidos', 'telefono', 'direccion', 'ruta', 'correo']) {
      const opciones = [...new Set(origenes.map((fila) => leerTexto(fila.valores[campo])).filter(Boolean))];
      const actual = leerTexto(c.valores[campo]);
      if (opciones.length === 1 && !actual) {
        const filaOrigen = origenes.find((fila) => leerTexto(fila.valores[campo]) === opciones[0]);
        registrar(c, campo, opciones[0], 'DEDUCIDO', 'Complemento de registro consolidado: ' + filaOrigen?.referencia);
      } else if (opciones.some((opcion) => opcion !== actual)) {
        problema(c, campo, 'Los registros consolidados difieren. Se mantiene el valor original del registro principal.');
      }
    }
    const doc = documento(c.valores.documento);
    const misma = (grupos.get(doc) ?? []).filter((fila) => !fila.vinculadaA);
    const distintos = misma.length > 1 && esMarcadorDeCedula(doc) &&
      misma.every((fila) => decision(fila, 'identidad_distinta')?.valor === true);
    if (misma.length > 1 && !distintos) {
      const conflictos = ['nombres', 'apellidos', 'telefono', 'direccion'].filter((campo) =>
        new Set(misma.map((fila) => leerTextoNormalizado(fila.valores[campo])).filter(Boolean)).size > 1,
      );
      problema(c, 'documento', conflictos.length ? 'Identificación repetida con conflicto en ' + conflictos.join(', ') : 'Identificación repetida; candidatos a consolidación.', misma.map((fila) => fila.referencia).join(', '));
    } else if (distintos) {
      registrar(c, 'identidad_distinta', true, 'DEDUCIDO', 'Referencias provisionales de personas distintas', decision(c, 'identidad_distinta')?.evidencia);
    }
    const clave = claveNombre(leerTexto(c.valores.nombres), leerTexto(c.valores.apellidos));
    const posibles = (nombres.get(clave) ?? []).filter((otra) =>
      otra !== c && !otra.vinculadaA && documento(otra.valores.documento) !== doc,
    );
    if (posibles.length) {
      const referencias = posibles.map(otra => otra.referencia).join(', ');
      if (tieneReferenciaUnica(c) && posibles.every(tieneReferenciaUnica)) {
        registrar(c, 'identidad_homonima', referencias, 'DEDUCIDO', 'Mismo nombre; se conservan las referencias explícitas y distintas.', undefined, false);
      } else {
        problema(c, 'identidad', 'Mismo nombre normalizado sin referencias únicas suficientes.', referencias);
      }
    }
  }

  function relacionar(fila: FilaPreparada) {
    const d = decision(fila, 'cliente_ref');
    const doc = documento(fila.valores.documento);
    const referencias = (grupos.get(doc) ?? []).map((c) => consolidados.get(c.referencia) ?? c.referencia);
    const candidatas = [...new Set(referencias)];
    const ref = d ? String(d.valor) : candidatas.length === 1 ? candidatas[0] : null;
    const c = ref ? porReferencia.get(ref) : undefined;
    if (d && (!c || c.vinculadaA)) throw new Error('Una relación de cliente aprobada no apunta a una fila principal.');
    if (!c) {
      problema(fila, 'cliente_ref', candidatas.length ? 'Hay más de un cliente candidato.' : 'No se encontró el cliente en la fuente.', candidatas.join(', ') || undefined);
    } else if (c.excepciones.some(({ campo }) => ['documento', 'identidad', 'nombres'].includes(campo))) {
      problema(fila, 'cliente_ref', 'El cliente candidato tiene un conflicto de identidad sin resolver.', c.referencia);
    } else {
      registrar(fila, 'cliente_ref', c.referencia, 'DEDUCIDO', d ? 'Asignación aprobada' : 'Identificación única dentro de este archivo', d?.evidencia);
    }
  }
  return relacionar;
}

function resolverArticulos(articulos: FilaPreparada[], decisiones: DecisionesHistoricas, decision: BuscarDecision) {
  const exactos = agrupar(articulos, (a) => leerTexto(a.valores.codigo));
  const normalizados = agrupar(articulos, (a) => codigoNumerico(leerTexto(a.valores.codigo)));
  const porReferencia = new Map(articulos.map((a) => [a.referencia, a]));

  for (const a of articulos) {
    const codigo = leerTexto(a.valores.codigo);
    if (!codigo || (exactos.get(codigo)?.length ?? 0) > 1) problema(a, 'codigo', 'Falta el código o el código está repetido.');
    const costo = leerNumero(a.valores.costo);
    if (costo === null || !Number.isFinite(costo) || costo < 0) problema(a, 'costo', 'Costo desconocido o inválido; no equivale a cero.');
    for (const n of [1, 2, 3]) {
      const precio = leerNumero(a.originales['Precio total opción ' + n] ?? a.originales['Precio opción ' + n]);
      if (precio !== null && Number.isFinite(precio) && importe(a.valores['meses_' + n]) === null) {
        problema(a, 'meses_' + n, 'Se informó un precio pero no el plazo.');
      }
    }
  }

  return (fila: FilaPreparada) => {
    const d = decision(fila, 'articulo_ref');
    const codigo = leerTexto(fila.valores.codigo_articulo);
    const historica = 'ART-HIST-' + fila.referencia.slice('CREDITO_ARTICULO-'.length);
    if (esCodigoArticuloHistorico(leerTexto(fila.campos.referencia_historica_articulo)) &&
        fila.campos.referencia_historica_articulo === codigo && !d && !rechazada(fila, decisiones, 'articulo_ref')) {
      registrar(fila, 'referencia_articulo_historico', codigo, 'GENERADO', 'Referencia de historial, sin existencias comerciales');
      registrar(fila, 'articulo_ref', codigo, 'GENERADO', 'Referencia del expediente histórico');
      return;
    }
    if (!codigo) registrar(fila, 'referencia_articulo_historico', historica, 'GENERADO', 'Referencia de historial: no es producto de inventario');
    if (d?.valor === historica && !codigo) {
      registrar(fila, 'articulo_ref', historica, 'GENERADO', 'Artículo histórico aprobado, sin alta de inventario', d.evidencia);
      return;
    }
    if (d) {
      const a = porReferencia.get(String(d.valor));
      if (!a) throw new Error('Una decisión de artículo no corresponde a la fuente.');
      registrar(fila, 'articulo_ref', a.referencia, 'DEDUCIDO', 'Asociación aprobada', d.evidencia);
      return;
    }
    const coincidencias = exactos.get(codigo) ?? [];
    if (coincidencias.length === 1) {
      registrar(fila, 'articulo_ref', coincidencias[0].referencia, 'DEDUCIDO', 'Código exacto y único');
      return;
    }
    const candidatas = normalizados.get(codigoNumerico(codigo)) ?? [];
    if (!coincidencias.length && candidatas.length === 1 && decisiones.reglas.cerosIniciales && !rechazada(fila, decisiones, 'articulo_ref')) {
      registrar(fila, 'articulo_ref', candidatas[0].referencia, 'DEDUCIDO', 'Equivalencia por ceros iniciales', decisiones.reglas.cerosIniciales.evidencia);
      return;
    }
    if (candidatas.length === 1 && !coincidencias.length) {
      registrar(fila, 'articulo_ref', candidatas[0].referencia, 'DEDUCIDO', 'Candidato único por ceros iniciales', undefined, false);
    }
    problema(fila, 'articulo_ref', !codigo ? 'El crédito no trae código de artículo.' : 'No hay una asociación exacta y única aprobada.', candidatas.map((a) => a.referencia).join(', ') || (!codigo ? historica : undefined));
  };
}

function revisarFechas(fila: FilaPreparada) {
  for (const campo of ['fecha_credito', 'primer_cobro', 'ultimo_pago', 'saldo_corte']) {
    const raw = fila.valores[campo];
    const iso = fecha(raw);
    if (raw != null && leerTexto(raw) !== '' && !iso) problema(fila, campo, 'Fecha inválida: consulte la fuente.');
    else if (iso && iso !== raw) registrar(fila, campo, iso, 'NORMALIZADO', 'Fecha en formato año-mes-día');
  }
  const credito = fecha(fila.valores.fecha_credito);
  const primer = fecha(fila.valores.primer_cobro);
  const ultimo = fecha(fila.valores.ultimo_pago);
  const corte = fecha(fila.valores.saldo_corte);
  if (corte && ((credito && corte < credito) || (ultimo && corte < ultimo))) {
    problema(fila, 'saldo_corte', 'La fecha de corte es anterior al crédito o al último pago informado.');
  }
  const frecuencia = leerTextoNormalizado(fila.valores.frecuencia);
  const desorden = Boolean(credito && primer && primer < credito);
  if (desorden) problema(fila, 'primer_cobro', 'El primer cobro antecede al crédito. No se corrige automáticamente.');
  if (credito && ultimo && ultimo < credito) problema(fila, 'ultimo_pago', 'El último pago antecede al crédito.');
  if (!credito || desorden) {
    const candidato = primer && desplazamiento(primer, frecuencia, -1);
    if (candidato) registrar(fila, 'fecha_credito', candidato, 'ESTIMADO', 'Si el primer vencimiento ocurrió un período después del crédito', undefined, false);
    if (!credito) problema(fila, 'fecha_credito', 'No se conoce la fecha del crédito.');
  }
  if (!primer || desorden) {
    const candidato = credito && desplazamiento(credito, frecuencia, 1);
    if (candidato) registrar(fila, 'primer_cobro', candidato, 'ESTIMADO', 'Si se pactó el primer cobro un período después de otorgar el crédito', undefined, false);
    if (!primer) problema(fila, 'primer_cobro', 'No se conoce el primer cobro. La estimación no habilita cobranza.');
  }
}

function conciliar(fila: FilaPreparada, decisiones: DecisionesHistoricas, decision: BuscarDecision) {
  const art = fila.tipo === 'CREDITO_ARTICULO';
  const precio = importe(fila.valores.precio_pactado);
  const monto = importe(fila.valores.monto);
  let financiado = importe(fila.valores.financiado);
  let inicial = importe(fila.valores.inicial);
  let abonado = importe(fila.valores.abonado);
  const informado = importe(fila.valores.saldo_informado);
  const frecuencia = leerTextoNormalizado(fila.valores.frecuencia);
  let cuotas = importe(fila.valores.cuotas);

  if (leerTextoNormalizado(fila.valores.carga) !== 'HISTORICA') {
    problema(fila, 'carga', 'La fila no está identificada como carga histórica.');
  }
  if (!['DIARIO', 'SEMANAL', 'QUINCENAL', 'MENSUAL'].includes(frecuencia)) {
    problema(fila, 'frecuencia', 'No se conoce una frecuencia de pago válida.');
  }
  if (art) {
    const plazo = leerNumero(fila.valores.plazo);
    if (plazo === null || !Number.isFinite(plazo) || plazo <= 0) problema(fila, 'plazo', 'No se conoce el plazo pactado.');
    if (!cuotas && plazo !== null && Number.isFinite(plazo) && plazo > 0) {
      const derivadas = derivarCantidadCuotas(plazo, frecuencia);
      const frecuenciaReconocida = FRECUENCIAS_HISTORICAS.find((f) => f === frecuencia);
      const reglaCuotas = (frecuenciaReconocida && decisiones.reglas.cuotasPorFrecuenciaIndividual?.[frecuenciaReconocida]) ??
        decisiones.reglas.cuotasPorFrecuencia;
      fila.valores.cuotas_sugeridas = derivadas > 0 ? derivadas : null;
      if (derivadas > 0 && reglaCuotas && !rechazada(fila, decisiones, 'cuotas')) {
        cuotas = derivadas;
        registrar(fila, 'cuotas', derivadas, 'DEDUCIDO', 'Equivalencia de plazo y frecuencia aprobada para el lote', reglaCuotas.evidencia);
      } else {
        if (derivadas > 0) registrar(fila, 'cuotas', derivadas, 'ESTIMADO', 'Equivalencia de plazo y frecuencia del sistema, por confirmar', undefined, false);
        problema(fila, 'cuotas', 'Verifique que la cantidad estimada corresponda al contrato histórico.');
      }
    }
    const regla = decision(fila, 'interpretacion_monto') ??
      (rechazada(fila, decisiones, 'interpretacion_monto') ? undefined : decisiones.reglas.montoArticulo);
    if (monto !== null) {
      fila.valores.escenario_monto_financiado = monto;
      fila.valores.escenario_monto_precio = inicial !== null && monto > inicial ? monto - inicial : null;
    }
    if (financiado === null && precio !== null && inicial !== null && precio > inicial) {
      financiado = precio - inicial;
      registrar(fila, 'financiado', financiado, 'DEDUCIDO', 'Precio total pactado menos inicial');
    } else if (financiado === null && monto !== null && inicial === 0) {
      financiado = monto;
      registrar(fila, 'financiado', financiado, 'DEDUCIDO', 'Con inicial confirmada en cero, precio y financiado coinciden');
    } else if (financiado === null && monto !== null && regla && (regla.valor === 'FINANCIADO' || inicial !== null)) {
      financiado = regla.valor === 'FINANCIADO' ? monto : monto - (inicial ?? 0);
      registrar(fila, 'financiado', financiado, 'DEDUCIDO', 'Interpretación aprobada de Monto: ' + regla.valor, regla.evidencia);
    }
    if (inicial === null && precio !== null && financiado !== null && precio >= financiado) {
      inicial = precio - financiado;
      registrar(fila, 'inicial', inicial, 'DEDUCIDO', 'Precio pactado menos total financiado');
    }
    if (precio !== null && inicial !== null && financiado !== null && precio !== inicial + financiado) {
      problema(fila, 'financiado', 'El precio pactado no concilia con inicial más financiado.');
    }
    if (inicial === null) {
      registrar(fila, 'inicial', null, 'DESCONOCIDO', 'Sin precio y financiado independientes');
      problema(fila, 'inicial', 'No se puede reconstruir la inicial con los datos conocidos.');
    }
    if (financiado === null || financiado <= 0) problema(fila, 'financiado', 'No se conoce el monto financiado. Compare ambos escenarios si la plantilla solo trae Monto.');
  }

  const principal = art ? financiado : monto;
  let total: number | null = null;
  if (art && principal !== null && principal > 0) total = principal;
  if (!art) {
    const metodo = mapTipoAmortizacionExcel(fila.valores.interes);
    const tasa = leerNumero(fila.valores.tasa);
    const plazo = cuotas ? derivarPlazoMeses(cuotas, frecuencia) : 0;
    if (principal && tasa !== null && Number.isFinite(tasa) && tasa >= 0 && metodo && plazo > 0) {
      total = principal + calcularInteresTotal(metodo, principal, tasa, plazo);
    } else {
      problema(fila, 'obligacion', 'Capital, tasa, método o cuotas insuficientes para calcular la obligación.');
    }
  }

  if (abonado === null && total !== null && informado !== null && informado <= total) {
    const d = decision(fila, 'sin_ajustes');
    const corte = fecha(fila.valores.saldo_corte);
    if (d && corte && !fila.excepciones.some(e => e.campo === 'saldo_corte')) {
      abonado = total - informado;
      registrar(fila, 'abonado', abonado, 'DEDUCIDO', 'Obligación menos saldo al corte ' + corte + ', sin ajustes', d.evidencia);
    } else {
      registrar(fila, 'abonado', total - informado, 'ESTIMADO', 'Solo si el saldo coincide en fecha de corte y no hubo ajustes', undefined, false);
    }
  }
  if (abonado === null) {
    registrar(fila, 'abonado', null, 'DESCONOCIDO', 'Sin abono ni saldo independiente con corte y ajustes verificados');
    problema(fila, 'abonado', 'El avance de cobro es desconocido; no se reemplaza por cero.');
  }
  if (total !== null) fila.valores.total_calculado = total;
  fila.valores.cuotas_aplicadas = cuotas;
  if (art && cuotas && total !== null) fila.valores.valor_cuota_calculado = Math.floor(total / cuotas);
  if (art) {
    for (const [escenario, esPrecio] of [['precio', true], ['financiado', false]] as const) {
      const contractual = importe(fila.valores['escenario_monto_' + escenario]);
      const categoria = 'escenario_' + escenario + '_';
      if (contractual === null) continue;
      fila.valores[categoria + 'precio_pactado'] = esPrecio ? monto : inicial === null ? null : contractual + inicial;
      fila.valores[categoria + 'total_contractual'] = contractual;
      fila.valores[categoria + 'valor_cuota'] = cuotas ? Math.floor(contractual / cuotas) : null;
      fila.valores[categoria + 'saldo_pendiente'] = abonado === null ? null : contractual - abonado;
    }
  }
  const saldo = total !== null && abonado !== null ? total - abonado : null;
  if (saldo !== null) {
    fila.valores.saldo_calculado = saldo;
    if (saldo < 0) problema(fila, 'conciliacion', 'El abono supera la obligación calculada; se conserva lo informado.');
    if (informado !== null) {
      fila.valores.diferencia = saldo - informado;
      if (saldo !== informado) problema(fila, 'conciliacion', 'El saldo de cartera no coincide con el cálculo.');
    }
  }
  const consistente = saldo !== null && saldo >= 0 && (informado === null || saldo === informado);
  fila.valores.consistencia_matematica = saldo === null ? 'NO_CALCULABLE' : consistente ? 'CONSISTENTE' : 'DIFERENCIA';
  const condiciones = decision(fila, 'verificar_condiciones');
  const autorizacion = decision(fila, 'autorizar_saldo');
  const revisionIdentificada = Boolean(decisiones.responsable && decisiones.aprobadasEn);
  fila.valores.condiciones_historicas = condiciones && revisionIdentificada ? 'VERIFICADAS' : 'SIN_VERIFICAR';
  fila.valores.conciliacion = 'NO_AUTORIZADA';
  const saldoExcel = leerNumero(fila.campos.saldo_excel);
  if (saldoExcel !== null && saldoExcel < 0) {
    if (condiciones && autorizacion && revisionIdentificada && consistente && autorizacion.valor === saldo) {
      registrar(fila, 'saldo_excel', saldoExcel, 'ORIGINAL', 'Diferencia de origen revisada sin alterar la evidencia', condiciones.evidencia, false);
    } else {
      problema(fila, 'conciliacion', 'El cálculo guardado en el Excel de origen es negativo.');
    }
  }
  if (autorizacion) {
    const corte = fecha(fila.valores.saldo_corte);
    const metodo = autorizacion.metodoVerificacion;
    if (!consistente || !condiciones || !revisionIdentificada || !corte || autorizacion.valor !== saldo ||
        !metodo || (metodo === 'SALDO_CARTERA' && informado === null) || fila.excepciones.length > 0) {
      problema(fila, 'autorizar_saldo', 'Para autorizar se necesitan condiciones verificadas, fecha de corte, saldo coincidente y ninguna excepción pendiente.');
    } else {
      registrar(fila, 'saldo_autorizado', autorizacion.valor, 'DEDUCIDO', metodo + ' al corte ' + corte, autorizacion.evidencia);
      fila.valores.conciliacion = metodo;
    }
  }
}

function rechazada(fila: FilaPreparada, decisiones: DecisionesHistoricas, campo: string) {
  return fila.excepciones.some((excepcion) => excepcion.campo === campo) &&
    decisiones.rechazos?.some((rechazo) => rechazo.referencia === fila.referencia && rechazo.campo === campo);
}

export async function prepararHistoricos(
  cartera: FuenteHistorica,
  inventario: FuenteHistorica,
  aprobaciones?: unknown,
) {
  return prepararFilasHistoricas(await leerFuentes(cartera, inventario), aprobaciones);
}

export function prepararFilasHistoricas(
  origen: Awaited<ReturnType<typeof leerFuentes>>,
  aprobaciones?: unknown,
) {
  const decisiones = leerDecisiones(aprobaciones, {
    cartera: origen.fuentes.cartera.sha256,
    inventario: origen.fuentes.inventario.sha256,
  });
  const filas: FilaPreparada[] = origen.filas.map((fila) => ({
    ...fila, valores: { ...fila.campos }, estado: 'PARA_VALIDAR', cambios: [], excepciones: [],
  }));
  const porReferencia = new Map(filas.map((fila) => [fila.referencia, fila]));
  const porDecision = new Map(decisiones.filas.map((d) => [d.referencia + '/' + d.campo, d]));
  const decision: BuscarDecision = (fila, campo) => porDecision.get(fila.referencia + '/' + campo);
  for (const fila of filas) copiarCamposNormalizados(fila);

  for (const d of decisiones.filas) {
    const fila = porReferencia.get(d.referencia);
    if (!fila) throw new Error('Hay una decisión con una referencia de origen inexistente.');
    const esCliente = ['consolidar_cliente', 'identidad_distinta'].includes(d.campo);
    const esArticulo = ['articulo_ref', 'interpretacion_monto', 'precio_pactado', 'financiado', 'inicial'].includes(d.campo);
    if ((esCliente && fila.tipo !== 'CLIENTE') ||
        (esArticulo && fila.tipo !== 'CREDITO_ARTICULO') ||
        (!esCliente && !esArticulo && !['DINERO', 'CREDITO_ARTICULO'].includes(fila.tipo))) {
      throw new Error('Una decisión no corresponde al tipo de fila.');
    }
    if (!['consolidar_cliente', 'identidad_distinta', 'cliente_ref', 'articulo_ref', 'interpretacion_monto'].includes(d.campo)) {
      registrar(fila, d.campo, d.valor, 'ORIGINAL', 'Dato aportado con evidencia', d.evidencia);
    }
  }

  for (const rechazo of decisiones.rechazos ?? []) {
    const fila = porReferencia.get(rechazo.referencia);
    if (!fila) throw new Error('Hay un rechazo con una referencia inexistente.');
    problema(fila, rechazo.campo, 'Propuesta rechazada; no se aplica sin otra evidencia.');
  }

  const relacionarCliente = resolverClientes(filas.filter((f) => f.tipo === 'CLIENTE'), decision);
  const relacionarArticulo = resolverArticulos(filas.filter((f) => f.tipo === 'ARTICULO'), decisiones, decision);
  for (const fila of filas) {
    if (fila.tipo === 'DINERO' || fila.tipo === 'CREDITO_ARTICULO') {
      relacionarCliente(fila);
      if (fila.tipo === 'CREDITO_ARTICULO') relacionarArticulo(fila);
      const corteLote = decisiones.reglas.fechaCorteCartera;
      if (corteLote && !leerTexto(fila.valores.saldo_corte) && !rechazada(fila, decisiones, 'saldo_corte')) {
        registrar(fila, 'saldo_corte', corteLote.valor, 'ORIGINAL', 'Fecha de corte común del expediente', corteLote.evidencia);
      }
      revisarFechas(fila);
      conciliar(fila, decisiones, decision);
    }
    fila.estado = fila.vinculadaA ? 'CONSOLIDADO' : fila.excepciones.length > 0 ? 'REVISAR' : 'PARA_VALIDAR';
  }

  return {
    version: VERSION_PREPARACION.esquema, versiones: VERSION_PREPARACION,
    huellaDecisiones: huellaDecisiones(decisiones), fuentes: origen.fuentes, decisiones, filas,
    ...(origen.modoIntegral && { modoIntegral: origen.modoIntegral }),
  };
}

export type PreparacionHistorica = Awaited<ReturnType<typeof prepararHistoricos>>;
