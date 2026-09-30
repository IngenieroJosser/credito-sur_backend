import * as ExcelJS from 'exceljs';
import * as JSZip from 'jszip';
/**
 * Copia un `Buffer` de Node a un `ArrayBuffer` de verdad.
 *
 * ExcelJS declara `interface Buffer extends ArrayBuffer` (su `index.d.ts`, linea 1), asi
 * que su `load` pide un ArrayBuffer, no el `Buffer` de Node —que es un `Uint8Array`—. Eso
 * es lo que obligaba a castear la llamada con `as any`.
 *
 * Se copia en vez de pasar `buffer.buffer`: un Buffer de Node puede ser una VISTA sobre
 * un bloque compartido mas grande (con `byteOffset`), y pasar el bloque entero leeria
 * bytes que no son del archivo.
 */
function aArrayBuffer(buffer: Buffer): ArrayBuffer {
  const copia = new Uint8Array(buffer.byteLength);
  copia.set(buffer);
  return copia.buffer;
}

async function sanitizePrefixedSpreadsheetXml(buffer: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer);
  let changed = false;

  await Promise.all(
    Object.keys(zip.files).map(async (name) => {
      const file = zip.files[name];
      if (file.dir || !name.endsWith('.xml')) return;

      const xml = await file.async('string');
      const sanitized = xml.replace(/(<\/?)([A-Za-z_][\w.-]*):/g, '$1');

      if (sanitized !== xml) {
        changed = true;
        zip.file(name, sanitized);
      }
    }),
  );

  if (!changed) return buffer;

  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  });
}

export async function loadWorkbookFromBuffer(
  buffer: Buffer,
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.load(aArrayBuffer(buffer));
    return workbook;
  } catch (error) {
    const sanitizedBuffer = await sanitizePrefixedSpreadsheetXml(buffer);
    if (sanitizedBuffer === buffer) throw error;

    const sanitizedWorkbook = new ExcelJS.Workbook();
    await sanitizedWorkbook.xlsx.load(aArrayBuffer(sanitizedBuffer));
    return sanitizedWorkbook;
  }
}
