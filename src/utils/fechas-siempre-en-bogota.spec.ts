import * as fs from 'fs';
import * as path from 'path';

/**
 * Ninguna fecha se formatea con el reloj del proceso.
 *
 * El servidor corre en UTC y Bogotá es UTC-5, así que desde las 7 de la noche de
 * Bogotá en UTC ya es el día siguiente. Cualquier código que saque el día, el mes
 * o la hora del reloj del proceso corre la fecha, y lo que se fecha en este
 * sistema son movimientos de dinero.
 *
 * Esta prueba mira el código fuente, y no el comportamiento, porque el fallo no
 * está en un sitio: está en que es más corto escribir `d.getDate()` que importar
 * el helper, y en una máquina en hora de Colombia el resultado es idéntico. Ya
 * se corrigió al menos tres veces —el comentario de `formatBogotaFecha` dice que
 * se arregló "en los reportes y las exportaciones"— y volvió a aparecer en el
 * respaldo en Excel, en el contrato de crédito de artículo, en la cabecera de la
 * exportación de ruta, en el aviso de prórroga y en dos columnas de hora del
 * tablero.
 *
 * Lo que NO se prohíbe: la aritmética de fechas. `d.setDate(d.getDate() + 7)`
 * adelanta siete días y la lectura y la escritura se cancelan; Colombia no tiene
 * horario de verano, así que no hay borde donde eso falle. Lo que se prohíbe es
 * LEER el reloj para construir un texto o para agrupar por día.
 */

const RAIZ = path.join(__dirname, '..');
const OMITIR = new Set(['node_modules', 'dist', 'coverage', 'generated']);

/**
 * Patrones que sacan la fecha del reloj del proceso. Cada uno con el helper que
 * hay que usar en su lugar, porque el mensaje de fallo tiene que decir qué
 * escribir, no solo qué está mal.
 */
const PROHIBIDO: { re: RegExp; motivo: string }[] = [
  {
    re: /\.getHours\(\)|\.getMinutes\(\)|\.getSeconds\(\)/,
    motivo:
      'la hora del proceso — usa formatBogotaHora o formatBogotaFechaHoraPad2',
  },
  {
    // La ARITMETICA se permite: en `d.setDate(d.getDate() + 7)` la lectura y la
    // escritura se cancelan, y Colombia no tiene horario de verano, asi que no
    // hay borde donde eso falle. Lo que se persigue es LEER el reloj para armar
    // un texto o para agrupar por dia.
    re: /\.getDate\(\)(?!\s*[+-])/,
    motivo:
      'el día del proceso — usa formatBogotaFechaPad2, formatBogotaFechaLarga o getBogotaDayKey',
  },
  {
    re: /\.getMonth\(\)(?!\s*[+-])/,
    motivo: 'el mes del proceso — usa formatBogotaFechaLarga o getBogotaDayKey',
  },
  {
    re: /\.getDay\(\)/,
    motivo: 'el día de la semana del proceso — usa getBogotaWeekday',
  },
  {
    re: /toLocaleDateString\(|toLocaleTimeString\(/,
    motivo:
      'formatea sin zona: sigue el reloj del proceso — usa los helpers de date-utils',
  },
  {
    re: /toISOString\(\)\s*\.\s*(?:slice\(0,\s*10\)|split\('T'\)\[0\])/,
    motivo:
      'el día en UTC, que de noche ya es el siguiente — usa getBogotaDayKey',
  },
];

/**
 * Excepciones, por fragmento de código y con el motivo escrito. Van por
 * fragmento y no por número de línea para que no tapen otra cosa al moverse.
 */
const PERMITIDOS: { archivo: string; fragmento: string; motivo: string }[] = [
  {
    archivo: 'utils/date-utils.ts',
    fragmento: 'timeZone: BOGOTA_TZ',
    motivo:
      'Es el archivo que resuelve la zona: aquí viven los helpers que todos los demás usan.',
  },
  {
    archivo: 'importaciones/parsers/cell-value.util.ts',
    fragmento:
      'if (limpio instanceof Date) return limpio.toISOString().slice(0, 10);',
    motivo:
      'Aqui UTC es lo CORRECTO y Bogota seria el error. ExcelJS entrega las celdas ' +
      'de fecha como medianoche UTC —son fechas sin hora, escritas a mano en la ' +
      'plantilla—, asi que pasarlas a Bogota las dejaria a las 7 p. m. del dia ' +
      'ANTERIOR y toda importacion perderia un dia.',
  },
  {
    archivo: 'dashboard/dashboard.service.ts',
    fragmento: 'startDate.getMonth(),',
    motivo:
      'Arma el primer dia del mes del rango y acto seguido lo reancla con ' +
      '`getBogotaStartEndOfDay`. `startDate` ya es una medianoche de Bogota ' +
      '(05:00 UTC), asi que el mes sale correcto. Misma fragilidad anotada en las ' +
      'etiquetas del grafico.',
  },
  {
    archivo: 'dashboard/dashboard.service.ts',
    fragmento: 'startDate.getFullYear(),',
    motivo: 'Lo mismo, en la misma expresion.',
  },
  {
    archivo: 'dashboard/dashboard.service.ts',
    fragmento:
      "const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`",
    motivo:
      'La clave mensual de la serie. `current` se fija con `setTime` al inicio del ' +
      'dia de Bogota justo antes del bucle.',
  },
  {
    archivo: 'reports/reports.service.ts',
    fragmento: 'if (cur.getDay() !== 0) count++;',
    motivo:
      'Cuenta días no domingo recorriendo fechas ancladas al MEDIODÍA de Bogotá ' +
      '(`${startKey}T12:00:00-05:00`). Anclar al mediodía es el patrón seguro del ' +
      'proyecto —el mismo de `buildBogotaNoon` en mora.service—: a esa hora ningún ' +
      'desfase de zona cambia el día.',
  },
  {
    archivo: 'dashboard/dashboard.service.ts',
    fragmento: 'const dayName = daysOfWeek[currentDate.getDay()];',
    motivo:
      'Las etiquetas del gráfico. `currentDate` es medianoche de Bogotá (05:00 UTC) ' +
      'porque viene de `calculateDateRange`, así que en UTC el día sale correcto. ' +
      'Queda documentado como frágil y no como fallo: en un proceso al oeste de ' +
      'Bogotá la etiqueta se separaría del dato, que sí se agrupa con ' +
      '`getBogotaStartEndOfDay`.',
  },
  {
    archivo: 'dashboard/dashboard.service.ts',
    fragmento: 'const dayNumber = currentDate.getDate();',
    motivo: 'Lo mismo que `dayName`, en la misma etiqueta.',
  },
  {
    archivo: 'dashboard/dashboard.service.ts',
    fragmento: "const monthName = currentDate.toLocaleDateString('es-CO', {",
    motivo: 'Lo mismo que `dayName`, en la misma etiqueta.',
  },
  {
    archivo: 'dashboard/dashboard.service.ts',
    fragmento: "const monthName = current.toLocaleDateString('es-CO', {",
    motivo:
      'El nombre del mes en la serie mensual. `current` sale de ' +
      '`getBogotaStartEndOfDay`, y el mes de una medianoche de Bogotá es el mismo ' +
      'en UTC.',
  },
  {
    archivo: 'dashboard/dashboard.service.ts',
    fragmento:
      "const monthKey = `${dayStartBogota.getFullYear()}-${String(dayStartBogota.getMonth() + 1).padStart(2, '0')}`",
    motivo:
      'Agrupa por mes a partir de una medianoche de Bogotá, que en UTC cae a las ' +
      '05:00 del mismo día: el mes no cambia.',
  },
  {
    archivo: 'reports/reports.service.ts',
    fragmento:
      "mes: new Date(year, i).toLocaleString('es-ES', { month: 'short' })",
    motivo:
      'No formatea un instante guardado: construye una fecha local a partir de un ' +
      'año y un índice de mes para sacar solo el nombre del mes. No hay conversión ' +
      'de zona que pueda correrlo.',
  },
];

function archivosFuente(dir: string, acc: string[] = []): string[] {
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    if (OMITIR.has(entrada.name)) continue;
    const completo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) archivosFuente(completo, acc);
    else if (
      entrada.name.endsWith('.ts') &&
      !/\.spec\.ts$/.test(entrada.name)
    ) {
      acc.push(completo);
    }
  }
  return acc;
}

