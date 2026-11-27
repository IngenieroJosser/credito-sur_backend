import { Workbook } from 'exceljs';
import * as JSZip from 'jszip';
import { bufferDeExcel } from '../../common/testing/dobles';
import { generarConsolidadoHistorico } from './consolidado-historico';
import type { DecisionesHistoricas } from './decisiones-historicas';
import { prepararHistoricos } from './preparar-historicos';

async function fuentes(opciones: { colisionCodigo?: boolean; duplicadoCliente?: boolean } = {}) {
  const book = new Workbook();
  const clientes = book.addWorksheet('Clientes');
  clientes.getRow(6).values = ['CC cliente', 'Nombres', 'Apellidos', 'Teléfono', 'Ruta código'];
  clientes.addRows([['1', 'Cliente ficticio'], [null, 'Otra persona']]);
  if (opciones.duplicadoCliente) clientes.addRow(['1', 'Registro distinto']);
  const dinero = book.addWorksheet('Créditos de dinero');
  dinero.getRow(6).values = ['CC cliente', 'Monto', 'Tipo carga', 'Cuotas', 'Total abonado'];
  const credito = book.addWorksheet('Créditos de artículo');
  credito.getRow(6).values = [
    'CC cliente', 'Código del artículo', 'Tipo carga', 'Monto', 'Cuota inicial', 'Total abonado',
    'Frecuencia pago', 'Plazo meses', 'Cantidad cuotas', 'Fecha crédito', 'Fecha primer cobro',
    'Precio total pactado', 'Total financiado', 'Saldo informado por cartera', 'Fecha de corte',
    'Saldo pendiente (automático)', 'Resultado lógico', 'Resultado inválido', 'Celda vacía explícita',
  ];
  credito.addRows([
    ['1', 4, 'HISTORICA', 1000, 200, 0, 'MENSUAL', 3, 3, '2026-01-31', '2026-02-28'],
    ['1', null, 'HISTORICA', null, null, null, 'MENSUAL', 3, 3, '2026-01-31', null, 1200, 1000, 600, '2026-03-30'],
  ]);
  credito.getCell('P7').value = { formula: '7-7', result: 0 };
  credito.getCell('Q7').value = { formula: '1=0', result: false };
  credito.getCell('R7').value = { formula: '1/0', result: { error: '#DIV/0!' } };
  credito.getCell('S7').value = '';
  const stock = new Workbook();
  const articulos = stock.addWorksheet('Artículos');
  articulos.getRow(6).values = ['Código', 'Nombre del artículo', 'Costo unitario'];
  articulos.addRow(['004', '=NoEjecutar()', 500]);
  if (opciones.colisionCodigo) articulos.addRow(['04', 'Código distinto', 500]);
  return {
    cartera: { nombre: 'cartera.xlsx', bytes: Buffer.from(await book.xlsx.writeBuffer()) },
    inventario: { nombre: 'inventario.xlsx', bytes: Buffer.from(await stock.xlsx.writeBuffer()) },
  };
}

function creditoPrimero(p: Awaited<ReturnType<typeof prepararHistoricos>>) {
  return p.filas.find((f) => f.tipo === 'CREDITO_ARTICULO' && f.fila === 7)!;
}

