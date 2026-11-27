import { Workbook, type Worksheet } from 'exceljs';
import type { Prisma } from '@prisma/client';
import { comoBuffer, FORMATO_MONEDA } from '../plantillas/plantillas.util';
import type { FilaPreparada, PreparacionHistorica } from './preparar-historicos';

const ETIQUETAS: Record<string, string> = {
  documento: 'Identificación original / provisional',
  identidad_tecnica: 'Referencia técnica (no es cédula)',
  cliente_ref: 'Referencia del cliente',
  articulo_ref: 'Referencia del artículo',
  referencia_articulo_historico: 'Artículo histórico (sin alta de inventario)',
  precio_pactado: 'Precio total pactado',
  financiado: 'Total financiado',
  inicial: 'Cuota inicial',
  abonado: 'Total abonado',
  saldo_informado: 'Saldo registrado por cartera',
  saldo_calculado: 'Saldo calculado',
  total_calculado: 'Obligación calculada',
  saldo_excel: 'Saldo guardado en el Excel',
  diferencia: 'Diferencia contra cartera',
  escenario_monto_precio: 'Financiado si Monto era precio',
  escenario_monto_financiado: 'Financiado si Monto ya era financiado',
};
const MONEDA = new Set([
  'costo', 'precio_contado', 'monto', 'precio_pactado', 'financiado', 'inicial', 'abonado',
  'saldo_informado', 'saldo_calculado', 'saldo_excel', 'total_calculado', 'diferencia',
  'escenario_monto_precio', 'escenario_monto_financiado',
]);
const REFERENCIA = ['Referencia', 'Archivo', 'Hoja original', 'Fila original'];

function fuente(f: FilaPreparada, p: PreparacionHistorica) {
  return [f.referencia, p.fuentes[f.fuente].nombre, f.hoja, f.fila];
}

function tabla(ws: Worksheet, encabezados: string[], moneda: number[] = []) {
  ws.addRow(encabezados);
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: encabezados.length } };
  ws.getRow(1).height = 30;
  ws.getRow(1).eachCell((cell, col) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF004F7B' } };
    cell.alignment = { wrapText: true, vertical: 'middle' };
    ws.getColumn(col).width = Math.min(44, Math.max(16, encabezados[col - 1].length + 4));
    if (moneda.includes(col)) ws.getColumn(col).numFmt = FORMATO_MONEDA;
  });
}

export interface EvidenciaCargaHistorica {
  expedienteId: string;
  estado: string;
  loteId: string;
  confirmadaEn: Date;
  loteInventarioId?: string | null;
  resultado?: Prisma.JsonValue;
  asociaciones: readonly { referencia: string; entidad: string; entidadId: string }[];
}

function objeto(valor: Prisma.JsonValue | undefined): Prisma.JsonObject | null {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor) ? valor : null;
}

function escalar(valor: Prisma.JsonValue | undefined): string | number | boolean | null {
  return typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean' ? valor : null;
}