describe('las fechas van siempre en hora de Bogota', () => {
  const archivos = archivosFuente(RAIZ);

  it('encuentra archivos que revisar', () => {
    // Si la búsqueda se rompe, el resto pasaría en vacío sin comprobar nada.
    expect(archivos.length).toBeGreaterThan(100);
  });

  it('no quedan excepciones muertas en la lista', () => {
    // Una excepción cuyo fragmento ya no existe deja de proteger nada y pasa a
    // ser una nota falsa; peor, podría tapar un uso nuevo en ese mismo archivo.
    const muertas = PERMITIDOS.filter(({ archivo, fragmento }) => {
      const completo = path.join(RAIZ, archivo);
      if (!fs.existsSync(completo)) return true;
      return !fs.readFileSync(completo, 'utf8').includes(fragmento);
    }).map(({ archivo, fragmento }) => `${archivo}  ->  ${fragmento}`);

    expect(muertas.join('\n')).toBe('');
  });

  it.each(PROHIBIDO)('ningun archivo lee $motivo', ({ re, motivo }) => {
    const infractores: string[] = [];

    for (const archivo of archivos) {
      const relativo = path.relative(RAIZ, archivo).replace(/\\/g, '/');
      const exenciones = PERMITIDOS.filter((p) => p.archivo === relativo);

      const lineas = fs.readFileSync(archivo, 'utf8').split('\n');
      lineas.forEach((linea, i) => {
        // Los comentarios hablan DE estos patrones a propósito, para explicar
        // por qué no se usan.
        const limpia = linea.trim();
        if (limpia.startsWith('//') || limpia.startsWith('*')) return;
        if (!re.test(linea)) return;
        if (exenciones.some((p) => linea.includes(p.fragmento))) return;
        infractores.push(`${relativo}:${i + 1}  ${limpia}`);
      });
    }

    const informe = infractores.length
      ? [
          `Estas lineas sacan la fecha del reloj del proceso (${motivo}).`,
          'El servidor corre en UTC: de noche, el dia que escriben es el siguiente.',
          'Si el cero de este caso es legitimo, va a PERMITIDOS con su motivo.',
          '',
          ...infractores,
        ].join('\n')
      : '';

    expect(informe).toBe('');
  });
});
