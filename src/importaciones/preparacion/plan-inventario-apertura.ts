import { BadRequestException } from '@nestjs/common';
import { Workbook } from 'exceljs';
import type { TransaccionPrisma } from '../../prisma/prisma.service';
import { InventarioParser } from '../parsers/inventario.parser';
import { leerNumero } from '../parsers/cell-value.util';
import type { FilaPreparada, PreparacionHistorica } from './preparar-historicos';

export async function planInventarioApertura(
  p: PreparacionHistorica,
  referencias: readonly string[],
  tx: Pick<TransaccionPrisma, 'producto'>,
) {
  const todas = new Map(p.filas.filter(f => f.tipo === 'ARTICULO').map(f => [f.referencia, f]));
  const filas: FilaPreparada[] = [];
  for (const ref of referencias) {
    const fila = todas.get(ref);
    const costo = leerNumero(fila?.valores.costo);
    const stock = leerNumero(fila?.valores.stock);
    if (!fila || fila.estado !== 'PARA_VALIDAR' || fila.excepciones.length || costo === null ||
        !Number.isFinite(costo) || costo < 0 || costo >= 100_000_000 ||
        stock === null || !Number.isSafeInteger(stock) || stock < 0) {
      throw new BadRequestException('Artículo sin costo o existencias verificables para apertura: ' + ref);
    }
    filas.push(fila);
  }

  // Se reutilizan exactamente las reglas del importador modular. Solo se copian
  // valores ya leídos, nunca fórmulas ni enlaces externos de las fuentes.
  const libro = new Workbook();
  const hoja = libro.addWorksheet('Artículos');
  const columnas = [...new Set(filas.flatMap(f => Object.keys(f.originales)))];
  hoja.getRow(6).values = columnas;
  for (const fila of filas) hoja.addRow(columnas.map(c => fila.originales[c] ?? null));
  const resultado = await new InventarioParser(tx).parseAndValidate(
    Buffer.from(await libro.xlsx.writeBuffer()),
    p.fuentes.inventario.nombre,
    true,
  );
  const referenciaPorCodigo = new Map((resultado.articulos ?? []).map(a => [a.codigo, filas[a.fila - 7].referencia]));
  const problemas = resultado.errores.map(e => ({ ...e, referencia: filas[e.fila - 7]?.referencia ?? null }));
  return { resultado, referenciaPorCodigo, problemas };
}
