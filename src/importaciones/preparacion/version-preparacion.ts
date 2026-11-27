import { createHash } from 'node:crypto';

export const VERSION_PREPARACION = Object.freeze({
  preparador: '4.0.0',
  esquema: 2,
  reglas: 'historicos-4',
} as const);

export function huellaDecisiones(valor: unknown): string {
  const canonico = (dato: unknown): unknown => {
    if (Array.isArray(dato)) return dato.map(canonico);
    if (dato === null || typeof dato !== 'object') return dato;
    const entradas = Object.entries(dato).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
    return Object.fromEntries(entradas.map(([clave, contenido]) => [clave, canonico(contenido)]));
  };
  return createHash('sha256').update(JSON.stringify(canonico(valor))).digest('hex');
}
