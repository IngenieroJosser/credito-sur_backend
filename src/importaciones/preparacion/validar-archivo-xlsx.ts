import { inflateRaw } from 'node:zlib';
import { promisify } from 'node:util';

const inflar = promisify(inflateRaw);
const MAX_DESCOMPRIMIDO = 64 * 1024 * 1024;
const MAX_ENTRADAS = 512;

function archivoInvalido(): never {
  throw new Error('La estructura del Excel no es válida o supera los límites de preparación.');
}

/**
 * El límite del multipart cubre solo los bytes comprimidos. Verificamos cada
 * entrada antes de entregar el ZIP a ExcelJS, que no limita la expansión.
 */
export async function verificarArchivoXlsx(bytes: Buffer): Promise<void> {
  let fin = bytes.length - 22;
  const minimo = Math.max(0, bytes.length - 22 - 65535);
  for (; fin >= minimo; fin--) {
    if (bytes.readUInt32LE(fin) === 0x06054b50 && fin + 22 + bytes.readUInt16LE(fin + 20) === bytes.length) break;
  }
  if (fin < minimo || bytes.readUInt32LE(fin + 4) !== 0) archivoInvalido();
  const entradas = bytes.readUInt16LE(fin + 10);
  const longitud = bytes.readUInt32LE(fin + 12);
  let cursor = bytes.readUInt32LE(fin + 16);
  if (entradas === 0 || entradas > MAX_ENTRADAS || cursor + longitud !== fin) archivoInvalido();
  const inicioCentral = cursor;
  let total = 0;
  const nombres = new Set<string>();

  for (let i = 0; i < entradas; i++) {
    if (cursor + 46 > fin || bytes.readUInt32LE(cursor) !== 0x02014b50) archivoInvalido();
    const flags = bytes.readUInt16LE(cursor + 8);
    const metodo = bytes.readUInt16LE(cursor + 10);
    const comprimido = bytes.readUInt32LE(cursor + 20);
    const expandido = bytes.readUInt32LE(cursor + 24);
    const largoNombre = bytes.readUInt16LE(cursor + 28);
    const extras = bytes.readUInt16LE(cursor + 30);
    const comentario = bytes.readUInt16LE(cursor + 32);
    const local = bytes.readUInt32LE(cursor + 42);
    const siguiente = cursor + 46 + largoNombre + extras + comentario;
    total += expandido;
    if (siguiente > fin || total > MAX_DESCOMPRIMIDO || (flags & 1) ||
        (metodo !== 0 && metodo !== 8) || local + 30 > inicioCentral ||
        bytes.readUInt32LE(local) !== 0x04034b50) archivoInvalido();
    const nombre = bytes.subarray(cursor + 46, cursor + 46 + largoNombre).toString('utf8');
    if (!nombre || nombre.split('/').includes('..') || nombre.includes('\\') || nombres.has(nombre)) archivoInvalido();
    if (/vbaProject|\/macrosheets\//i.test(nombre)) throw new Error('La preparación no admite libros con macros.');
    nombres.add(nombre);
    const largoNombreLocal = bytes.readUInt16LE(local + 26);
    const largoExtraLocal = bytes.readUInt16LE(local + 28);
    const datos = local + 30 + largoNombreLocal + largoExtraLocal;
    if (datos + comprimido > inicioCentral ||
        bytes.readUInt16LE(local + 8) !== metodo ||
        bytes.subarray(local + 30, local + 30 + largoNombreLocal).toString('utf8') !== nombre) archivoInvalido();

    if (metodo === 0) {
      if (comprimido !== expandido) archivoInvalido();
    } else {
      try {
        const entrada = await inflar(bytes.subarray(datos, datos + comprimido), { maxOutputLength: Math.max(1, expandido) });
        if (entrada.length !== expandido) archivoInvalido();
      } catch {
        archivoInvalido();
      }
    }
    cursor = siguiente;
  }
  if (cursor !== fin || !nombres.has('xl/workbook.xml') || !nombres.has('[Content_Types].xml')) archivoInvalido();
}
