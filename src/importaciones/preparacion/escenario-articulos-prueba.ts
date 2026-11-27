import { BadRequestException } from '@nestjs/common';
import type { DecisionFila, InterpretacionMonto } from './decisiones-historicas';
import { prepararFilasHistoricas, type PreparacionHistorica } from './preparar-historicos';

export interface HipotesisArticulos {
  monto: InterpretacionMonto;
  derivarCuotas: true;
  usarPrimerCobroPropuesto?: boolean;
  permitirArticuloSinCodigo?: boolean;
}

export function validarHipotesis(valor: unknown): HipotesisArticulos | undefined {
  if (valor === undefined) return undefined;
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) {
    throw new BadRequestException('El escenario de artículos no es válido.');
  }
  const h = valor as Record<string, unknown>;
  if ((h.monto !== 'PRECIO_TOTAL' && h.monto !== 'FINANCIADO') || h.derivarCuotas !== true ||
      [h.usarPrimerCobroPropuesto, h.permitirArticuloSinCodigo].some(v => v !== undefined && typeof v !== 'boolean')) {
    throw new BadRequestException('Indique la hipótesis de monto y confirme la derivación de cuotas solo para la prueba.');
  }
  return {
    monto: h.monto, derivarCuotas: true,
    ...(h.usarPrimerCobroPropuesto === true ? { usarPrimerCobroPropuesto: true } : {}),
    ...(h.permitirArticuloSinCodigo === true ? { permitirArticuloSinCodigo: true } : {}),
  };
}

export function aplicarEscenarioArticulos(
  p: PreparacionHistorica,
  referencias: readonly string[],
  h: HipotesisArticulos | undefined,
) {
  if (!h) return { paraPrueba: p, supuestos: [] as DecisionFila[] };
  const elegidas = new Set(referencias);
  const decisionesRegistradas = new Set(p.decisiones.filas.map(d => d.referencia + '/' + d.campo));
  const rechazadas = new Set(p.decisiones.rechazos?.map(d => d.referencia + '/' + d.campo));
  const supuestos: DecisionFila[] = [];
  for (const f of p.filas) {
    if (f.tipo !== 'CREDITO_ARTICULO' || !elegidas.has(f.referencia)) continue;
    const proponer = (campo: DecisionFila['campo'], valor: DecisionFila['valor'], descripcion: string) => {
      const llave = f.referencia + '/' + campo;
      if (!decisionesRegistradas.has(llave) && !rechazadas.has(llave)) {
        supuestos.push({ referencia: f.referencia, campo, valor, evidencia: 'SOLO PRUEBA: ' + descripcion });
      }
    };
    if (f.valores.financiado == null && typeof f.valores.escenario_monto_financiado === 'number' &&
        !p.decisiones.reglas.montoArticulo) {
      proponer('interpretacion_monto', h.monto, 'Interpretación no certificada del monto original.');
    }
    if (f.valores.cuotas_aplicadas == null && typeof f.valores.cuotas_sugeridas === 'number') {
      proponer('cuotas', f.valores.cuotas_sugeridas, 'Cantidad estimada a partir del plazo y frecuencia.');
    }
    if (h.usarPrimerCobroPropuesto && f.valores.primer_cobro == null) {
      const fecha = f.cambios.find(c => c.campo === 'primer_cobro' && c.procedencia === 'ESTIMADO')?.propuesta;
      if (typeof fecha === 'string') proponer('primer_cobro', fecha, 'Convención de primer vencimiento estimada.');
    }
    if (h.permitirArticuloSinCodigo && f.valores.articulo_ref == null &&
        typeof f.valores.referencia_articulo_historico === 'string') {
      proponer('articulo_ref', f.valores.referencia_articulo_historico, 'Referencia técnica sin identificar el producto.');
    }
  }
  if (!supuestos.length) return { paraPrueba: p, supuestos };
  // La preparación efímera no se guarda como revisión ni se devuelve como
  // expediente aprobado. El lote conserva aparte cada hipótesis aplicada.
  const paraPrueba = prepararFilasHistoricas({ fuentes: p.fuentes, filas: p.filas }, {
    ...p.decisiones, filas: [...p.decisiones.filas, ...supuestos],
  });
  return { paraPrueba, supuestos };
}