describe('Preparación reproducible de cartera', () => {
  it('conserva homónimos con referencias técnicas distintas y no resuelve referencias repetidas', async () => {
    const book = new Workbook();
    book.addWorksheet('_CrediSur').getCell('A2').value = 'HISTORICO_PRUEBA';
    const clientes = book.addWorksheet('Clientes');
    clientes.getRow(6).values = ['CC cliente', 'Nombres', 'Referencia de importación'];
    clientes.addRows([[null, 'Nombre igual', 'HIST-UNO'], [null, 'Nombre igual', 'HIST-DOS']]);
    const dinero = book.addWorksheet('Créditos de dinero');
    dinero.getRow(6).values = ['Cliente / Referencia', 'Monto', 'Tipo carga'];
    dinero.addRow(['HIST-DOS', 500000, 'HISTORICA']);
    book.addWorksheet('Créditos de artículo').getRow(6).values = ['CC cliente', 'Código del artículo', 'Tipo carga'];
    book.addWorksheet('Artículos').getRow(6).values = ['Código', 'Nombre del artículo', 'Costo unitario'];
    const preparar = async () => {
      const libro = { nombre: 'integral.xlsx', bytes: bufferDeExcel(await book.xlsx.writeBuffer()) };
      return prepararHistoricos(libro, libro);
    };
    const correcto = await preparar();
    const segundo = correcto.filas.find(f => f.tipo === 'CLIENTE' && f.fila === 8);
    expect(correcto.modoIntegral).toBe('HISTORICO_PRUEBA');
    expect(segundo?.excepciones).toEqual([]);
    expect(segundo?.cambios).toEqual(expect.arrayContaining([expect.objectContaining({ campo: 'identidad_homonima' })]));
    expect(correcto.filas.find(f => f.tipo === 'DINERO')?.valores.cliente_ref).toBe(segundo?.referencia);
    clientes.getCell('C7').value = 'HIST-DOS';
    const repetido = await preparar();
    expect(repetido.filas.find(f => f.tipo === 'DINERO')?.excepciones).toEqual(expect.arrayContaining([
      expect.objectContaining({ campo: 'cliente_ref' }),
    ]));
  });

  it('documenta un corte común, no reemplaza el corte individual ni autoriza por sí solo', async () => {
    const { cartera, inventario } = await fuentes();
    const base = await prepararHistoricos(cartera, inventario);
    const prepararConCorte = (valor: string) => prepararHistoricos(cartera, inventario, {
      ...base.decisiones, reglas: { fechaCorteCartera: { valor, evidencia: 'Acta de cartera sintética' } },
    });
    const p = await prepararConCorte('2026-04-30');
    expect(creditoPrimero(p).valores).toMatchObject({ saldo_corte: '2026-04-30', conciliacion: 'NO_AUTORIZADA' });
    expect(creditoPrimero(p).valores.saldo_informado).toBeNull();
    expect(creditoPrimero(p).cambios).toEqual(expect.arrayContaining([
      expect.objectContaining({ campo: 'saldo_corte', evidencia: 'Acta de cartera sintética' }),
    ]));
    expect(p.filas.find(f => f.tipo === 'CREDITO_ARTICULO' && f.fila === 8)?.valores.saldo_corte).toBe('2026-03-30');
    expect(creditoPrimero(await prepararConCorte('2026-01-01')).excepciones).toEqual(expect.arrayContaining([
      expect.objectContaining({ campo: 'saldo_corte' }),
    ]));
    await expect(prepararConCorte('2026-02-30')).rejects.toThrow(/fecha de corte/);
  });

  it('rechaza un archivo con metadatos de macros aunque termine en .xlsx', async () => {
    const { cartera, inventario } = await fuentes();
    const zip = await JSZip.loadAsync(cartera.bytes);
    zip.file('xl/vbaProject.bin', 'marcador de prueba; no contiene código');
    const adulterado = { ...cartera, bytes: await zip.generateAsync({ type: 'nodebuffer' }) };
    await expect(prepararHistoricos(adulterado, inventario)).rejects.toThrow(/no admite libros con macros/);
  });
  it('mantiene referencias estables, candidatos sin aprobar y ceros explícitos', async () => {
    const { cartera, inventario } = await fuentes();
    const p = await prepararHistoricos(cartera, inventario);
    expect(await prepararHistoricos(cartera, inventario)).toEqual(p);
    expect(p.filas.filter((f) => f.tipo === 'CLIENTE').map((f) => f.valores.identidad_tecnica)).toEqual([
      expect.stringMatching(/^CLIENTE-.*-7$/), expect.stringMatching(/^CLIENTE-.*-8$/),
    ]);
    const a = creditoPrimero(p);
    expect(a.valores).toMatchObject({ abonado: 0, escenario_monto_precio: 800, escenario_monto_financiado: 1000 });
    expect(a.valores.articulo_ref).toBeUndefined();
    expect(a.cambios).toEqual(expect.arrayContaining([expect.objectContaining({ campo: 'articulo_ref', verificacion: 'PROPUESTO' })]));
    const segundo = p.filas.find((f) => f.tipo === 'CREDITO_ARTICULO' && f.fila === 8)!;
    expect(segundo.valores.inicial).toBe(200);
    expect(segundo.valores.abonado).toBeNull();
    expect(segundo.valores.referencia_articulo_historico).toMatch(/^ART-HIST-/);
    expect(segundo.cambios).toEqual(expect.arrayContaining([
      expect.objectContaining({ campo: 'primer_cobro', procedencia: 'ESTIMADO', propuesta: '2026-02-28', definitivo: null }),
      expect.objectContaining({ campo: 'abonado', procedencia: 'ESTIMADO', propuesta: 400, definitivo: null }),
    ]));
  });

  it('conserva el cero de fórmula como evidencia y como valor, incluso tras exportar', async () => {
    const { cartera, inventario } = await fuentes();
    const p = await prepararHistoricos(cartera, inventario);
    expect(creditoPrimero(p).campos.saldo_excel).toBe(0);
    expect(creditoPrimero(p).evidencia).toEqual(expect.arrayContaining([
      expect.objectContaining({ celda: 'P7', clase: 'FORMULA_CON_RESULTADO', valor: 0 }),
      expect.objectContaining({ celda: 'Q7', clase: 'FORMULA_CON_RESULTADO', valor: false }),
      expect.objectContaining({ celda: 'R7', clase: 'ERROR_EXCEL', valor: '#DIV/0!' }),
      expect.objectContaining({ celda: 'S7', clase: 'CADENA_VACIA', valor: '' }),
    ]));
    const libro = new Workbook();
    await libro.xlsx.load(bufferDeExcel(await generarConsolidadoHistorico(p)));
    const hoja = libro.getWorksheet('Origen crédito artículo')!;
    const valores = hoja.getRow(2).values as unknown[];
    expect(valores.filter((v) => v === 0)).toHaveLength(2);
    expect(p.versiones.preparador).toBe('4.0.0');
    expect(p.huellaDecisiones).toMatch(/^[a-f0-9]{64}$/);
  });

  it('solo aplica cuotas para la frecuencia aprobada y permite reemplazarlas por lo pactado', async () => {
    const { cartera, inventario } = await fuentes();
    const wb = new Workbook();
    await wb.xlsx.load(bufferDeExcel(cartera.bytes));
    const hoja = wb.getWorksheet('Créditos de artículo')!;
    hoja.getCell('I7').value = null;
    hoja.getCell('I8').value = null;
    hoja.getCell('G8').value = 'SEMANAL';
    cartera.bytes = Buffer.from(await wb.xlsx.writeBuffer());
    const previo = await prepararHistoricos(cartera, inventario);
    expect(creditoPrimero(previo).valores).toMatchObject({ cuotas_sugeridas: 3, cuotas_aplicadas: null });
    const decisiones: DecisionesHistoricas = {
      ...previo.decisiones,
      reglas: { cuotasPorFrecuenciaIndividual: { MENSUAL: { valor: true, evidencia: 'Tarjetas mensuales de prueba' } } },
    };
    const aplicado = await prepararHistoricos(cartera, inventario, decisiones);
    expect(creditoPrimero(aplicado).valores.cuotas_aplicadas).toBe(3);
    expect(aplicado.filas.find(f => f.tipo === 'CREDITO_ARTICULO' && f.fila === 8)?.valores)
      .toMatchObject({ cuotas_sugeridas: 12, cuotas_aplicadas: null });
    const corregido = await prepararHistoricos(cartera, inventario, {
      ...decisiones,
      filas: [{ referencia: creditoPrimero(previo).referencia, campo: 'cuotas', valor: 4, evidencia: 'Excepción pactada sintética' }],
    });
    expect(creditoPrimero(corregido).valores.cuotas_aplicadas).toBe(4);
  });

  it('distingue saldo calculable de saldo autorizado con condiciones, corte y método independientes', async () => {
    const { cartera, inventario } = await fuentes();
    const previo = await prepararHistoricos(cartera, inventario);
    const { referencia } = creditoPrimero(previo);
    const decisiones: DecisionesHistoricas = {
      ...previo.decisiones,
      reglas: {
        cerosIniciales: { valor: true, evidencia: 'Catálogo sintético' },
        montoArticulo: { valor: 'PRECIO_TOTAL', evidencia: 'Acuerdo de prueba' },
      },
      filas: [
        { referencia, campo: 'saldo_corte', valor: '2026-03-30', evidencia: 'Fecha de corte de prueba' },
        { referencia, campo: 'verificar_condiciones', valor: true, evidencia: 'Contrato sintético' },
        { referencia, campo: 'autorizar_saldo', valor: 800, metodoVerificacion: 'TARJETA_FISICA', evidencia: 'Tarjeta sintética: saldo al corte 800' },
      ],
    };
    const sinResponsable = await prepararHistoricos(cartera, inventario, decisiones);
    expect(creditoPrimero(sinResponsable).valores).toMatchObject({
      consistencia_matematica: 'CONSISTENTE', condiciones_historicas: 'SIN_VERIFICAR', conciliacion: 'NO_AUTORIZADA',
    });
    const revisado = await prepararHistoricos(cartera, inventario, {
      ...decisiones, responsable: 'revisor-fixture', aprobadasEn: '2026-11-27T05:00:00.000Z',
    });
    expect(creditoPrimero(revisado).valores).toMatchObject({
      condiciones_historicas: 'VERIFICADAS', conciliacion: 'TARJETA_FISICA', saldo_autorizado: 800,
    });
  });

  it('no aplica una regla general si la fila rechaza esa propuesta', async () => {
    const { cartera, inventario } = await fuentes();
    const inicial = await prepararHistoricos(cartera, inventario);
    const { referencia } = creditoPrimero(inicial);
    const p = await prepararHistoricos(cartera, inventario, {
      ...inicial.decisiones,
      reglas: { montoArticulo: { valor: 'FINANCIADO', evidencia: 'Ejemplo sintético' } },
      rechazos: [{ referencia, campo: 'interpretacion_monto', evidencia: 'El contrato no confirma cómo se anotó' }],
    });
    expect(creditoPrimero(p)).toMatchObject({ estado: 'REVISAR', valores: { conciliacion: 'NO_AUTORIZADA' } });
    expect(creditoPrimero(p).valores.financiado).toBeNull();
    expect(p.huellaDecisiones).not.toBe(inicial.huellaDecisiones);
  });

  it('aplica decisiones ligadas a las huellas, con excepción individual sobre la regla', async () => {
    const { cartera, inventario } = await fuentes();
    const inicial = await prepararHistoricos(cartera, inventario);
    const a = creditoPrimero(inicial);
    const b = inicial.filas.find((f) => f.tipo === 'CREDITO_ARTICULO' && f.fila === 8)!;
    const decisiones: DecisionesHistoricas = {
      ...inicial.decisiones,
      reglas: {
        cerosIniciales: { valor: true, evidencia: 'Catálogo de prueba' },
        montoArticulo: { valor: 'FINANCIADO', evidencia: 'Regla de prueba' },
      },
      filas: [
        { referencia: a.referencia, campo: 'interpretacion_monto', valor: 'PRECIO_TOTAL', evidencia: 'Contrato sintético' },
        { referencia: b.referencia, campo: 'sin_ajustes', valor: true, evidencia: 'Revisión de saldo sintética' },
      ],
    };
    const aprobado = await prepararHistoricos(cartera, inventario, decisiones);
    expect(creditoPrimero(aprobado).valores).toMatchObject({ financiado: 800, articulo_ref: expect.stringMatching(/^ARTICULO-/) });
    expect(aprobado.filas.find((f) => f.referencia === b.referencia)?.valores.abonado).toBe(400);
    await expect(prepararHistoricos(cartera, inventario, {
      ...decisiones, fuentes: { ...decisiones.fuentes, cartera: 'huella-distinta' },
    })).rejects.toThrow(/huellas/);
  });

  it('ni una regla general resuelve un código con varias opciones ni se fusionan identidades en conflicto', async () => {
    const { cartera, inventario } = await fuentes({ colisionCodigo: true, duplicadoCliente: true });
    const previo = await prepararHistoricos(cartera, inventario);
    const p = await prepararHistoricos(cartera, inventario, {
      ...previo.decisiones,
      reglas: { cerosIniciales: { valor: true, evidencia: 'Catálogo revisado' } },
    });
    expect(creditoPrimero(p).valores.articulo_ref).toBeUndefined();
    expect(creditoPrimero(p).valores.cliente_ref).toBeUndefined();
    expect(p.filas.filter((f) => f.estado === 'CONSOLIDADO')).toHaveLength(0);
    const libro = new Workbook();
    await libro.xlsx.load(bufferDeExcel(await generarConsolidadoHistorico(p)));
    expect(libro.getWorksheet('Clientes')).toBeUndefined();
    expect(libro.getWorksheet('Origen crédito artículo')?.actualRowCount).toBe(3);
    const origen = libro.getWorksheet('Origen artículos')!;
    expect(origen.getRow(2).values).toContain('=NoEjecutar()');
    expect(origen.getRow(2).getCell(6).formula).toBeUndefined();
  });
});
