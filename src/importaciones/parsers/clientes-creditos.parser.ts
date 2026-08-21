import * as ExcelJS from 'exceljs';
import {
  ResultadoValidacion,
  ErrorValidacion,
  AdvertenciaValidacion,
  ResumenHoja,
} from '../dto/validacion-resultado.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { FrecuenciaPago } from '@prisma/client';
import { loadWorkbookFromBuffer } from './xlsx-workbook.loader';
import {
  leerFecha,
  leerNumero,
  leerTexto,
  leerTextoMayus,
  leerTextoNormalizado,
} from './cell-value.util';
import {
  avisarFilasFueraDeRango,
  celda,
  construirMapaColumnas,
  filaVaciaEnColumnas,
  FILA_INICIO_DATOS,
} from './header-map.util';
import {
  claveNombre,
  limpiarCorreo,
  limpiarNombre,
  limpiarTelefono,
  limpiarTexto,
} from '../normalizacion';
import {
  calcularInteresTotal,
  derivarCantidadCuotas,
  derivarPlazoMeses,
  mapTipoAmortizacionExcel,
  plazoMesesPersistido,
  TIPO_AMORTIZACION_POR_DEFECTO,
} from '../interes-credito';

const SHEETS = {
  clientes: ['Clientes'],
  // Formato actual: una hoja por tipo, porque los campos no son los mismos.
  creditosDinero: ['Créditos de dinero', 'Creditos de dinero'],
  creditosArticulo: ['Créditos de artículo', 'Creditos de articulo'],
  // Formato anterior: una sola hoja con ambos tipos mezclados.
  creditos: ['Créditos', 'Creditos'],
};

const SHEET_DISPLAY = {
  clientes: 'Clientes',
  creditos: 'Créditos',
};

function getWorksheetByAliases(
  workbook: ExcelJS.Workbook,
  aliases: string[],
): ExcelJS.Worksheet | undefined {
  return aliases.map((name) => workbook.getWorksheet(name)).find(Boolean);
}

const NIVELES_RIESGO_NORMALIZADOS = [
  'MINIMO',
  'LEVE',
  'PRECAUCION',
  'MODERADO',
  'CRITICO',
];

/**
 * Todo el sistema maneja pesos enteros (`truncCop` en el backend,
 * `Math.trunc` en el frontend). Si llegan centavos se avisa y se truncan, en vez
 * de guardarlos y perderlos en silencio más adelante.
 */
function tieneCentavos(valor: number | null): boolean {
  return valor !== null && Number.isFinite(valor) && !Number.isInteger(valor);
}

const aPesos = (valor: number | null): number | null =>
  valor === null || !Number.isFinite(valor) ? valor : Math.trunc(valor);

export class ClientesCreditosParser {
  constructor(private readonly prisma: PrismaService) {}

