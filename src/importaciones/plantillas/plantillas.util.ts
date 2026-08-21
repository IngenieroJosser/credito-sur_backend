import * as ExcelJS from 'exceljs';

/** Primera fila de datos. La fila 6 son los encabezados. */
export const FILA_ENCABEZADOS = 6;
export const FILA_INICIO_DATOS = 7;

/**
 * Filas preparadas con fórmulas, validaciones y formato en las plantillas.
 *
 * Si alguien pega más filas que estas, las de más quedan sin fórmulas ni
 * validaciones. El parser lo detecta y avisa, pero conviene que el tope sea
 * holgado: una migración de cartera normal cabe de sobra en 1.000 filas.
 */
export const FILAS_PREPARADAS = 1000;

export const COLOR_TITULO = 'FF004F7B';
export const COLOR_ENCABEZADO = 'FF4F81BD';
export const COLOR_AUTOMATICO = 'FF9E9E9E';
export const RELLENO_AUTOMATICO = 'FFF2F2F2';
export const RELLENO_GRUPO = 'FFDCE6F1';

/**
 * Moneda colombiana. `[$$-240A]` fuerza la configuración regional es-CO, para que
 * el separador de miles sea punto ($ 1.200.000) sin importar el idioma en que
 * esté instalado el Excel de quien abre el archivo.
 *
 * Sin decimales a propósito: todo el sistema maneja pesos enteros
 * (`truncCop` en el backend, `Math.trunc` en el frontend), así que mostrar
 * centavos daría a entender una precisión que después se pierde al guardar.
 */
export const FORMATO_MONEDA = '[$$-240A]#,##0';
export const FORMATO_PORCENTAJE = '0.0%';
export const FORMATO_FECHA = 'yyyy-mm-dd';

export interface ColumnaPlantilla {
  header: string;
  key: string;
  width: number;
  /** Columna calculada por Excel: no se lee al importar. */
  automatica?: boolean;
  numFmt?: string;
}

/** Convierte un índice de columna 1-based en su letra de Excel (1 -> A, 27 -> AA). */
export function colLetra(indice: number): string {
  let n = indice;
  let letra = '';
  while (n > 0) {
    const resto = (n - 1) % 26;
    letra = String.fromCharCode(65 + resto) + letra;
    n = Math.floor((n - 1) / 26);
  }
  return letra;
}

export function escribirCabecera(
  ws: ExcelJS.Worksheet,
  titulo: string,
  subtitulo: string,
  instruccion: string,
  ultimaColumna: string,
) {
  ws.mergeCells(`A1:${ultimaColumna}1`);
  const celdaTitulo = ws.getCell('A1');
  celdaTitulo.value = titulo;
  celdaTitulo.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  celdaTitulo.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: COLOR_TITULO },
  };
  celdaTitulo.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(1).height = 30;

  ws.mergeCells(`A2:${ultimaColumna}2`);
  const celdaSubtitulo = ws.getCell('A2');
  celdaSubtitulo.value = subtitulo;
  celdaSubtitulo.font = { italic: true, color: { argb: 'FF555555' } };

  ws.mergeCells(`A4:${ultimaColumna}4`);
  const celdaInstruccion = ws.getCell('A4');
  celdaInstruccion.value = instruccion;
  celdaInstruccion.font = { bold: true, color: { argb: COLOR_TITULO } };
}

/**
 * Declara las columnas y coloca los encabezados en la fila 6.
 * Las columnas marcadas como automáticas quedan sombreadas para dejar claro
 * que las calcula Excel y que no deben diligenciarse a mano.
 */
export function declararColumnas(
  ws: ExcelJS.Worksheet,
  columnas: ColumnaPlantilla[],
  filas = FILAS_PREPARADAS,
) {
  ws.columns = columnas.map(({ key, width }) => ({ key, width })) as any;

  const filaEncabezados = ws.getRow(FILA_ENCABEZADOS);
  filaEncabezados.values = columnas.map((c) => c.header);
  filaEncabezados.height = 30;
  filaEncabezados.alignment = { vertical: 'middle', wrapText: true };

  columnas.forEach((columna, indice) => {
    const numeroColumna = indice + 1;
    const celda = filaEncabezados.getCell(numeroColumna);
    celda.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    celda.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: {
        argb: columna.automatica ? COLOR_AUTOMATICO : COLOR_ENCABEZADO,
      },
    };

    if (!columna.numFmt && !columna.automatica) return;

    const columnaExcel = ws.getColumn(numeroColumna);
    if (columna.numFmt) columnaExcel.numFmt = columna.numFmt;
  });

  // Sombreado del cuerpo de las columnas automáticas.
  columnas.forEach((columna, indice) => {
    if (!columna.automatica) return;
    const numeroColumna = indice + 1;
    for (
      let fila = FILA_INICIO_DATOS;
      fila < FILA_INICIO_DATOS + filas;
      fila++
    ) {
      const celda = ws.getCell(fila, numeroColumna);
      celda.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: RELLENO_AUTOMATICO },
      };
      celda.font = { color: { argb: 'FF444444' } };
    }
  });
}

