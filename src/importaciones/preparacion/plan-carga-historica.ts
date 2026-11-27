import { createHash } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import type { ClienteImportado, CreditoImportado, ResultadoValidacion } from '../dto/validacion-resultado.dto';
import { construirTablaCuotas, derivarPlazoMeses, mapTipoAmortizacionExcel, plazoMesesPersistido, TIPO_AMORTIZACION_POR_DEFECTO } from '../interes-credito';
import { leerFecha, leerNumero, leerTexto } from '../parsers/cell-value.util';
import type { FilaPreparada, PreparacionHistorica } from './preparar-historicos';

export const huellaReferencia = (referencia: string) => createHash('sha256').update(referencia).digest('hex');

function prepararCliente(fila: FilaPreparada): ClienteImportado {
  const v = fila.valores;
  return {
    accion: 'CREAR', esActualizacion: false, codigoImp: 'H-' + huellaReferencia(fila.referencia).slice(0, 18),
    cc: fila.referencia, nombres: leerTexto(v.nombres), apellidos: leerTexto(v.apellidos),
    telefono: leerTexto(v.telefono), correo: leerTexto(v.correo), direccion: leerTexto(v.direccion),
    referencia: leerTexto(v.referencia), referencia1Nombre: leerTexto(v.referencia1_nombre),
    referencia1Telefono: leerTexto(v.referencia1_telefono), referencia2Nombre: leerTexto(v.referencia2_nombre),
    referencia2Telefono: leerTexto(v.referencia2_telefono),
    nivelRiesgo: '', rutaCodigo: leerTexto(v.ruta).toUpperCase(), observaciones: '', fila: fila.fila,
  };
}

function prepararCredito(fila: FilaPreparada): CreditoImportado {
  const v = fila.valores;
  const articulo = fila.tipo === 'CREDITO_ARTICULO';
  const numero = leerTexto(v.numero_historico) || 'HIST-' + huellaReferencia(fila.referencia).slice(0, 40);
  const monto = leerNumero(articulo ? v.financiado : v.monto);
  const total = leerNumero(v.total_calculado);
  const saldo = leerNumero(v.saldo_calculado);
  const abonado = leerNumero(v.abonado);
  const cuotas = leerNumero(v.cuotas_aplicadas);
  const inicial = articulo ? leerNumero(v.inicial) : undefined;
  const tasa = articulo ? 0 : leerNumero(v.tasa);
  const fecha = leerFecha(v.fecha_credito);
  const primerCobro = leerFecha(v.primer_cobro);
  const metodo = articulo ? TIPO_AMORTIZACION_POR_DEFECTO : mapTipoAmortizacionExcel(v.interes);
  const frecuencia = leerTexto(v.frecuencia).toUpperCase();
  const clienteRef = leerTexto(v.cliente_ref);
  if (!clienteRef || !fecha || !primerCobro || !metodo || !cuotas || !Number.isSafeInteger(cuotas) ||
      cuotas < 1 || cuotas > 3600 || monto === null || total === null || saldo === null || abonado === null ||
      ![monto, total, saldo, abonado].every(n => Number.isFinite(n) && n >= 0 && n < 10_000_000_000) ||
      monto <= 0 || total < monto || total - abonado !== saldo ||
      tasa === null || !Number.isFinite(tasa) || tasa < 0 || tasa > 999.99 ||
      (articulo && (!leerTexto(v.articulo_ref) || inicial === null || !Number.isSafeInteger(inicial) || Number(inicial) < 0))) {
    throw new BadRequestException('No están confirmadas todas las condiciones necesarias de la fila ' + fila.fila + '.');
  }
  const plazo = articulo ? leerNumero(v.plazo) : derivarPlazoMeses(cuotas, frecuencia);
  if (plazo === null || !Number.isFinite(plazo) || plazo <= 0) {
    throw new BadRequestException('No se conoce el plazo de la fila ' + fila.fila + '.');
  }
  const cuota = construirTablaCuotas(metodo, monto, total - monto, cuotas)[0]?.monto;
  if (cuota == null || cuota <= 0) throw new BadRequestException('Plan sin cuota válida en la fila ' + fila.fila + '.');
  const pactada = leerNumero(v.valor_cuota_pactado);
  if (pactada !== null && pactada !== cuota) {
    throw new BadRequestException('La cuota pactada no coincide con el plan de la fila ' + fila.fila + '.');
  }
  return {
    accion: 'CREAR', esActualizacion: false, codigoImp: numero, numeroPrestamo: numero, ccCliente: clienteRef,
    tipoPrestamo: articulo ? 'ARTICULO' : 'EFECTIVO', productoCodigo: '',
    monto, cuotaInicial: inicial ?? undefined, tasaInteres: tasa, tasaInteresMora: undefined, frecuenciaPago: frecuencia,
    cantidadCuotas: cuotas, plazoMeses: plazo, plazoMesesPersistir: plazoMesesPersistido(plazo),
    tipoAmortizacion: metodo, fechaCredito: fecha, fechaPrimerCobro: primerCobro, tipoCarga: 'HISTORICA', descontarCaja: 'NO',
    garantia: '', notas: leerTexto(v.notas), cuotasPagadas: 0, abonoAdicional: 0, fechaUltimoPago: leerFecha(v.ultimo_pago),
    interesTotal: total - monto, totalCredito: total, valorCuota: cuota, totalAbonado: abonado, saldoPendiente: saldo,
    saldoInformado: leerNumero(v.saldo_informado) ?? undefined, fila: fila.fila, hoja: fila.hoja,
  };
}