export async function generarConsolidadoHistorico(p: PreparacionHistorica, prueba?: EvidenciaCargaHistorica): Promise<Buffer> {
  const libro = new Workbook();
  libro.creator = 'Créditos del Sur';
  const inicio = libro.addWorksheet('Inicio');
  tabla(inicio, ['Control', 'Detalle']);
  inicio.getColumn(2).width = 96;
  inicio.addRows([
    ['Estado', 'Solo revisión. Este archivo no se puede importar ni habilita cobranza.'],
    ['Para validar', 'Sin conflictos detectados en preparación. Falta validar contra una base aislada y autorizar el lote.'],
    ['Revisar', 'Consulte Excepciones. Las propuestas no resueltas no se incorporan como datos definitivos.'],
    ['Consolidado', 'Se mantiene la fila original y la referencia del cliente que la reemplaza.'],
    ['Origen', 'Los valores de fórmula son su resultado guardado. Consulte Evidencia de celdas para distinguirlos. Las fórmulas no se ejecutaron ni copiaron.'],
    ['Preparador', p.versiones.preparador], ['Esquema', p.versiones.esquema], ['Reglas', p.versiones.reglas],
    ['SHA-256 decisiones', p.huellaDecisiones],
    ['Generado UTC', new Date().toISOString()],
    ['Responsable de decisiones', p.decisiones.responsable ?? 'Sin aprobación registrada'],
    ['Aprobadas UTC', p.decisiones.aprobadasEn ?? null],
    ['Cartera', p.fuentes.cartera.nombre], ['SHA-256 cartera', p.fuentes.cartera.sha256],
    ['Inventario', p.fuentes.inventario.nombre], ['SHA-256 inventario', p.fuentes.inventario.sha256],
    ['Filas de origen', p.filas.length],
    ['Para validar', p.filas.filter((f) => f.estado === 'PARA_VALIDAR').length],
    ['Para revisar', p.filas.filter((f) => f.estado === 'REVISAR').length],
    ['Consolidadas', p.filas.filter((f) => f.estado === 'CONSOLIDADO').length],
  ]);

  for (const [tipo, nombre, hojaOriginal] of [
    ['CLIENTE', 'Clientes preparados', 'Origen clientes'],
    ['ARTICULO', 'Artículos preparados', 'Origen artículos'],
    ['DINERO', 'Dinero preparado', 'Origen dinero'],
    ['CREDITO_ARTICULO', 'Créditos preparados', 'Origen crédito artículo'],
  ] as const) {
    const filas = p.filas.filter((f) => f.tipo === tipo);
    const ws = libro.addWorksheet(nombre);
    const crudas = libro.addWorksheet(hojaOriginal);
    const campos = [...new Set(filas.flatMap((fila) => Object.keys(fila.valores)))];
    const originales = [...new Set(filas.flatMap((fila) => Object.keys(fila.originales)))];
    tabla(ws, [...REFERENCIA, 'Estado', 'Vinculada a', ...campos.map((f) => ETIQUETAS[f] ?? f.replace(/_/g, ' '))],
      campos.flatMap((campo, i) => MONEDA.has(campo) ? [i + 7] : []));
    tabla(crudas, [...REFERENCIA, ...originales]);
    for (const f of filas) {
      const ref = fuente(f, p);
      ws.addRow([...ref, f.estado, f.vinculadaA ?? null, ...campos.map((c) => f.valores[c] ?? null)]);
      crudas.addRow([...ref, ...originales.map((c) => f.originales[c] ?? null)]);
    }
  }

  const excepciones = libro.addWorksheet('Excepciones');
  tabla(excepciones, [...REFERENCIA, 'Estado', 'Campo', 'Qué revisar', 'Referencias sugeridas']);
  const traza = libro.addWorksheet('Trazabilidad');
  tabla(traza, [...REFERENCIA, 'Campo', 'Original', 'Propuesta', 'Definitivo en preparación', 'Procedencia', 'Verificación', 'Método / supuesto', 'Evidencia']);
  const evidencia = libro.addWorksheet('Evidencia de celdas');
  tabla(evidencia, [...REFERENCIA, 'Celda', 'Encabezado', 'Clase de evidencia', 'Valor guardado']);
  const conciliar = libro.addWorksheet('Conciliación');
  tabla(conciliar, [...REFERENCIA, 'Estado', 'Monto original', 'Inicial', 'Si Monto era precio', 'Si Monto era financiado', 'Obligación calculada', 'Total abonado', 'Saldo calculado', 'Saldo de cartera', 'Fecha de corte', 'Diferencia', 'Saldo Excel', 'Consistencia matemática', 'Condiciones históricas', 'Método de conciliación', 'Saldo autorizado en revisión'], [6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 20]);
  for (const f of p.filas) {
    const ref = fuente(f, p);
    for (const entrada of f.evidencia) {
      evidencia.addRow([...ref, entrada.celda, entrada.encabezado, entrada.clase, entrada.valor]);
    }
    for (const e of f.excepciones) {
      excepciones.addRow([...ref, f.estado, ETIQUETAS[e.campo] ?? e.campo, e.motivo, e.sugerencia ?? null]);
    }
    for (const c of f.cambios) {
      traza.addRow([...ref, ETIQUETAS[c.campo] ?? c.campo, c.original, c.propuesta, c.definitivo, c.procedencia, c.verificacion, c.metodo, c.evidencia ?? null]);
    }
    if (f.tipo === 'DINERO' || f.tipo === 'CREDITO_ARTICULO') {
      conciliar.addRow([...ref, f.estado, ...[
        'monto', 'inicial', 'escenario_monto_precio', 'escenario_monto_financiado',
        'total_calculado', 'abonado', 'saldo_calculado', 'saldo_informado', 'saldo_corte', 'diferencia', 'saldo_excel',
        'consistencia_matematica', 'condiciones_historicas', 'conciliacion', 'saldo_autorizado',
      ].map((c) => f.valores[c] ?? null)]);
    }
  }

  if (prueba) {
    inicio.addRows([
      ['Expediente', prueba.expedienteId], ['Lote de cartera PostgreSQL aislado', prueba.loteId],
      ['Lote de apertura PostgreSQL aislado', prueba.loteInventarioId ?? null],
      ['Estado de prueba', prueba.estado], ['Prueba registrada UTC', prueba.confirmadaEn.toISOString()],
      ['Autorización de cobranza', 'La carga aislada no autoriza cobranza ni promoción a producción.'],
    ]);
    const resultados = libro.addWorksheet('Carga aislada');
    tabla(resultados, ['Referencia', 'Entidad', 'Identificador interno', 'Resultado']);
    const cargadas = new Set(prueba.asociaciones.map(a => a.referencia));
    for (const a of prueba.asociaciones) resultados.addRow([a.referencia, a.entidad, a.entidadId,
      prueba.estado === 'REVERTIDO' ? 'Revertido; se conserva como evidencia' : 'Persistido en prueba']);
    for (const f of p.filas) if (!cargadas.has(f.referencia)) {
      const entidad = f.tipo === 'ARTICULO' ? 'PRODUCTO' : f.tipo === 'CLIENTE' ? 'CLIENTE' : 'PRESTAMO';
      resultados.addRow([f.referencia, entidad, null, 'No persistido en esta selección de prueba']);
    }

    const resultado = objeto(prueba.resultado);
    const inventario = objeto(resultado?.inventario);
    if (inventario) {
      inicio.addRows([
        ['Fecha de corte de inventario', escalar(inventario.fechaCorte) ?? 'No confirmada; no se inventó'],
        ['Productos de apertura', escalar(inventario.productosCreados)], ['Precios de apertura', escalar(inventario.preciosCreados)],
        ['Método de apertura', 'Alta de existencias, inventario contra capital de apertura. Sin caja ni compra.'],
      ]);
    }
    const supuestos = resultado?.supuestosDePrueba;
    if (Array.isArray(supuestos) && supuestos.length) {
      const ws = libro.addWorksheet('Supuestos de prueba');
      tabla(ws, ['Referencia', 'Hoja original', 'Fila original', 'Campo', 'Original', 'Valor aplicado en prueba', 'Supuesto', 'Uso']);
      const porReferencia = new Map(p.filas.map(f => [f.referencia, f]));
      for (const entrada of supuestos) {
        const dato = objeto(entrada);
        if (!dato || typeof dato.referencia !== 'string') continue;
        const f = porReferencia.get(dato.referencia);
        ws.addRow([dato.referencia, f?.hoja, f?.fila, escalar(dato.campo), escalar(dato.original),
          escalar(dato.valor), escalar(dato.evidencia), 'Solo prueba; no autoriza cobranza']);
      }
    }
  }
  return comoBuffer(await libro.xlsx.writeBuffer(), 'consolidado-historico-revision.xlsx').data;
}
