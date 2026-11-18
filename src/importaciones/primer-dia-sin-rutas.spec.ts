import * as ExcelJS from 'exceljs';

import {
  generarPlantillaClientesCreditos,
  type DatosReferenciaPlantilla,
} from './plantillas/plantilla-clientes-creditos';

/**
 * El primer dia del cliente.
 *
 * Estrenar el sistema empieza por importar los clientes y sus creditos. Y la
 * columna «Ruta codigo» de esa plantilla es OBLIGATORIA, porque un credito sin
 * ruta no entra en la jornada de nadie: existe, devenga mora y nadie va a
 * cobrarlo.
 *
 * El problema era el orden. Al estrenar no hay ninguna ruta creada, asi que:
 *
 *   - el desplegable de esa columna no se pone —`plantilla-clientes-creditos`
 *     solo lo anade `if (datos.rutas.length > 0)`—, de modo que la celda no
 *     ofrece nada;
 *   - la hoja de referencia «BD Clientes» sale vacia;
 *   - y al subir el archivo, cada fila responde «Es requerida», que describe la
 *     celda y no la causa.
 *
 * O sea: llenar quinientas filas para recibir quinientos errores sin que nada
 * diga que lo que falta no esta en el archivo, sino en el sistema. Esta prueba
 * fija que se avise en los dos momentos: al descargar y al validar.
 */

const sinRutas: DatosReferenciaPlantilla = {
  clientes: [],
  articulos: [],
  codigosArticulo: [],
  numerosPrestamo: [],
  rutas: [],
};

const conRutas: DatosReferenciaPlantilla = {
  ...sinRutas,
  rutas: ['RT-CENTRO', 'RT-NORTE'],
};

const leerHojaEjemplos = async (datos: DatosReferenciaPlantilla) => {
  const buffer = await generarPlantillaClientesCreditos(datos);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer.data as never);
  const hoja = wb.getWorksheet('Ejemplos');
  expect(hoja).toBeDefined();
  return hoja as ExcelJS.Worksheet;
};

describe('la plantilla avisa cuando todavia no hay rutas', () => {
  it('lo dice en la hoja de ejemplos, antes de que llene nada', async () => {
    const hoja = await leerHojaEjemplos(sinRutas);

    const titulo = String(hoja.getCell('A2').value || '');
    const explicacion = String(hoja.getCell('B2').value || '');

    expect(titulo).toMatch(/ANTES DE LLENAR/i);
    expect(explicacion).toMatch(/ruta/i);
    // Lo que hay que hacer, no solo lo que pasa.
    expect(explicacion).toMatch(/vuelva a descargar/i);
  });

  it('y no estorba cuando ya hay rutas', async () => {
    const hoja = await leerHojaEjemplos(conRutas);

    expect(String(hoja.getCell('A2').value || '')).not.toMatch(
      /ANTES DE LLENAR/i,
    );
  });

  it('el aviso no pisa la guia de ejemplos, que empieza en la fila 3', async () => {
    const hoja = await leerHojaEjemplos(sinRutas);

    // Piso: si la guia se moviera a la fila 2, el aviso la borraria y esta
    // prueba lo veria.
    expect(String(hoja.getCell('A3').value || '')).toMatch(/HOJA "Clientes"/);
  });

  it('la plantilla se genera igual sin rutas: no es un error, es el primer dia', async () => {
    const buffer = await generarPlantillaClientesCreditos(sinRutas);
    expect(buffer.data.byteLength).toBeGreaterThan(5000);
  });
});