export function planCargaHistorica(p: PreparacionHistorica, seleccion: readonly string[], clientesAdicionales: readonly string[] = []) {
  const porReferencia = new Map(p.filas.map(f => [f.referencia, f]));
  const clientes = new Map<string, { fuente: FilaPreparada; dato: ClienteImportado }>();
  const creditos = new Map<string, { fuente: FilaPreparada; dato: CreditoImportado }>();
  const documentos = new Map<string, string | null>();
  function incluirCliente(ref: string) {
    if (clientes.has(ref)) return;
    const cliente = porReferencia.get(ref);
    if (!cliente || cliente.tipo !== 'CLIENTE' || cliente.estado !== 'PARA_VALIDAR' || cliente.excepciones.length) {
      throw new BadRequestException('La selección tiene un cliente sin verificar: ' + ref);
    }
    clientes.set(ref, { fuente: cliente, dato: prepararCliente(cliente) });
    const doc = leerTexto(cliente.valores.documento);
    documentos.set(ref, /^\d{6,10}$/.test(doc) ? doc : null);
  }
  for (const referencia of clientesAdicionales) incluirCliente(referencia);
  for (const ref of seleccion) {
    const fila = porReferencia.get(ref);
    if (!fila || (fila.tipo !== 'DINERO' && fila.tipo !== 'CREDITO_ARTICULO') || fila.estado !== 'PARA_VALIDAR' ||
        fila.excepciones.length > 0 || fila.valores.consistencia_matematica !== 'CONSISTENTE' ||
        leerTexto(fila.valores.carga).toUpperCase() !== 'HISTORICA') {
      throw new BadRequestException('La selección incluye un crédito que no está listo para pruebas: ' + ref);
    }
    const credito = prepararCredito(fila);
    creditos.set(ref, { fuente: fila, dato: credito });
    incluirCliente(credito.ccCliente);
  }
  const consolidaciones = p.filas.filter(f => f.tipo === 'CLIENTE' && f.vinculadaA && clientes.has(f.vinculadaA));
  const porHoja: ResultadoValidacion['resumen']['porHoja'] = {};
  for (const { fuente } of [...clientes.values(), ...creditos.values()]) {
    const cuenta = porHoja[fuente.hoja] ??= { totalFilas: 0, filasValidas: 0, filasConError: 0 };
    cuenta.totalFilas++;
    cuenta.filasValidas++;
  }
  const total = clientes.size + creditos.size;
  const resultado: ResultadoValidacion = {
    tipo: 'clientes-creditos', archivo: p.fuentes.cartera.nombre,
    resumen: { totalFilas: total, filasValidas: total, filasConError: 0, advertencias: 0, porHoja },
    clientes: [...clientes.values()].map(c => c.dato), creditos: [...creditos.values()].map(c => c.dato),
    errores: [], advertencias: [],
  };
  return { resultado, clientes, creditos, documentos, porReferencia, consolidaciones };
}