/** Etiqueta de grupo sobre un rango de columnas (fila 5). */
export function etiquetarGrupo(
  ws: ExcelJS.Worksheet,
  desde: number,
  hasta: number,
  texto: string,
) {
  ws.mergeCells(`${colLetra(desde)}5:${colLetra(hasta)}5`);
  const celda = ws.getCell(5, desde);
  celda.value = texto;
  celda.alignment = { horizontal: 'center' };
  celda.font = { bold: true, size: 10, color: { argb: COLOR_TITULO } };
  celda.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: RELLENO_GRUPO },
  };
}

export function listaDesplegable(
  ws: ExcelJS.Worksheet,
  columna: number,
  formula: string,
  permitirVacio = false,
  filas = FILAS_PREPARADAS,
) {
  for (let fila = FILA_INICIO_DATOS; fila < FILA_INICIO_DATOS + filas; fila++) {
    ws.getCell(fila, columna).dataValidation = {
      type: 'list',
      allowBlank: permitirVacio,
      formulae: [formula],
    };
  }
}

/** Escribe la misma fórmula en toda la columna, sustituyendo `{f}` por el número de fila. */
export function formulaEnColumna(
  ws: ExcelJS.Worksheet,
  columna: number,
  plantilla: string,
  filas = FILAS_PREPARADAS,
) {
  for (let fila = FILA_INICIO_DATOS; fila < FILA_INICIO_DATOS + filas; fila++) {
    ws.getCell(fila, columna).value = {
      formula: plantilla.replace(/\{f\}/g, String(fila)),
    } as any;
  }
}

/** Resalta en rojo las celdas de una columna que contengan el texto indicado. */
export function resaltarSiContiene(
  ws: ExcelJS.Worksheet,
  columna: number,
  texto: string,
  filas = FILAS_PREPARADAS,
) {
  const letra = colLetra(columna);
  ws.addConditionalFormatting({
    ref: `${letra}${FILA_INICIO_DATOS}:${letra}${FILA_INICIO_DATOS + filas - 1}`,
    rules: [
      {
        type: 'containsText',
        operator: 'containsText',
        text: texto,
        priority: 1,
        style: {
          font: { color: { argb: 'FF9C0006' }, bold: true },
          fill: {
            type: 'pattern',
            pattern: 'solid',
            bgColor: { argb: 'FFFFC7CE' },
          },
        },
      } as any,
    ],
  });
}

/** Resalta en rojo los valores negativos de una columna (utilidades en pérdida). */
export function resaltarNegativos(
  ws: ExcelJS.Worksheet,
  columna: number,
  filas = FILAS_PREPARADAS,
) {
  const letra = colLetra(columna);
  ws.addConditionalFormatting({
    ref: `${letra}${FILA_INICIO_DATOS}:${letra}${FILA_INICIO_DATOS + filas - 1}`,
    rules: [
      {
        type: 'cellIs',
        operator: 'lessThan',
        formulae: ['0'],
        priority: 1,
        style: {
          font: { color: { argb: 'FF9C0006' }, bold: true },
          fill: {
            type: 'pattern',
            pattern: 'solid',
            bgColor: { argb: 'FFFFC7CE' },
          },
        },
      } as any,
    ],
  });
}

export function congelarEncabezados(ws: ExcelJS.Worksheet, columnasFijas = 0) {
  ws.views = [
    {
      state: 'frozen',
      xSplit: columnasFijas,
      ySplit: FILA_ENCABEZADOS,
      topLeftCell: `${colLetra(columnasFijas + 1)}${FILA_INICIO_DATOS}`,
      activeCell: `A${FILA_INICIO_DATOS}`,
    },
  ];
}

export function activarFiltro(
  ws: ExcelJS.Worksheet,
  ultimaColumna: number,
  filas = FILAS_PREPARADAS,
) {
  ws.autoFilter = {
    from: { row: FILA_ENCABEZADOS, column: 1 },
    to: { row: FILA_ENCABEZADOS + filas, column: ultimaColumna },
  };
}

/** Hoja de instrucciones con líneas simples; las que empiezan por `#` son títulos. */
export function hojaInicio(
  workbook: ExcelJS.Workbook,
  titulo: string,
  lineas: string[],
): ExcelJS.Worksheet {
  const ws = workbook.addWorksheet('Inicio');
  ws.getColumn(1).width = 130;

  ws.getCell('A1').value = titulo;
  ws.getCell('A1').font = {
    bold: true,
    size: 16,
    color: { argb: COLOR_TITULO },
  };

  lineas.forEach((linea, indice) => {
    const celda = ws.getCell(`A${indice + 3}`);
    if (linea.startsWith('#')) {
      celda.value = linea.slice(1).trim();
      celda.font = { bold: true, size: 12, color: { argb: COLOR_TITULO } };
    } else {
      celda.value = linea;
      celda.alignment = { wrapText: true };
    }
  });

  return ws;
}

/** Marca el libro para que Excel recalcule todas las fórmulas al abrirlo. */
export function forzarRecalculo(workbook: ExcelJS.Workbook) {
  workbook.calcProperties = { fullCalcOnLoad: true } as any;
}

export function comoBuffer(
  data: ArrayBuffer,
  filename: string,
): { data: Buffer; contentType: string; filename: string } {
  return {
    data: Buffer.from(data),
    contentType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename,
  };
}
