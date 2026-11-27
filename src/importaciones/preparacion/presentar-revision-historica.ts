import { leerTexto } from '../parsers/cell-value.util';
import type { PreparacionHistorica } from './preparar-historicos';

export function presentarRevisionHistorica(preparacion: PreparacionHistorica) {
  const porReferencia = new Map(preparacion.filas.map(f => [f.referencia, f]));
  const candidatos = (sugerencia: string | undefined) =>
    (sugerencia ?? '').split(',').map(ref => ref.trim()).filter(Boolean).flatMap(ref => {
      const fila = porReferencia.get(ref);
      if (fila?.tipo === 'ARTICULO') return [{
        referencia: ref, campo: 'articulo_ref', etiqueta: [leerTexto(fila.valores.codigo), leerTexto(fila.valores.nombre)].filter(Boolean).join(' · '),
      }];
      if (fila?.tipo === 'CLIENTE') return [{
        referencia: ref, campo: 'cliente_ref', etiqueta: [leerTexto(fila.valores.nombres), leerTexto(fila.valores.apellidos), 'Fila ' + fila.fila].filter(Boolean).join(' · '),
      }];
      if (/^ART-HIST-[a-f0-9]{12}-\d+$/.test(ref)) return [{
        referencia: ref, campo: 'articulo_ref', etiqueta: 'Referencia histórica sin producto comercial',
      }];
      return [];
    });
  return {
  decisiones: preparacion.decisiones,
  huella: preparacion.huellaDecisiones,
  total: preparacion.filas.length,
  casos: preparacion.filas.filter((fila) => fila.excepciones.length > 0 ||
    fila.valores.conciliacion === 'NO_AUTORIZADA').map((fila) => ({
    referencia: fila.referencia, tipo: fila.tipo, hoja: fila.hoja, fila: fila.fila,
    ...(fila.valores.conciliacion ? {
      conciliacion: fila.valores.conciliacion,
      condiciones: fila.valores.condiciones_historicas,
      consistencia: fila.valores.consistencia_matematica,
    } : {}),
    ...(typeof fila.valores.escenario_monto_financiado === 'number' ? {
      escenarios: (['precio', 'financiado'] as const).map((tipo) => ({
        tipo,
        precio: fila.valores[`escenario_${tipo}_precio_pactado`] ?? null,
        inicial: fila.valores.inicial ?? null,
        financiado: fila.valores[`escenario_monto_${tipo}`] ?? null,
        total: fila.valores[`escenario_${tipo}_total_contractual`] ?? null,
        cuota: fila.valores[`escenario_${tipo}_valor_cuota`] ?? null,
        abonado: fila.valores.abonado ?? null,
        saldo: fila.valores[`escenario_${tipo}_saldo_pendiente`] ?? null,
      })),
    } : {}),
    excepciones: fila.excepciones.map((excepcion) => ({
      ...excepcion,
      candidatos: candidatos(excepcion.sugerencia).filter(c => c.referencia !== fila.referencia),
      original: fila.campos[excepcion.campo] ?? null,
      propuesta: fila.cambios.find((cambio) => cambio.campo === excepcion.campo)?.propuesta ?? null,
    })),
  })),
};
}
