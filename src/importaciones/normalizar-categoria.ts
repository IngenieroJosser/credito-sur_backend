/**
 * Clave de comparación de categorías: sin mayúsculas, sin acentos y sin espacios
 * sobrantes, para no duplicar la misma categoría escrita distinto.
 *
 * Vive en su propio archivo, y SIN un solo import, a propósito. Estaba dentro de
 * `importaciones.service.ts`, que son 2 618 líneas y arrastra NestJS, Prisma y
 * exceljs: su prueba —que solo comprueba texto— ocupaba 600 MB de heap por ese
 * import. Multiplicado por los workers de Jest, era la mitad de la memoria de la
 * máquina. Medido con `--logHeapUsage`.
 */
export function normalizarNombreCategoria(valor: unknown): string {
  if (typeof valor !== 'string') return '';
  return valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // marcas de acento
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}
