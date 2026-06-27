export function etiquetaNivelRiesgoExport(
  nivel?: string | null,
  metrics?: { dias?: number | null },
): string {
  const dias = Number(metrics?.dias ?? NaN);
  if (Number.isFinite(dias)) {
    if (dias <= 0) return 'Al día';
    if (dias <= 3) return 'Leve';
    if (dias <= 7) return 'Precaución';
    if (dias <= 14) return 'Moderado';
    return 'Crítico';
  }

  const normalized = String(nivel || '').trim().toUpperCase();
  switch (normalized) {
    case 'VERDE':
    case 'AL_DIA':
    case 'AL DIA':
      return 'Al día';
    case 'LEVE':
      return 'Leve';
    case 'AMARILLO':
    case 'PRECAUCION':
    case 'PRECAUCIÓN':
      return 'Precaución';
    case 'ROJO':
    case 'MODERADO':
      return 'Moderado';
    case 'CRITICO':
    case 'CRÍTICO':
      return 'Crítico';
    default:
      if (normalized === ['LISTA', 'NEGRA'].join('_') || normalized === ['LISTA', 'NEGRA'].join(' ')) {
        return 'Crítico';
      }
      return normalized ? normalized.replace(/_/g, ' ') : 'Sin clasificar';
  }
}

export function claveColorRiesgoExport(
  nivel?: string | null,
  metrics?: { dias?: number | null },
): 'VERDE' | 'LEVE' | 'AMARILLO' | 'ROJO' | 'DEFAULT' {
  const etiqueta = etiquetaNivelRiesgoExport(nivel, metrics);
  switch (etiqueta) {
    case 'Al día':
      return 'VERDE';
    case 'Leve':
      return 'LEVE';
    case 'Precaución':
      return 'AMARILLO';
    case 'Moderado':
      return 'ROJO';
    case 'Crítico':
      return 'ROJO';
    default:
      return 'DEFAULT';
  }
}

export function esRiesgoCriticoExport(
  nivel?: string | null,
  metrics?: { dias?: number | null },
): boolean {
  return etiquetaNivelRiesgoExport(nivel, metrics) === 'Crítico';
}
