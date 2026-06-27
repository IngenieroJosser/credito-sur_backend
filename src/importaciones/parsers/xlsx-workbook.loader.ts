import * as ExcelJS from 'exceljs';
import * as JSZip from 'jszip';

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

export async function loadWorkbookFromBuffer(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.load(buffer as any);
    return workbook;
  } catch (error) {
    const sanitizedBuffer = await sanitizePrefixedSpreadsheetXml(buffer);
    if (sanitizedBuffer === buffer) throw error;

    const sanitizedWorkbook = new ExcelJS.Workbook();
    await sanitizedWorkbook.xlsx.load(sanitizedBuffer as any);
    return sanitizedWorkbook;
  }
}
