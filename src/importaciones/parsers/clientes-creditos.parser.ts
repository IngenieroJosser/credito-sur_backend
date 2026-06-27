import * as ExcelJS from 'exceljs';
import {
  ResultadoValidacion,
  ErrorValidacion,
  AdvertenciaValidacion,
  ResumenHoja,
} from '../dto/validacion-resultado.dto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  NivelRiesgo,
  FrecuenciaPago,
  TipoAmortizacion,
} from '@prisma/client';
import { loadWorkbookFromBuffer } from './xlsx-workbook.loader';

const DATA_START_ROW = 7;

const SHEETS = {
  clientes: ['Clientes'],
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
  return aliases
    .map((name) => workbook.getWorksheet(name))
    .find(Boolean);
}

function mapTipoAmortizacionExcel(value: any): 'INTERES_PLANO' | null {
  const texto = String(value ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (
    texto === 'INTERES SIMPLE' ||
    texto === 'INTERES PLANO' ||
    texto === 'AMORTIZACION' ||
    texto === 'AMORTIZACION FIJA'
  ) {
    return 'INTERES_PLANO';
  }

  return null;
}

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

    // Verificar hojas requeridas
    const hojaClientes = getWorksheetByAliases(workbook, SHEETS.clientes);
    const hojaCreditos = getWorksheetByAliases(workbook, SHEETS.creditos);

    if (!hojaClientes || !hojaCreditos) {
      errores.push({
        hoja: 'GLOBAL',
        fila: 0,
        campo: 'Hojas',
        mensaje: 'Faltan hojas requeridas. Se requiere la hoja "Clientes" y la hoja "Créditos". Descargue nuevamente la plantilla oficial.',
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
    }

    const normalizeUpper = (value: any) => String(value ?? '').trim().toUpperCase();
    const normalizeText = (value: any) => String(value ?? '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const NIVELES_RIESGO_NORMALIZADOS = [
      'MINIMO',
      'LEVE',
      'PRECAUCION',
      'MODERADO',
      'CRITICO',
    ];

    // --- Validar CLIENTES ---
    let totalClientes = 0;
    let clientesConError = 0;
    const codigosClientes = new Set<string>();
    const ccsClientes = new Set<string>();
    const rutasEnBd = new Set(
      (
        await this.prisma.ruta.findMany({
          select: { codigo: true },
          where: { activa: true },
        })
      ).map((r) => r.codigo),
    );
    const clientesPorCc = new Map<string, any>(); // Para validar referencias cruzadas en créditos

    hojaClientes.eachRow((row, rowNumber) => {
      if (rowNumber < DATA_START_ROW) return; // Cabeceras y explicaciones

      const values = Array.isArray(row.values) ? row.values.slice(1) : Object.values(row.values || {}).slice(1);
      const filaVacia = values.every((v) => v === undefined || v === null || String(v).trim() === '');
      if (filaVacia) return; // Ignorar filas vacías

      totalFilas++;
      totalClientes++;
      let tieneError = false;

      const accion = normalizeUpper(row.getCell(1).value);
      const codigoImp = String(row.getCell(2).value || '').trim();
      const ccRaw = row.getCell(3).value;
      const cc = ccRaw !== undefined && ccRaw !== null ? String(ccRaw).trim() : '';
      const nombres = String(row.getCell(4).value || '').trim();
      const apellidos = String(row.getCell(5).value || '').trim();
      const telefonoRaw = row.getCell(6).value;
      const telefono = telefonoRaw !== undefined && telefonoRaw !== null ? String(telefonoRaw).trim() : '';
      const nivelRiesgo = normalizeText(row.getCell(14).value);
      const rutaCodigo = String(row.getCell(15).value || '').trim();

      const correo = String(row.getCell(7).value || '').trim();
      const direccion = String(row.getCell(8).value || '').trim();
      const referencia = String(row.getCell(9).value || '').trim();
      const referencia1Nombre = String(row.getCell(10).value || '').trim();
      
      const ref1TelRaw = row.getCell(11).value;
      const referencia1Telefono = ref1TelRaw !== undefined && ref1TelRaw !== null ? String(ref1TelRaw).trim() : '';
      
      const referencia2Nombre = String(row.getCell(12).value || '').trim();
      
      const ref2TelRaw = row.getCell(13).value;
      const referencia2Telefono = ref2TelRaw !== undefined && ref2TelRaw !== null ? String(ref2TelRaw).trim() : '';
      
      const observaciones = String(row.getCell(16).value || '').trim();

      const addError = (campo: string, mensaje: string, valor: any) => {
        errores.push({ hoja: SHEET_DISPLAY.clientes, fila: rowNumber, campo, mensaje, valor });
        tieneError = true;
      };

      if (accion !== 'CREAR') addError('accion', 'Solo se permite CREAR', accion);
      if (!codigoImp) addError('codigo_importacion_cliente', 'Es requerido', codigoImp);
      else if (codigoImp.length > 20) addError('codigo_importacion_cliente', 'Debe tener máximo 20 caracteres', codigoImp);
      else if (codigosClientes.has(codigoImp)) addError('codigo_importacion_cliente', 'Duplicado en el archivo', codigoImp);
      else codigosClientes.add(codigoImp);

      if (!cc) addError('cc', 'Es requerido', cc);
      else if (!/^\d{6,10}$/.test(cc)) addError('cc', 'Debe ser solo dígitos, entre 6 y 10 caracteres', cc);
      else if (ccsClientes.has(cc)) addError('cc', 'Duplicado en el archivo', cc);
      else ccsClientes.add(cc);

      if (!nombres) addError('nombres', 'Es requerido', nombres);
      if (!apellidos) addError('apellidos', 'Es requerido', apellidos);
      if (!telefono) addError('telefono', 'Es requerido', telefono);

      if (nivelRiesgo && !NIVELES_RIESGO_NORMALIZADOS.includes(nivelRiesgo)) {
        addError('nivel_riesgo', 'Debe ser Mínimo, Leve, Precaución, Moderado o Crítico', row.getCell(14).value);
      }

      if (rutaCodigo && !rutasEnBd.has(rutaCodigo)) {
        addError('ruta_codigo', 'La ruta no existe en la base de datos', rutaCodigo);
      }

      const clienteData = {
        accion, codigoImp, cc, nombres, apellidos, telefono, correo, direccion, 
        referencia, referencia1Nombre, referencia1Telefono, referencia2Nombre, 
        referencia2Telefono, nivelRiesgo, rutaCodigo, observaciones,
        fila: rowNumber,
      };
      
      if (cc) clientesPorCc.set(cc, clienteData);

      if (tieneError) {
        filasConError++;
        clientesConError++;
      } else {
        clientesValidar.push(clienteData);
      }
    });

    porHoja[SHEET_DISPLAY.clientes] = {
      totalFilas: totalClientes,
      filasValidas: totalClientes - clientesConError,
      filasConError: clientesConError,
    };

    // Consultar CCs en BD para validación de créditos si no están en la hoja de clientes
    const ccClientesBD = new Set(
      (
        await this.prisma.cliente.findMany({
          select: { dni: true },
          where: { eliminadoEn: null },
        })
      ).map((c) => c.dni),
    );

    const productosEnBd = new Set(
      (
        await this.prisma.producto.findMany({
          select: { codigo: true },
          where: { eliminadoEn: null },
        })
      ).map((p) => p.codigo),
    );

    // --- Validar CREDITOS ---
    let totalCreditos = 0;
    let creditosConError = 0;
    const codigosCreditos = new Set<string>();
    const numerosPrestamo = new Set<string>();

    hojaCreditos.eachRow((row, rowNumber) => {
      if (rowNumber < DATA_START_ROW) return; // Cabeceras y explicaciones

      const values = Array.isArray(row.values) ? row.values.slice(1) : Object.values(row.values || {}).slice(1);
      const filaVacia = values.every((v) => v === undefined || v === null || String(v).trim() === '');
      if (filaVacia) return; // Ignorar filas vacías

      totalFilas++;
      totalCreditos++;
      let tieneError = false;

      const accion = normalizeUpper(row.getCell(1).value);
      const codigoImp = String(row.getCell(2).value || '').trim();
      const numeroPrestamo = String(row.getCell(3).value || '').trim();
      const ccClienteRaw = row.getCell(4).value;
      const ccCliente = ccClienteRaw !== undefined && ccClienteRaw !== null ? String(ccClienteRaw).trim() : '';
      const tipoPrestamo = normalizeUpper(row.getCell(5).value);
      const productoCodigo = String(row.getCell(6).value || '').trim();
      const monto = Number(row.getCell(7).value);
      const cuotaInicialRaw = row.getCell(8).value;
      const cuotaInicial = cuotaInicialRaw !== undefined && cuotaInicialRaw !== null ? Number(cuotaInicialRaw) : undefined;
      const tasaInteres = Number(row.getCell(9).value);
      const tasaInteresMoraRaw = row.getCell(10).value;
      const tasaInteresMora = tasaInteresMoraRaw !== undefined && tasaInteresMoraRaw !== null ? Number(tasaInteresMoraRaw) : undefined;
      const frecuenciaPago = normalizeUpper(row.getCell(11).value);
      const cantidadCuotas = Number(row.getCell(12).value);
      const plazoMeses = Number(row.getCell(13).value);
      const tipoAmortizacionRaw = row.getCell(14).value;
      const tipoAmortizacion = mapTipoAmortizacionExcel(tipoAmortizacionRaw);
      const fechaCreditoRaw = row.getCell(15).value;
      const fechaPrimerCobroRaw = row.getCell(16).value;
      const tipoCarga = normalizeUpper(row.getCell(17).value);
      const descontarCaja = normalizeUpper(row.getCell(18).value);
      const garantia = String(row.getCell(19).value || '').trim();
      const notas = String(row.getCell(20).value || '').trim();

      const parseDate = (val: any): Date | null => {
        if (!val) return null;
        if (val instanceof Date) return val;
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
      };

      const fechaCredito = parseDate(fechaCreditoRaw);
      const fechaPrimerCobro = parseDate(fechaPrimerCobroRaw);

      const addError = (campo: string, mensaje: string, valor: any) => {
        errores.push({ hoja: SHEET_DISPLAY.creditos, fila: rowNumber, campo, mensaje, valor });
        tieneError = true;
      };
      
      const addAdver = (campo: string, mensaje: string, valor: any) => {
        advertencias.push({ hoja: SHEET_DISPLAY.creditos, fila: rowNumber, campo, mensaje, valor });
      };

      if (accion !== 'CREAR') addError('accion', 'Solo se permite CREAR', accion);
      if (!codigoImp) addError('codigo_importacion_credito', 'Es requerido', codigoImp);
      else if (codigoImp.length > 100) addError('codigo_importacion_credito', 'Debe tener máximo 100 caracteres', codigoImp);
      else if (codigosCreditos.has(codigoImp)) addError('codigo_importacion_credito', 'Duplicado en el archivo', codigoImp);
      else codigosCreditos.add(codigoImp);

      if (!numeroPrestamo) addError('numero_prestamo', 'Es requerido', numeroPrestamo);
      else if (numeroPrestamo.length > 50) addError('numero_prestamo', 'Debe tener máximo 50 caracteres', numeroPrestamo);
      else if (numerosPrestamo.has(numeroPrestamo)) addError('numero_prestamo', 'Duplicado en el archivo', numeroPrestamo);
      else numerosPrestamo.add(numeroPrestamo);

      if (!ccCliente) {
         addError('cc_cliente', 'Es requerido', ccCliente);
      } else if (!/^\d{6,10}$/.test(ccCliente)) {
         addError('cc_cliente', 'Debe ser solo dígitos, entre 6 y 10 caracteres', ccCliente);
      } else if (!ccsClientes.has(ccCliente) && !ccClientesBD.has(ccCliente)) {
         addError('cc_cliente', 'El cliente no existe en la hoja CLIENTES ni en la BD', ccCliente);
      }

      if (tipoPrestamo !== 'EFECTIVO' && tipoPrestamo !== 'ARTICULO') {
        addError('tipo_prestamo', 'Debe ser EFECTIVO o ARTICULO', tipoPrestamo);
      }
      
      if (tipoPrestamo === 'ARTICULO') {
        if (!productoCodigo) addError('producto_codigo', 'Es requerido para créditos de ARTICULO', productoCodigo);
        else if (!productosEnBd.has(productoCodigo)) addError('producto_codigo', 'El producto no existe en la BD (valide primero inventario)', productoCodigo);
      }

      if (isNaN(monto) || monto <= 0) addError('monto', 'Debe ser mayor a 0', monto);
      if (cuotaInicial !== undefined && (isNaN(cuotaInicial) || cuotaInicial < 0)) addError('cuota_inicial', 'Debe ser mayor o igual a 0', cuotaInicial);
      if (isNaN(tasaInteres) || tasaInteres < 0) addError('tasa_interes', 'Debe ser mayor o igual a 0', tasaInteres);
      if (tasaInteresMora !== undefined && (isNaN(tasaInteresMora) || tasaInteresMora < 0)) addError('tasa_interes_mora', 'Debe ser mayor o igual a 0', tasaInteresMora);
      
      if (!Object.values(FrecuenciaPago).includes(frecuenciaPago as any)) addError('frecuencia_pago', 'Valor no permitido', frecuenciaPago);
      if (isNaN(cantidadCuotas) || cantidadCuotas <= 0) addError('cantidad_cuotas', 'Debe ser mayor a 0', cantidadCuotas);
      if (isNaN(plazoMeses) || plazoMeses <= 0) addError('plazo_meses', 'Debe ser mayor a 0', plazoMeses);
      
      if (!tipoAmortizacion) {
        addError(
          'tipo_amortizacion',
          'Debe ser Interés simple o Amortización fija',
          tipoAmortizacionRaw,
        );
      }

      if (!fechaCredito) addError('fecha_credito', 'Requerido y formato válido YYYY-MM-DD', fechaCreditoRaw);
      
      if (fechaPrimerCobro && fechaCredito && fechaPrimerCobro < fechaCredito) {
        addError('fecha_primer_cobro', 'No puede ser anterior a la fecha de crédito', fechaPrimerCobroRaw);
      }

      if (tipoCarga !== 'HISTORICA' && tipoCarga !== 'OPERATIVA') addError('tipo_carga', 'Debe ser HISTORICA u OPERATIVA', tipoCarga);
      if (descontarCaja !== 'SI' && descontarCaja !== 'NO') addError('descontar_dinero_de_caja', 'Debe ser SI o NO', descontarCaja);

      if (tipoCarga === 'HISTORICA' && descontarCaja === 'SI') {
        addAdver('descontar_dinero_de_caja', 'Se recomienda NO descontar caja en importaciones históricas', descontarCaja);
      }
      if (tipoCarga === 'OPERATIVA' && descontarCaja === 'SI' && tipoPrestamo === 'EFECTIVO') {
        addAdver('descontar_dinero_de_caja', 'En confirmación, este crédito moverá caja', descontarCaja);
      }
      if (tipoCarga === 'OPERATIVA' && descontarCaja === 'SI' && tipoPrestamo === 'ARTICULO') {
        addAdver('descontar_dinero_de_caja', 'La importación operativa de créditos por artículo no está soportada en esta fase.', descontarCaja);
      }

      if (tieneError) {
        filasConError++;
        creditosConError++;
      } else {
        creditosValidar.push({
          accion, codigoImp, numeroPrestamo, ccCliente, tipoPrestamo, productoCodigo, monto,
          cuotaInicial, tasaInteres, tasaInteresMora, frecuenciaPago, cantidadCuotas, 
          plazoMeses, tipoAmortizacion, fechaCredito, fechaPrimerCobro,
          tipoCarga, descontarCaja, garantia, notas, fila: rowNumber
        });
      }
    });

    porHoja[SHEET_DISPLAY.creditos] = {
      totalFilas: totalCreditos,
      filasValidas: totalCreditos - creditosConError,
      filasConError: creditosConError,
    };

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
