import type { Workbook } from 'exceljs';
import { MARCA_CAPACIDAD } from './header-map.util';

export type ModoHistoricoControlado = 'HISTORICO_REVISION' | 'HISTORICO_PRUEBA';

export function leerModoHistorico(workbook: Workbook): ModoHistoricoControlado | undefined {
  const modo = workbook.getWorksheet(MARCA_CAPACIDAD)?.getCell('A2').value;
  return modo === 'HISTORICO_REVISION' || modo === 'HISTORICO_PRUEBA' ? modo : undefined;
}

export function esCodigoArticuloHistorico(codigo: string): boolean {
  return /^ART-HIST-[A-F0-9]{12}-\d{1,5}$/i.test(codigo);
}