  async parseAndValidate(
    buffer: Buffer,
    fileName: string,
  ): Promise<ResultadoValidacion> {
    const workbook = await loadWorkbookFromBuffer(buffer);

    const errores: ErrorValidacion[] = [];
    const advertencias: AdvertenciaValidacion[] = [];
    const clientesValidar: any[] = [];
    const creditosValidar: any[] = [];
    const porHoja: Record<string, ResumenHoja> = {};

    let totalFilas = 0;
    let filasConError = 0;

    const hojaClientes = getWorksheetByAliases(workbook, SHEETS.clientes);
    // Cada hoja nueva fija el tipo de crédito; la hoja antigua lo lee de su columna.
    const hojasCredito: Array<{
      hoja: ExcelJS.Worksheet;
      nombre: string;
      tipoFijo: 'EFECTIVO' | 'ARTICULO' | null;
    }> = [];

    const hojaDinero = getWorksheetByAliases(workbook, SHEETS.creditosDinero);
    if (hojaDinero) {
      hojasCredito.push({
        hoja: hojaDinero,
        nombre: 'Créditos de dinero',
        tipoFijo: 'EFECTIVO',
      });
    }

    const hojaArticulo = getWorksheetByAliases(
      workbook,
      SHEETS.creditosArticulo,
    );
    if (hojaArticulo) {
      hojasCredito.push({
        hoja: hojaArticulo,
        nombre: 'Créditos de artículo',
        tipoFijo: 'ARTICULO',
      });
    }

    const hojaCreditosLegado = getWorksheetByAliases(workbook, SHEETS.creditos);
    if (hojasCredito.length === 0 && hojaCreditosLegado) {
      hojasCredito.push({
        hoja: hojaCreditosLegado,
        nombre: SHEET_DISPLAY.creditos,
        tipoFijo: null,
      });
    }

    const salidaVacia = (mensaje: string): ResultadoValidacion => {
      errores.push({
        hoja: 'GLOBAL',
        fila: 0,
        campo: 'Hojas',
        mensaje,
        valor: '',
      });
      return {
        tipo: 'clientes-creditos',
        archivo: fileName,
        resumen: {
          totalFilas: 0,
          filasValidas: 0,
          filasConError: 1,
          advertencias: 0,
          porHoja: {},
        },
        errores,
        advertencias,
      };
    };

    if (!hojaClientes || hojasCredito.length === 0) {
      return salidaVacia(
        'Faltan hojas requeridas. Se requiere la hoja "Clientes" y al menos una de crédito ("Créditos de dinero" o "Créditos de artículo"). Descargue nuevamente la plantilla oficial.',
      );
    }

    // ── Datos de referencia en base de datos ───────────────────────────────
    const [rutasBd, clientesBd, productosBd, prestamosBd] = await Promise.all([
      this.prisma.ruta.findMany({
        select: { codigo: true },
        where: { activa: true },
      }),
      this.prisma.cliente.findMany({
        select: {
          dni: true,
          codigo: true,
          idempotencyKey: true,
          nombres: true,
          apellidos: true,
        },
        where: { eliminadoEn: null },
      }),
      this.prisma.producto.findMany({
        select: {
          codigo: true,
          nombre: true,
          // Precios por plazo: en los créditos de artículo el monto sale de aquí.
          precios: {
            where: { activo: true },
            select: { meses: true, precio: true },
          },
        },
        where: { eliminadoEn: null },
      }),
      this.prisma.prestamo.findMany({
        select: {
          numeroPrestamo: true,
          idempotencyKey: true,
          // Un crédito con pagos registrados no se puede reescribir por Excel.
          _count: { select: { pagos: true } },
        },
        where: { eliminadoEn: null },
      }),
    ]);

    const rutasEnBd = new Set(rutasBd.map((r) => r.codigo));
    const productosEnBd = new Map(
      productosBd.map((p) => [String(p.codigo).trim().toUpperCase(), p.nombre]),
    );

    // Precio de cada artículo por plazo, para deducir el monto del crédito.
    const preciosPorPlazo = new Map<string, number>();
    productosBd.forEach((p) => {
      const codigo = String(p.codigo).trim().toUpperCase();
      (p.precios ?? []).forEach((precio: any) => {
        preciosPorPlazo.set(
          `${codigo}|${Number(precio.meses)}`,
          Number(precio.precio) || 0,
        );
      });
    });

    // Cédulas ya registradas: importar de nuevo una cédula existente crearía un
    // cliente duplicado (o, peor, quedaría silenciosamente omitido al confirmar).
    const clientesPorCcBd = new Map(
      clientesBd.map((c) => [
        String(c.dni).trim(),
        `${c.nombres} ${c.apellidos}`.trim(),
      ]),
    );
    // Nombres ya registrados: dos personas con el mismo nombre y cédulas
    // distintas suelen ser un error de digitación de la cédula.
    const nombresBd = new Map<string, string[]>();
    clientesBd.forEach((c) => {
      const clave = claveNombre(c.nombres, c.apellidos);
      if (!clave) return;
      const cedulas = nombresBd.get(clave) ?? [];
      cedulas.push(String(c.dni).trim());
      nombresBd.set(clave, cedulas);
    });

    const codigosClienteBd = new Set(
      clientesBd.flatMap((c) =>
        [c.codigo, c.idempotencyKey]
          .filter(Boolean)
          .map((v) => String(v).trim()),
      ),
    );
    const numerosPrestamoBd = new Set(
      prestamosBd.map((p) => String(p.numeroPrestamo).trim()),
    );
    const prestamosConPagos = new Set(
      prestamosBd
        .filter((p) => p._count?.pagos > 0)
        .map((p) => String(p.numeroPrestamo).trim()),
    );
    const codigosCreditoBd = new Set(
      prestamosBd
        .map((p) => p.idempotencyKey)
        .filter(Boolean)
        .map((v) => String(v).trim()),
    );

    // ── Hoja Clientes ──────────────────────────────────────────────────────
    const colsCli = construirMapaColumnas(hojaClientes);
    const cliCodigo = colsCli.indice('Código importación');
    const cliAccion = colsCli.indice('Acción');
    const cliCc = colsCli.indice('CC cliente', 'CC');
    const cliNombres = colsCli.indice('Nombres');
    const cliApellidos = colsCli.indice('Apellidos');
    const cliTelefono = colsCli.indice('Teléfono');
    const cliCorreo = colsCli.indice('Correo');
    const cliDireccion = colsCli.indice('Dirección');
    const cliReferencia = colsCli.indice('Punto de referencia', 'Referencia');
    const cliRef1Nombre = colsCli.indice('Ref1 Nombre');
    const cliRef1Telefono = colsCli.indice('Ref1 Teléfono');
    const cliRef2Nombre = colsCli.indice('Ref2 Nombre');
    const cliRef2Telefono = colsCli.indice('Ref2 Teléfono');
    const cliNivelRiesgo = colsCli.indice('Nivel riesgo');
    const cliRutaCodigo = colsCli.indice('Ruta código');
    const cliObservaciones = colsCli.indice('Observaciones');

    if (!cliCc || !cliNombres || !cliApellidos) {
      return salidaVacia(
        'No se encontraron los encabezados obligatorios (CC cliente, Nombres, Apellidos) en la fila 6 de la hoja "Clientes". Descargue nuevamente la plantilla oficial.',
      );
    }

    const columnasEntradaClientes = [
      cliAccion,
      cliCodigo,
      cliCc,
      cliNombres,
      cliApellidos,
      cliTelefono,
      cliCorreo,
      cliDireccion,
      cliReferencia,
      cliRef1Nombre,
      cliRef1Telefono,
      cliRef2Nombre,
      cliRef2Telefono,
      cliNivelRiesgo,
      cliRutaCodigo,
      cliObservaciones,
    ].filter(Boolean);

    let totalClientes = 0;
    let clientesConError = 0;
    const filasClientes: number[] = [];
    const codigosClientes = new Set<string>();
    const ccsClientes = new Set<string>();

    hojaClientes.eachRow((row, rowNumber) => {
      if (rowNumber < FILA_INICIO_DATOS) return;
      if (filaVaciaEnColumnas(row, columnasEntradaClientes)) return;

      totalFilas++;
      totalClientes++;
      filasClientes.push(rowNumber);
      let tieneError = false;

      // Acción vacía equivale a CREAR.
      const accion = leerTextoMayus(celda(row, cliAccion)) || 'CREAR';
      const esActualizacion = accion === 'ACTUALIZAR';

      let codigoImp = leerTexto(celda(row, cliCodigo));
      const cc = leerTexto(celda(row, cliCc));
      const nivelRiesgo = leerTextoNormalizado(celda(row, cliNivelRiesgo));
      const rutaCodigo = leerTexto(celda(row, cliRutaCodigo));

      // Los textos se limpian antes de guardarse: la cartera se ensucia para
      // siempre con lo que entra en la migración.
      const nombres = limpiarNombre(leerTexto(celda(row, cliNombres)));
      const apellidos = limpiarNombre(leerTexto(celda(row, cliApellidos)));
      const telefono = limpiarTelefono(leerTexto(celda(row, cliTelefono)));
      const correo = limpiarCorreo(leerTexto(celda(row, cliCorreo)));
      const direccion = limpiarTexto(leerTexto(celda(row, cliDireccion)));
      const referencia = limpiarTexto(leerTexto(celda(row, cliReferencia)));
      const referencia1Nombre = limpiarNombre(
        leerTexto(celda(row, cliRef1Nombre)),
      );
      const referencia1Telefono = limpiarTelefono(
        leerTexto(celda(row, cliRef1Telefono)),
      );
      const referencia2Nombre = limpiarNombre(
        leerTexto(celda(row, cliRef2Nombre)),
      );
      const referencia2Telefono = limpiarTelefono(
        leerTexto(celda(row, cliRef2Telefono)),
      );
      const observaciones = limpiarTexto(
        leerTexto(celda(row, cliObservaciones)),
      );

      const addError = (campo: string, mensaje: string, valor: any) => {
        errores.push({
          hoja: SHEET_DISPLAY.clientes,
          fila: rowNumber,
          campo,
          mensaje,
          valor,
        });
        tieneError = true;
      };

      if (accion !== 'CREAR' && accion !== 'ACTUALIZAR') {
        addError(
          'accion',
          'Debe ser CREAR o ACTUALIZAR (o dejarse vacía, que equivale a CREAR)',
          accion,
        );
      }

      // El código de importación deja de ser obligatorio: si no viene, se deriva
      // de la cédula, que ya es única por cliente.
      if (!codigoImp && cc) {
        codigoImp = `CLI-${cc}`;
      }

      if (!codigoImp) {
        addError(
          'codigo_importacion_cliente',
          'No se pudo generar automáticamente porque falta la cédula',
          codigoImp,
        );
      } else if (codigoImp.length > 20) {
        addError(
          'codigo_importacion_cliente',
          'Debe tener máximo 20 caracteres',
          codigoImp,
        );
      } else if (codigosClientes.has(codigoImp)) {
        addError(
          'codigo_importacion_cliente',
          'Duplicado en el archivo',
          codigoImp,
        );
      } else {
        codigosClientes.add(codigoImp);
        if (!esActualizacion && codigosClienteBd.has(codigoImp)) {
          addError(
            'codigo_importacion_cliente',
            'Ya existe un cliente en el sistema con este código de importación. Use un código diferente.',
            codigoImp,
          );
        }
      }

      if (!cc) {
        addError('cc', 'Es requerido', cc);
      } else if (!/^\d{6,10}$/.test(cc)) {
        addError('cc', 'Debe ser solo dígitos, entre 6 y 10 caracteres', cc);
      } else if (ccsClientes.has(cc)) {
        addError('cc', 'Duplicado en el archivo', cc);
      } else {
        ccsClientes.add(cc);

        const yaRegistrada = clientesPorCcBd.has(cc);

        if (esActualizacion && !yaRegistrada) {
          addError(
            'cc',
            'No hay ningún cliente con esta cédula para actualizar. Use CREAR si es un cliente nuevo.',
            cc,
          );
        }

        if (!esActualizacion && yaRegistrada) {
          addError(
            'cc',
            `Esta cédula ya está registrada en el sistema (${clientesPorCcBd.get(cc)}). Escriba ACTUALIZAR en la columna Acción para corregir sus datos, o elimine esta fila y registre solo el crédito en la hoja "Créditos".`,
            cc,
          );
        }
      }

      if (!nombres) addError('nombres', 'Es requerido', nombres);
      if (!apellidos) addError('apellidos', 'Es requerido', apellidos);
      if (!telefono) addError('telefono', 'Es requerido', telefono);

      if (nivelRiesgo && !NIVELES_RIESGO_NORMALIZADOS.includes(nivelRiesgo)) {
        addError(
          'nivel_riesgo',
          'Debe ser Mínimo, Leve, Precaución, Moderado o Crítico',
          celda(row, cliNivelRiesgo),
        );
      }

      if (rutaCodigo && !rutasEnBd.has(rutaCodigo)) {
        addError(
          'ruta_codigo',
          'La ruta no existe en la base de datos',
          rutaCodigo,
        );
      }

      if (tieneError) {
        filasConError++;
        clientesConError++;
      } else {
        clientesValidar.push({
          accion,
          esActualizacion,
          codigoImp,
          cc,
          nombres,
          apellidos,
          telefono,
          correo,
          direccion,
          referencia,
          referencia1Nombre,
          referencia1Telefono,
          referencia2Nombre,
          referencia2Telefono,
          nivelRiesgo,
          rutaCodigo,
          observaciones,
          fila: rowNumber,
        });
      }
    });

    // ── Posibles duplicados por nombre ─────────────────────────────────────
    const nombresDelArchivo = new Map<
      string,
      Array<{ cc: string; fila: number }>
    >();
    clientesValidar.forEach((cli) => {
      const clave = claveNombre(cli.nombres, cli.apellidos);
      if (!clave) return;
      const lista = nombresDelArchivo.get(clave) ?? [];
      lista.push({ cc: cli.cc, fila: cli.fila });
      nombresDelArchivo.set(clave, lista);
    });

    nombresDelArchivo.forEach((filas, clave) => {
      const cedulas = new Set(filas.map((f) => f.cc));

      if (filas.length > 1 && cedulas.size > 1) {
        filas.forEach((f) => {
          advertencias.push({
            hoja: SHEET_DISPLAY.clientes,
            fila: f.fila,
            campo: 'nombres',
            mensaje: `Hay ${filas.length} filas con este mismo nombre y cédulas distintas (${[...cedulas].join(', ')}). Verifique que no sea un error al escribir la cédula.`,
            valor: clave,
          });
        });
        return;
      }

      const enBd = nombresBd.get(clave) ?? [];
      filas.forEach((f) => {
        const otras = enBd.filter((dni) => dni !== f.cc);
        if (otras.length === 0) return;
        advertencias.push({
          hoja: SHEET_DISPLAY.clientes,
          fila: f.fila,
          campo: 'nombres',
          mensaje: `Ya hay un cliente registrado con este mismo nombre y otra cédula (${otras.join(', ')}). Verifique que no sea la misma persona.`,
          valor: clave,
        });
      });
    });

    const avisoClientes = avisarFilasFueraDeRango(
      filasClientes,
      SHEET_DISPLAY.clientes,
    );
    if (avisoClientes) {
      advertencias.push({ hoja: SHEET_DISPLAY.clientes, ...avisoClientes });
    }

    porHoja[SHEET_DISPLAY.clientes] = {
      totalFilas: totalClientes,
      filasValidas: totalClientes - clientesConError,
      filasConError: clientesConError,
    };

    // Los códigos y números deben ser únicos en todo el archivo, no por hoja.
    const codigosCreditos = new Set<string>();
    const numerosPrestamo = new Set<string>();
    /** Consecutivo por cliente, para generar números de crédito únicos. */
    const creditosPorCliente = new Map<string, number>();

    for (const { hoja, nombre, tipoFijo } of hojasCredito) {
      // ── Hoja de créditos (una por tipo) ─────────────────────────────────
      const colsCre = construirMapaColumnas(hoja);
      const creAccion = colsCre.indice('Acción');
      const creCodigo = colsCre.indice('Código importación');
      const creNumeroPrestamo = colsCre.indice(
        'Número de crédito',
        'Número préstamo',
      );
      const creCc = colsCre.indice('CC cliente');
      const creTipoPrestamo = colsCre.indice(
        'Tipo de crédito',
        'Tipo préstamo',
      );
      const creProductoCodigo = colsCre.indice('Producto código');
      const creMonto = colsCre.indice('Monto');
      const creCuotaInicial = colsCre.indice('Cuota inicial');
      const creTasaInteres = colsCre.indice('Tasa interés');
      const creTasaMora = colsCre.indice('Tasa interés mora');
      const creFrecuencia = colsCre.indice('Frecuencia pago');
      const creCantidadCuotas = colsCre.indice('Cantidad cuotas');
      const crePlazoMeses = colsCre.indice('Plazo meses');
      const creTipoAmortizacion = colsCre.indice('Tipo amortización');
      const creFechaCredito = colsCre.indice('Fecha crédito');
      const creFechaPrimerCobro = colsCre.indice('Fecha primer cobro');
      const creTipoCarga = colsCre.indice('Tipo carga');
      const creDescontarCaja = colsCre.indice('Descontar dinero de caja');
      const creGarantia = colsCre.indice('Garantía');
      const creNotas = colsCre.indice('Notas');
      // Estado de avance del crédito (migración de cartera ya en curso).
      const creCuotasPagadas = colsCre.indice('Cuotas pagadas');
      const creAbonoAdicional = colsCre.indice('Abono adicional');
      const creFechaUltimoPago = colsCre.indice('Fecha último pago');

      // Cada hoja tiene sus propios encabezados mínimos: la de dinero necesita
      // el monto, la de artículo el código del producto, y la antigua ambos más
      // la columna de tipo.
      const faltaEncabezado =
        !creCc ||
        (tipoFijo === 'EFECTIVO' && !creMonto) ||
        (tipoFijo === 'ARTICULO' && !creProductoCodigo) ||
        (tipoFijo === null && (!creMonto || !creTipoPrestamo));

      if (faltaEncabezado) {
        return salidaVacia(
          `No se encontraron los encabezados obligatorios en la fila 6 de la hoja "${nombre}". Descargue nuevamente la plantilla oficial.`,
        );
      }

      const columnasEntradaCreditos = [
        creAccion,
        creCodigo,
        creNumeroPrestamo,
        creCc,
        creTipoPrestamo,
        creProductoCodigo,
        creMonto,
        creCuotaInicial,
        creTasaInteres,
        creTasaMora,
        creFrecuencia,
        creCantidadCuotas,
        crePlazoMeses,
        creTipoAmortizacion,
        creFechaCredito,
        creFechaPrimerCobro,
        creTipoCarga,
        creDescontarCaja,
        creGarantia,
        creNotas,
        creCuotasPagadas,
        creAbonoAdicional,
        creFechaUltimoPago,
      ].filter(Boolean);

      let totalCreditos = 0;
      let creditosConError = 0;
      const filasCreditos: number[] = [];

      hoja.eachRow((row, rowNumber) => {
        if (rowNumber < FILA_INICIO_DATOS) return;
        if (filaVaciaEnColumnas(row, columnasEntradaCreditos)) return;

        totalFilas++;
        totalCreditos++;
        filasCreditos.push(rowNumber);
        let tieneError = false;

        const accion = leerTextoMayus(celda(row, creAccion)) || 'CREAR';
        const esActualizacion = accion === 'ACTUALIZAR';
        const ccCliente = leerTexto(celda(row, creCc));
        const tipoPrestamo =
          tipoFijo ?? leerTextoMayus(celda(row, creTipoPrestamo));
        const esArticulo = tipoPrestamo === 'ARTICULO';
        const productoCodigo = leerTextoMayus(celda(row, creProductoCodigo));
        const montoCelda = leerNumero(celda(row, creMonto));
        const cuotaInicialCelda = leerNumero(celda(row, creCuotaInicial));
        const tasaInteres = leerNumero(celda(row, creTasaInteres));
        const tasaInteresMora = leerNumero(celda(row, creTasaMora));
        const frecuenciaPago = leerTextoMayus(celda(row, creFrecuencia));
        const cantidadCuotasCelda = leerNumero(celda(row, creCantidadCuotas));
        const plazoMeses = leerNumero(celda(row, crePlazoMeses));
        const tipoAmortizacionRaw = celda(row, creTipoAmortizacion);
        const fechaCredito = leerFecha(celda(row, creFechaCredito));
        const fechaPrimerCobro = leerFecha(celda(row, creFechaPrimerCobro));
        const tipoCarga = leerTextoMayus(celda(row, creTipoCarga));
        const descontarCajaCelda = leerTextoMayus(celda(row, creDescontarCaja));
        const garantia = leerTexto(celda(row, creGarantia));
        const notas = leerTexto(celda(row, creNotas));
        const cuotasPagadas = leerNumero(celda(row, creCuotasPagadas));
        const abonoAdicionalCelda = leerNumero(celda(row, creAbonoAdicional));
        const fechaUltimoPago = leerFecha(celda(row, creFechaUltimoPago));

        // Valores que el sistema puede deducir para que no haya que escribirlos:

        // Interés simple y Amortización calculan distinto: la primera aplica la
        // tasa por cada mes de plazo y la segunda una sola vez sobre el capital.
        const tipoAmortizacionInformado = Boolean(
          leerTexto(tipoAmortizacionRaw),
        );
        const tipoAmortizacion = tipoAmortizacionInformado
          ? mapTipoAmortizacionExcel(tipoAmortizacionRaw)
          : TIPO_AMORTIZACION_POR_DEFECTO;

        // Un crédito histórico no mueve caja; uno operativo se desembolsa hoy.
        const descontarCaja =
          descontarCajaCelda || (tipoCarga === 'OPERATIVA' ? 'SI' : 'NO');

        // Número de préstamo: si no lo traen, se arma con la cédula y un
        // consecutivo dentro del archivo. Igual se valida contra los ya existentes.
        let numeroPrestamo = leerTexto(celda(row, creNumeroPrestamo));
        if (!numeroPrestamo && ccCliente) {
          const consecutivo = (creditosPorCliente.get(ccCliente) ?? 0) + 1;
          creditosPorCliente.set(ccCliente, consecutivo);
          numeroPrestamo = `IMP-${ccCliente}-${consecutivo}`;
        }

        // El código de importación identifica la fila; el número de préstamo sirve.
        let codigoImp = leerTexto(celda(row, creCodigo));
        if (!codigoImp) codigoImp = numeroPrestamo;

        const montoConCentavos = tieneCentavos(montoCelda);
        const cuotaInicialConCentavos = tieneCentavos(cuotaInicialCelda);
        const abonoConCentavos = tieneCentavos(abonoAdicionalCelda);

        const monto = aPesos(montoCelda);
        const cuotaInicial = aPesos(cuotaInicialCelda);
        const abonoAdicional = aPesos(abonoAdicionalCelda);

        const addError = (campo: string, mensaje: string, valor: any) => {
          errores.push({
            hoja: nombre,
            fila: rowNumber,
            campo,
            mensaje,
            valor,
          });
          tieneError = true;
        };

        const addAdver = (campo: string, mensaje: string, valor: any) => {
          advertencias.push({
            hoja: nombre,
            fila: rowNumber,
            campo,
            mensaje,
            valor,
          });
        };

        if (accion !== 'CREAR' && accion !== 'ACTUALIZAR') {
          addError(
            'accion',
            'Debe ser CREAR o ACTUALIZAR (o dejarse vacía, que equivale a CREAR)',
            accion,
          );
        }

        if (montoConCentavos) {
          addAdver(
            'monto',
            'El sistema maneja pesos enteros: los centavos se descartaron.',
            celda(row, creMonto),
          );
        }
        if (cuotaInicialConCentavos) {
          addAdver(
            'cuota_inicial',
            'El sistema maneja pesos enteros: los centavos se descartaron.',
            celda(row, creCuotaInicial),
          );
        }
        if (abonoConCentavos) {
          addAdver(
            'abono_adicional',
            'El sistema maneja pesos enteros: los centavos se descartaron.',
            celda(row, creAbonoAdicional),
          );
        }

        if (!codigoImp) {
          addError(
            'codigo_importacion_credito',
            'No se pudo generar automáticamente porque falta la cédula del cliente',
            codigoImp,
          );
        } else if (codigoImp.length > 100) {
          addError(
            'codigo_importacion_credito',
            'Debe tener máximo 100 caracteres',
            codigoImp,
          );
        } else if (codigosCreditos.has(codigoImp)) {
          addError(
            'codigo_importacion_credito',
            'Duplicado en el archivo',
            codigoImp,
          );
        } else {
          codigosCreditos.add(codigoImp);
          if (!esActualizacion && codigosCreditoBd.has(codigoImp)) {
            addError(
              'codigo_importacion_credito',
              'Ya existe un crédito en el sistema con este código de importación. Use un código diferente.',
              codigoImp,
            );
          }
        }

        if (!numeroPrestamo) {
          addError(
            'numero_prestamo',
            'No se pudo generar automáticamente porque falta la cédula del cliente',
            numeroPrestamo,
          );
        } else if (numeroPrestamo.length > 50) {
          addError(
            'numero_prestamo',
            'Debe tener máximo 50 caracteres',
            numeroPrestamo,
          );
        } else if (numerosPrestamo.has(numeroPrestamo)) {
          addError(
            'numero_prestamo',
            'Duplicado en el archivo',
            numeroPrestamo,
          );
        } else {
          numerosPrestamo.add(numeroPrestamo);

          const yaExiste = numerosPrestamoBd.has(numeroPrestamo);

          if (esActualizacion && !yaExiste) {
            addError(
              'numero_prestamo',
              'No hay ningún crédito con este número para actualizar. Use CREAR si es un crédito nuevo.',
              numeroPrestamo,
            );
          }

          // Reescribir las cuotas de un crédito que ya recibió pagos rompería
          // los pagos registrados: eso se corrige desde la ficha del crédito.
          if (esActualizacion && prestamosConPagos.has(numeroPrestamo)) {
            addError(
              'numero_prestamo',
              'Este crédito ya tiene pagos registrados en el sistema. Corríjalo desde la ficha del crédito, no por importación.',
              numeroPrestamo,
            );
          }

          if (!esActualizacion && yaExiste) {
            addError(
              'numero_prestamo',
              'Ya existe un préstamo en el sistema con este número. Escriba ACTUALIZAR en la columna Acción para corregirlo, o use un número diferente.',
              numeroPrestamo,
            );
          }
        }

        if (!ccCliente) {
          addError('cc_cliente', 'Es requerido', ccCliente);
        } else if (!/^\d{6,10}$/.test(ccCliente)) {
          addError(
            'cc_cliente',
            'Debe ser solo dígitos, entre 6 y 10 caracteres',
            ccCliente,
          );
        } else if (
          !ccsClientes.has(ccCliente) &&
          !clientesPorCcBd.has(ccCliente)
        ) {
          addError(
            'cc_cliente',
            'El cliente no existe en la hoja Clientes ni en la base de datos',
            ccCliente,
          );
        }

        if (tipoPrestamo !== 'EFECTIVO' && tipoPrestamo !== 'ARTICULO') {
          addError(
            'tipo_credito',
            'Debe ser EFECTIVO o ARTICULO',
            tipoPrestamo,
          );
        }

        if (tipoPrestamo === 'ARTICULO') {
          if (!productoCodigo) {
            addError(
              'producto_codigo',
              'Es requerido para créditos de ARTICULO',
              productoCodigo,
            );
          } else if (!productosEnBd.has(productoCodigo)) {
            addError(
              'producto_codigo',
              'El producto no existe en la base de datos (importe primero el inventario)',
              productoCodigo,
            );
          }
        }

        let montoEfectivo = monto;

        if (esArticulo && montoEfectivo === null && productoCodigo) {
          // Igual que createLoan: lo que se financia es el precio del plazo
          // menos la cuota inicial, no el precio completo.
          const precioPlazo = preciosPorPlazo.get(
            `${productoCodigo}|${plazoMeses ?? ''}`,
          );

          if (precioPlazo && precioPlazo > 0) {
            const inicial = Math.max(0, cuotaInicial ?? 0);
            montoEfectivo = Math.max(0, precioPlazo - inicial);
            addAdver(
              'monto',
              inicial > 0
                ? `Se financia el precio del plazo (${precioPlazo}) menos la cuota inicial (${inicial}): ${montoEfectivo}.`
                : `Se tomó el precio del plazo del artículo: ${precioPlazo}.`,
              montoEfectivo,
            );
          } else if (productosEnBd.has(productoCodigo)) {
            addError(
              'monto',
              'El artículo no tiene precio para ese plazo. Escriba el monto a mano o agregue el precio en el inventario.',
              celda(row, creMonto),
            );
          }
        }

        if (
          montoEfectivo === null ||
          Number.isNaN(montoEfectivo) ||
          montoEfectivo <= 0
        ) {
          addError(
            'monto',
            'Debe ser un número mayor a 0',
            celda(row, creMonto),
          );
        }
        if (
          cuotaInicial !== null &&
          (Number.isNaN(cuotaInicial) || cuotaInicial < 0)
        ) {
          addError(
            'cuota_inicial',
            'Debe ser un número mayor o igual a 0',
            celda(row, creCuotaInicial),
          );
        }
        if (esArticulo) {
          // El financiamiento ya está incluido en el precio del plazo del artículo,
          // así que no se cobra una tasa aparte.
          if (
            tasaInteres !== null &&
            !Number.isNaN(tasaInteres) &&
            tasaInteres > 0
          ) {
            addAdver(
              'tasa_interes',
              'Los créditos de artículo no llevan tasa: el interés ya está dentro del precio del plazo. Se ignorará.',
              tasaInteres,
            );
          }
        } else if (
          tasaInteres === null ||
          Number.isNaN(tasaInteres) ||
          tasaInteres < 0
        ) {
          addError(
            'tasa_interes',
            'Debe ser un número mayor o igual a 0',
            celda(row, creTasaInteres),
          );
        }
        if (
          tasaInteresMora !== null &&
          (Number.isNaN(tasaInteresMora) || tasaInteresMora < 0)
        ) {
          addError(
            'tasa_interes_mora',
            'Debe ser un número mayor o igual a 0',
            celda(row, creTasaMora),
          );
        }

        if (!Object.values(FrecuenciaPago).includes(frecuenciaPago as any)) {
          addError('frecuencia_pago', 'Valor no permitido', frecuenciaPago);
        }

        // El modal pide cantidad de cuotas y frecuencia, y de ahí deriva el plazo
        // en meses (que puede quedar fraccionario: 45 cuotas diarias = 1,5 meses).
        // La importación hace lo mismo, y acepta el camino inverso para créditos
        // antiguos que solo están documentados en meses.
        let cantidadCuotas = cantidadCuotasCelda;
        if (
          (cantidadCuotas === null || esArticulo) &&
          plazoMeses !== null &&
          !Number.isNaN(plazoMeses)
        ) {
          const derivada = derivarCantidadCuotas(plazoMeses, frecuenciaPago);
          if (derivada > 0 && derivada !== cantidadCuotas) {
            cantidadCuotas = derivada;
            addAdver(
              'cantidad_cuotas',
              `Se calculó automáticamente en ${derivada} cuota(s) a partir del plazo y la frecuencia.`,
              derivada,
            );
          }
        }

        let plazoMesesEfectivo = plazoMeses;
        if (
          (plazoMesesEfectivo === null || Number.isNaN(plazoMesesEfectivo)) &&
          cantidadCuotas !== null &&
          !Number.isNaN(cantidadCuotas)
        ) {
          const derivado = derivarPlazoMeses(cantidadCuotas, frecuenciaPago);
          if (derivado > 0) {
            plazoMesesEfectivo = derivado;
            // Solo se avisa si la hoja tenía la columna y quedó vacía. Cuando la
            // hoja ni siquiera la trae, derivarlo es el comportamiento normal.
            if (crePlazoMeses) {
              addAdver(
                'plazo_meses',
                `Se calculó automáticamente en ${derivado} mes(es) a partir de las cuotas y la frecuencia, igual que el formulario de créditos.`,
                derivado,
              );
            }
          }
        }

        if (
          plazoMesesEfectivo === null ||
          Number.isNaN(plazoMesesEfectivo) ||
          plazoMesesEfectivo <= 0
        ) {
          addError(
            'plazo_meses',
            esArticulo
              ? 'Es requerido en créditos de artículo: es el plazo del plan que se le vendió al cliente'
              : 'No se pudo calcular: indique la cantidad de cuotas y la frecuencia, o escriba el plazo en meses',
            celda(row, crePlazoMeses),
          );
        }

        if (
          cantidadCuotas === null ||
          Number.isNaN(cantidadCuotas) ||
          cantidadCuotas <= 0
        ) {
          addError(
            'cantidad_cuotas',
            'Debe ser un número mayor a 0',
            celda(row, creCantidadCuotas),
          );
        } else if (!Number.isInteger(cantidadCuotas)) {
          addError(
            'cantidad_cuotas',
            'Debe ser un número entero',
            cantidadCuotas,
          );
        }

        if (!tipoAmortizacion) {
          addError(
            'tipo_amortizacion',
            'Debe ser "Interés simple" o "Amortización" (o dejarse vacío)',
            tipoAmortizacionRaw,
          );
        } else if (!tipoAmortizacionInformado) {
          addAdver(
            'tipo_amortizacion',
            'No se indicó el método, se asumió Interés simple (la tasa se aplica por cada mes de plazo).',
            '',
          );
        }

        if (!fechaCredito) {
          addError(
            'fecha_credito',
            'Requerido y formato válido YYYY-MM-DD',
            celda(row, creFechaCredito),
          );
        }

        if (
          fechaPrimerCobro &&
          fechaCredito &&
          fechaPrimerCobro < fechaCredito
        ) {
          addError(
            'fecha_primer_cobro',
            'No puede ser anterior a la fecha de crédito',
            celda(row, creFechaPrimerCobro),
          );
        }

        if (tipoCarga !== 'HISTORICA' && tipoCarga !== 'OPERATIVA') {
          addError('tipo_carga', 'Debe ser HISTORICA u OPERATIVA', tipoCarga);
        }
        if (descontarCaja !== 'SI' && descontarCaja !== 'NO') {
          addError(
            'descontar_dinero_de_caja',
            'Debe ser SI o NO',
            descontarCaja,
          );
        }

        // ── Estado de avance: créditos que ya vienen abonados ────────────────
        const cuotasPagadasNum =
          cuotasPagadas === null || Number.isNaN(cuotasPagadas)
            ? 0
            : cuotasPagadas;
        const abonoAdicionalNum =
          abonoAdicional === null || Number.isNaN(abonoAdicional)
            ? 0
            : abonoAdicional;

        if (cuotasPagadas !== null && Number.isNaN(cuotasPagadas)) {
          addError(
            'cuotas_pagadas',
            'Debe ser un número entero mayor o igual a 0',
            celda(row, creCuotasPagadas),
          );
        } else if (
          cuotasPagadasNum < 0 ||
          !Number.isInteger(cuotasPagadasNum)
        ) {
          addError(
            'cuotas_pagadas',
            'Debe ser un número entero mayor o igual a 0',
            celda(row, creCuotasPagadas),
          );
        } else if (
          cantidadCuotas !== null &&
          !Number.isNaN(cantidadCuotas) &&
          cuotasPagadasNum > cantidadCuotas
        ) {
          addError(
            'cuotas_pagadas',
            `No puede superar la cantidad de cuotas del crédito (${cantidadCuotas})`,
            cuotasPagadasNum,
          );
        }

        if (
          abonoAdicional !== null &&
          (Number.isNaN(abonoAdicional) || abonoAdicionalNum < 0)
        ) {
          addError(
            'abono_adicional',
            'Debe ser un número mayor o igual a 0',
            celda(row, creAbonoAdicional),
          );
        }

        const tieneAvance = cuotasPagadasNum > 0 || abonoAdicionalNum > 0;

        if (tieneAvance && tipoCarga === 'OPERATIVA') {
          addError(
            'cuotas_pagadas',
            'Un crédito OPERATIVA se registra como nuevo: no puede traer cuotas pagadas ni abonos previos. Use tipo de carga HISTORICA.',
            cuotasPagadasNum,
          );
        }

        if (
          abonoAdicionalNum > 0 &&
          cantidadCuotas !== null &&
          cuotasPagadasNum >= cantidadCuotas
        ) {
          addError(
            'abono_adicional',
            'El crédito ya quedaría totalmente pagado con las cuotas indicadas: no puede haber abono adicional.',
            abonoAdicionalNum,
          );
        }

        if (fechaUltimoPago && fechaCredito && fechaUltimoPago < fechaCredito) {
          addError(
            'fecha_ultimo_pago',
            'No puede ser anterior a la fecha de crédito',
            celda(row, creFechaUltimoPago),
          );
        }
        if (fechaUltimoPago && !tieneAvance) {
          addAdver(
            'fecha_ultimo_pago',
            'Se informó una fecha de último pago pero el crédito no tiene cuotas pagadas ni abonos: el dato se ignorará.',
            celda(row, creFechaUltimoPago),
          );
        }

        if (tipoCarga === 'HISTORICA' && descontarCaja === 'SI') {
          addAdver(
            'descontar_dinero_de_caja',
            'Se recomienda NO descontar caja en importaciones históricas',
            descontarCaja,
          );
        }
        if (
          tipoCarga === 'OPERATIVA' &&
          descontarCaja === 'SI' &&
          tipoPrestamo === 'EFECTIVO'
        ) {
          addAdver(
            'descontar_dinero_de_caja',
            'En confirmación, este crédito moverá caja',
            descontarCaja,
          );
        }
        if (tipoCarga === 'OPERATIVA' && tipoPrestamo === 'ARTICULO') {
          addAdver(
            'tipo_carga',
            'Al confirmar se descontará una unidad del inventario y se registrará la venta del artículo.',
            tipoCarga,
          );
        }

        if (tieneError) {
          filasConError++;
          creditosConError++;
          return;
        }

        const interesTotal = calcularInteresTotal(
          tipoAmortizacion as any,
          montoEfectivo as number,
          tasaInteres as number,
          plazoMesesEfectivo as number,
        );
        const totalCredito =
          Math.round(((montoEfectivo as number) + interesTotal) * 100) / 100;
        const valorCuota =
          Math.round((totalCredito / (cantidadCuotas as number)) * 100) / 100;
        const totalAbonado =
          Math.round(
            (valorCuota * cuotasPagadasNum + abonoAdicionalNum) * 100,
          ) / 100;

        if (totalAbonado > totalCredito) {
          errores.push({
            hoja: nombre,
            fila: rowNumber,
            campo: 'abono_adicional',
            mensaje: `Lo abonado (${totalAbonado}) supera el total del crédito (${totalCredito}). Revise las cuotas pagadas y el abono adicional.`,
            valor: abonoAdicionalNum,
          });
          filasConError++;
          creditosConError++;
          return;
        }

        creditosValidar.push({
          accion,
          esActualizacion,
          codigoImp,
          numeroPrestamo,
          ccCliente,
          tipoPrestamo,
          productoCodigo,
          monto: montoEfectivo,
          cuotaInicial: cuotaInicial ?? undefined,
          tasaInteres,
          tasaInteresMora: tasaInteresMora ?? undefined,
          frecuenciaPago,
          cantidadCuotas,
          // Fraccionario para el cálculo de interés; entero al guardar en la base.
          plazoMeses: plazoMesesEfectivo,
          plazoMesesPersistir: plazoMesesPersistido(
            plazoMesesEfectivo as number,
          ),
          tipoAmortizacion,
          fechaCredito,
          fechaPrimerCobro,
          tipoCarga,
          descontarCaja,
          garantia,
          notas,
          cuotasPagadas: cuotasPagadasNum,
          abonoAdicional: abonoAdicionalNum,
          fechaUltimoPago,
          interesTotal,
          totalCredito,
          totalAbonado,
          saldoPendiente: Math.round((totalCredito - totalAbonado) * 100) / 100,
          fila: rowNumber,
        });
      });

      const avisoCreditos = avisarFilasFueraDeRango(filasCreditos, nombre);
      if (avisoCreditos) {
        advertencias.push({ hoja: nombre, ...avisoCreditos });
      }

      porHoja[nombre] = {
        totalFilas: totalCreditos,
        filasValidas: totalCreditos - creditosConError,
        filasConError: creditosConError,
      };
    }

    return {
      tipo: 'clientes-creditos',
      archivo: fileName,
      resumen: {
        totalFilas,
        filasValidas: totalFilas - filasConError,
        filasConError,
        advertencias: advertencias.length,
        porHoja,
      },
      clientes: clientesValidar,
      creditos: creditosValidar,
      errores,
      advertencias,
    };
  }
}
