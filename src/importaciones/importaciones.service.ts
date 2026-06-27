import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as ExcelJS from 'exceljs';
import { ClientesCreditosParser } from './parsers/clientes-creditos.parser';
import { InventarioParser } from './parsers/inventario.parser';
import { ResultadoValidacion } from './dto/validacion-resultado.dto';
import { LedgerService } from '../accounting/ledger.service';

@Injectable()
export class ImportacionesService {
  private clientesCreditosParser: ClientesCreditosParser;
  private inventarioParser: InventarioParser;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
  ) {
    this.clientesCreditosParser = new ClientesCreditosParser(this.prisma);
    this.inventarioParser = new InventarioParser(this.prisma);
  }

  private getAccountCodeCaja(caja: any) {
    if (caja?.codigo === 'CAJA-BANCO') return '1.1.2';
    if (String(caja?.tipo || '').toUpperCase() === 'RUTA') return '1.2.1';
    return '1.1.1';
  }

  // Helper para crear cabeceras bonitas
  private formatHeader(ws: ExcelJS.Worksheet, title: string, subtitle: string, instruction: string) {
    // Fila 1: Título Grande
    ws.mergeCells('A1:E1');
    const titleCell = ws.getCell('A1');
    titleCell.value = title;
    titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF004F7B' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getRow(1).height = 30;

    // Fila 2: Subtítulo/Explicación
    ws.mergeCells('A2:E2');
    const subtitleCell = ws.getCell('A2');
    subtitleCell.value = subtitle;
    subtitleCell.font = { italic: true, color: { argb: 'FF555555' } };
    
    // Fila 4: Instrucción Operativa
    ws.mergeCells('A4:E4');
    const instructionCell = ws.getCell('A4');
    instructionCell.value = instruction;
    instructionCell.font = { bold: true, color: { argb: 'FF004F7B' } };
    
    // Fila 6 es headers, estilarla
    ws.getRow(6).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };
  }

  // --- Plantillas ---

  async generarPlantillaClientesCreditos(): Promise<{ data: Buffer; contentType: string; filename: string }> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Créditos del Sur';

    // Hoja: Inicio (antes INSTRUCCIONES)
    const wsInicio = workbook.addWorksheet('Inicio');
    wsInicio.getCell('A1').value = 'MÓDULO DE IMPORTACIÓN INICIAL';
    wsInicio.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF004F7B' } };
    wsInicio.getCell('A3').value = 'Siga estos pasos para diligenciar la plantilla de migración:';
    wsInicio.getCell('A5').value = '1. Registre sus clientes en la hoja "Clientes".';
    wsInicio.getCell('A6').value = '2. Registre los créditos asociados en la hoja "Créditos".';
    wsInicio.getCell('A7').value = '3. Los encabezados con asterisco (*) son obligatorios.';
    wsInicio.getCell('A8').value = '4. Ingrese CC y teléfonos como texto, sin puntos ni espacios.';
    wsInicio.getCell('A9').value = '5. Empiece a llenar datos a partir de la fila 7 en todas las hojas.';
    
    wsInicio.getCell('A11').value = 'Tipos de Carga para Créditos:';
    wsInicio.getCell('A11').font = { bold: true };
    wsInicio.getCell('A12').value = '• HISTORICA: Créditos antiguos. Normalmente NO descuenta dinero de caja.';
    wsInicio.getCell('A13').value = '• OPERATIVA: Créditos nuevos. Normalmente SÍ descuenta dinero de caja.';

    wsInicio.getCell('A15').value = 'Niveles de Riesgo (Equivalencia en días de mora):';
    wsInicio.getCell('A15').font = { bold: true };
    wsInicio.getCell('A16').value = '• Mínimo: 0 días';
    wsInicio.getCell('A17').value = '• Leve: 1 a 3 días';
    wsInicio.getCell('A18').value = '• Precaución: 4 a 7 días';
    wsInicio.getCell('A19').value = '• Moderado: 8 a 14 días';
    wsInicio.getCell('A20').value = '• Crítico: 15 o más días';

    // Hoja: Clientes
    const wsClientes = workbook.addWorksheet('Clientes');
    wsClientes.columns = [
      { header: 'Acción*', key: 'accion', width: 15 },
      { header: 'Código importación*', key: 'codigo_importacion_cliente', width: 25 },
      { header: 'CC cliente*', key: 'cc', width: 20 },
      { header: 'Nombres*', key: 'nombres', width: 25 },
      { header: 'Apellidos*', key: 'apellidos', width: 25 },
      { header: 'Teléfono*', key: 'telefono', width: 20 },
      { header: 'Correo', key: 'correo', width: 25 },
      { header: 'Dirección', key: 'direccion', width: 30 },
      { header: 'Referencia', key: 'referencia', width: 20 },
      { header: 'Ref1 Nombre', key: 'referencia1_nombre', width: 25 },
      { header: 'Ref1 Teléfono', key: 'referencia1_telefono', width: 20 },
      { header: 'Ref2 Nombre', key: 'referencia2_nombre', width: 25 },
      { header: 'Ref2 Teléfono', key: 'referencia2_telefono', width: 20 },
      { header: 'Nivel riesgo', key: 'nivel_riesgo', width: 15 },
      { header: 'Ruta código', key: 'ruta_codigo', width: 15 },
      { header: 'Observaciones', key: 'observaciones', width: 30 },
    ];
    // Move headers from row 1 to row 6
    const clientesHeaders = wsClientes.getRow(1).values;
    wsClientes.getRow(1).values = [];
    wsClientes.getRow(6).values = clientesHeaders;
    
    this.formatHeader(wsClientes, 'Gestión de Clientes', 'Registre aquí los datos básicos. Una fila por cliente.', '📝 Escriba los datos desde la fila 7 hacia abajo');

    wsClientes.getColumn(3).numFmt = '@'; // cc
    wsClientes.getColumn(6).numFmt = '@'; // telefono
    wsClientes.getColumn(11).numFmt = '@'; // ref1_tel
    wsClientes.getColumn(13).numFmt = '@'; // ref2_tel

    // Hoja: Créditos
    const wsCreditos = workbook.addWorksheet('Créditos');
    wsCreditos.columns = [
      { header: 'Acción*', key: 'accion', width: 15 },
      { header: 'Código importación*', key: 'codigo_importacion_credito', width: 25 },
      { header: 'Número préstamo', key: 'numero_prestamo', width: 20 },
      { header: 'CC cliente*', key: 'cc_cliente', width: 20 },
      { header: 'Tipo préstamo*', key: 'tipo_prestamo', width: 15 },
      { header: 'Producto código', key: 'producto_codigo', width: 20 },
      { header: 'Monto*', key: 'monto', width: 15 },
      { header: 'Cuota inicial', key: 'cuota_inicial', width: 15 },
      { header: 'Tasa interés*', key: 'tasa_interes', width: 15 },
      { header: 'Tasa interés mora', key: 'tasa_interes_mora', width: 18 },
      { header: 'Frecuencia pago*', key: 'frecuencia_pago', width: 18 },
      { header: 'Cantidad cuotas*', key: 'cantidad_cuotas', width: 18 },
      { header: 'Plazo meses*', key: 'plazo_meses', width: 15 },
      { header: 'Tipo amortización', key: 'tipo_amortizacion', width: 20 },
      { header: 'Fecha crédito*', key: 'fecha_credito', width: 15 },
      { header: 'Fecha primer cobro', key: 'fecha_primer_cobro', width: 20 },
      { header: 'Tipo carga*', key: 'tipo_carga', width: 15 },
      { header: 'Descontar dinero de caja*', key: 'descontar_dinero_de_caja', width: 25 },
      { header: 'Garantía', key: 'garantia', width: 20 },
      { header: 'Notas', key: 'notas', width: 30 },
    ];
    // Move headers from row 1 to row 6
    const creditosHeaders = wsCreditos.getRow(1).values;
    wsCreditos.getRow(1).values = [];
    wsCreditos.getRow(6).values = creditosHeaders;
    
    this.formatHeader(wsCreditos, 'Gestión de Créditos', 'Vincule créditos a los clientes creados.', '📝 Escriba los datos desde la fila 7 hacia abajo');
    
    wsCreditos.getColumn(4).numFmt = '@';

    // Hoja: Valores
    const wsValores = workbook.addWorksheet('Valores');
    wsValores.getCell('A1').value = 'Acción';
    wsValores.getCell('A2').value = 'CREAR';
    
    wsValores.getCell('B1').value = 'Nivel Riesgo';
    wsValores.getCell('B2').value = 'Mínimo';
    wsValores.getCell('B3').value = 'Leve';
    wsValores.getCell('B4').value = 'Precaución';
    wsValores.getCell('B5').value = 'Moderado';
    wsValores.getCell('B6').value = 'Crítico';
    
    wsValores.getCell('C1').value = 'Tipo Préstamo';
    wsValores.getCell('C2').value = 'EFECTIVO';
    wsValores.getCell('C3').value = 'ARTICULO';
    
    wsValores.getCell('D1').value = 'Frecuencia Pago';
    wsValores.getCell('D2').value = 'DIARIO';
    wsValores.getCell('D3').value = 'SEMANAL';
    wsValores.getCell('D4').value = 'QUINCENAL';
    wsValores.getCell('D5').value = 'MENSUAL';

    wsValores.getCell('E1').value = 'Tipo Amortización';
    wsValores.getCell('E2').value = 'Interés simple';
    wsValores.getCell('E3').value = 'Amortización fija';

    wsValores.getCell('F1').value = 'Tipo Carga';
    wsValores.getCell('F2').value = 'HISTORICA';
    wsValores.getCell('F3').value = 'OPERATIVA';
    
    wsValores.getCell('G1').value = 'Descontar Caja';
    wsValores.getCell('G2').value = 'SI';
    wsValores.getCell('G3').value = 'NO';

    // Listas desplegables desde la fila 7
    for (let i = 7; i <= 1000; i++) {
      wsClientes.getCell(`A${i}`).dataValidation = { type: 'list', allowBlank: false, formulae: ['"CREAR"'] };
      wsClientes.getCell(`N${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['Valores!$B$2:$B$6'] };
      
      wsCreditos.getCell(`A${i}`).dataValidation = { type: 'list', allowBlank: false, formulae: ['"CREAR"'] };
      wsCreditos.getCell(`E${i}`).dataValidation = { type: 'list', allowBlank: false, formulae: ['Valores!$C$2:$C$3'] };
      wsCreditos.getCell(`K${i}`).dataValidation = { type: 'list', allowBlank: false, formulae: ['Valores!$D$2:$D$5'] };
      wsCreditos.getCell(`N${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['Valores!$E$2:$E$3'] };
      wsCreditos.getCell(`Q${i}`).dataValidation = { type: 'list', allowBlank: false, formulae: ['Valores!$F$2:$F$3'] };
      wsCreditos.getCell(`R${i}`).dataValidation = { type: 'list', allowBlank: false, formulae: ['Valores!$G$2:$G$3'] };
    }

    // Hoja: Ejemplos
    const wsEjemplos = workbook.addWorksheet('Ejemplos');
    wsEjemplos.getCell('A1').value = 'GUÍA DE EJEMPLOS';
    wsEjemplos.getCell('A1').font = { bold: true, size: 14 };
    
    wsEjemplos.getCell('A3').value = 'CLIENTE TÍPICO:';
    wsEjemplos.getCell('A4').value = 'Acción, Código importación*, CC cliente*, Nombres*, Apellidos*, Teléfono*, Nivel riesgo';
    wsEjemplos.getCell('A5').value = 'CREAR | CLI-001 | 12345678 | Juan | Perez | 3001234567 | Mínimo';
    
    wsEjemplos.getCell('A7').value = 'CRÉDITO HISTÓRICO (No afecta caja actual):';
    wsEjemplos.getCell('A8').value = 'Acción, Código importación*, CC cliente*, Tipo préstamo*, Monto*, Tasa interés*, Frecuencia pago*, Cantidad cuotas*, Plazo meses*, Fecha crédito*, Tipo carga*, Descontar dinero de caja*';
    wsEjemplos.getCell('A9').value = 'CREAR | CRE-001 | 12345678 | EFECTIVO | 500000 | 10 | DIARIO | 30 | 1 | 2026-05-01 | HISTORICA | NO';

    wsEjemplos.getCell('A11').value = 'CRÉDITO OPERATIVO (Afecta caja actual):';
    wsEjemplos.getCell('A12').value = 'CREAR | CRE-002 | 12345678 | EFECTIVO | 300000 | 10 | DIARIO | 30 | 1 | 2026-06-26 | OPERATIVA | SI';

    const buffer = await workbook.xlsx.writeBuffer();
    return {
      data: Buffer.from(buffer as ArrayBuffer),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: 'plantilla-clientes-creditos.xlsx'
    };
  }

  async generarPlantillaInventario(): Promise<{ data: Buffer; contentType: string; filename: string }> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Créditos del Sur';

    // Hoja: Inicio
    const wsInicio = workbook.addWorksheet('Inicio');
    wsInicio.getCell('A1').value = 'MÓDULO DE IMPORTACIÓN DE INVENTARIO';
    wsInicio.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF004F7B' } };
    wsInicio.getCell('A3').value = '1. Llene la hoja "Artículos" con los productos.';
    wsInicio.getCell('A4').value = '2. Llene la hoja "Precios" con los precios por meses para dichos productos.';
    wsInicio.getCell('A5').value = '3. Los encabezados con asterisco (*) son obligatorios.';
    wsInicio.getCell('A6').value = '4. Empiece a llenar datos a partir de la fila 7.';

    // Hoja: Artículos
    const wsArticulos = workbook.addWorksheet('Artículos');
    wsArticulos.columns = [
      { header: 'Acción*', key: 'accion', width: 15 },
      { header: 'Código*', key: 'codigo', width: 20 },
      { header: 'Nombre*', key: 'nombre', width: 35 },
      { header: 'Descripción', key: 'descripcion', width: 35 },
      { header: 'Categoría*', key: 'categoria', width: 25 },
      { header: 'Marca', key: 'marca', width: 20 },
      { header: 'Modelo', key: 'modelo', width: 20 },
      { header: 'Costo*', key: 'costo', width: 15 },
      { header: 'Stock*', key: 'stock', width: 15 },
      { header: 'Stock mínimo*', key: 'stock_minimo', width: 15 },
      { header: 'Activo*', key: 'activo', width: 15 },
      { header: 'Observaciones', key: 'observaciones', width: 30 },
    ];
    // Move headers
    const articulosHeaders = wsArticulos.getRow(1).values;
    wsArticulos.getRow(1).values = [];
    wsArticulos.getRow(6).values = articulosHeaders;
    
    this.formatHeader(wsArticulos, 'Catálogo de Artículos', 'Defina su inventario base.', '📝 Escriba los datos desde la fila 7 hacia abajo');

    // Hoja: Precios
    const wsPrecios = workbook.addWorksheet('Precios');
    wsPrecios.columns = [
      { header: 'Código producto*', key: 'codigo_producto', width: 20 },
      { header: 'Meses*', key: 'meses', width: 15 },
      { header: 'Precio*', key: 'precio', width: 15 },
      { header: 'Activo*', key: 'activo', width: 15 },
    ];
    // Move headers
    const preciosHeaders = wsPrecios.getRow(1).values;
    wsPrecios.getRow(1).values = [];
    wsPrecios.getRow(6).values = preciosHeaders;

    this.formatHeader(wsPrecios, 'Precios a Plazos', 'Defina los precios según el plazo.', '📝 Escriba los datos desde la fila 7 hacia abajo');

    // Hoja: Valores
    const wsValores = workbook.addWorksheet('Valores');
    wsValores.getCell('A1').value = 'Acción';
    wsValores.getCell('A2').value = 'CREAR';
    
    wsValores.getCell('B1').value = 'Activo';
    wsValores.getCell('B2').value = 'SI';
    wsValores.getCell('B3').value = 'NO';

    // Listas desplegables desde fila 7
    for (let i = 7; i <= 1000; i++) {
      wsArticulos.getCell(`A${i}`).dataValidation = { type: 'list', allowBlank: false, formulae: ['"CREAR"'] };
      wsArticulos.getCell(`K${i}`).dataValidation = { type: 'list', allowBlank: false, formulae: ['Valores!$B$2:$B$3'] };
      
      wsPrecios.getCell(`D${i}`).dataValidation = { type: 'list', allowBlank: false, formulae: ['Valores!$B$2:$B$3'] };
    }

    // Hoja: Ejemplos
    const wsEjemplos = workbook.addWorksheet('Ejemplos');
    wsEjemplos.getCell('A1').value = 'GUÍA DE EJEMPLOS';
    wsEjemplos.getCell('A1').font = { bold: true, size: 14 };
    
    wsEjemplos.getCell('A3').value = 'EJEMPLO ARTÍCULO:';
    wsEjemplos.getCell('A4').value = 'Acción, Código, Nombre, Categoría, Costo, Stock, Stock mínimo, Activo';
    wsEjemplos.getCell('A5').value = 'CREAR | CEL-A15 | Samsung Galaxy A15 | Celulares | 480000 | 10 | 2 | SI';
    
    wsEjemplos.getCell('A7').value = 'EJEMPLO PRECIOS:';
    wsEjemplos.getCell('A8').value = 'Código producto, Meses, Precio, Activo';
    wsEjemplos.getCell('A9').value = 'CEL-A15 | 1 | 580000 | SI';
    wsEjemplos.getCell('A10').value = 'CEL-A15 | 2 | 640000 | SI';

    const buffer = await workbook.xlsx.writeBuffer();
    return {
      data: Buffer.from(buffer as ArrayBuffer),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: 'plantilla-inventario.xlsx'
    };
  }

  // --- Validación ---

  async validarClientesCreditos(file: Express.Multer.File): Promise<ResultadoValidacion> {
    if (!file || !file.buffer) {
      throw new BadRequestException('Archivo no proporcionado');
    }
    try {
      return await this.clientesCreditosParser.parseAndValidate(file.buffer, file.originalname);
    } catch (error) {
      throw new BadRequestException('El archivo no es un Excel válido o está dañado.');
    }
  }

  async validarInventario(file: Express.Multer.File): Promise<ResultadoValidacion> {
    if (!file || !file.buffer) {
      throw new BadRequestException('Archivo no proporcionado');
    }
    try {
      return await this.inventarioParser.parseAndValidate(file.buffer, file.originalname);
    } catch (error) {
      throw new BadRequestException('El archivo no es un Excel válido o está dañado.');
    }
  }

  // --- Confirmación ---

  async confirmarInventario(
    file: Express.Multer.File,
    creadoPorId: string,
  ): Promise<{
    loteId: string;
    estado: string;
    articulosCreados: number;
    articulosOmitidos: number;
    preciosCreados: number;
    preciosOmitidos: number;
    resumen: any;
  }> {
    if (!file || !file.buffer) {
      throw new BadRequestException('Archivo no proporcionado');
    }

    // 1. Re-validar
    let resultado: ResultadoValidacion;
    try {
      resultado = await this.inventarioParser.parseAndValidate(file.buffer, file.originalname);
    } catch {
      throw new BadRequestException('El archivo no es un Excel válido o está dañado.');
    }

    // 2. Bloquear si hay errores
    if (resultado.errores.length > 0) {
      // Registrar lote fallido para trazabilidad
      const lote = await this.prisma.importacionLote.create({
        data: {
          tipo: 'INVENTARIO',
          estado: 'FALLIDO',
          nombreArchivo: file.originalname,
          totalFilas: resultado.resumen.totalFilas,
          filasValidas: resultado.resumen.filasValidas,
          filasConError: resultado.resumen.filasConError,
          advertencias: resultado.resumen.advertencias,
          resumen: resultado.resumen as any,
          errores: resultado.errores as any,
          creadoPorId,
        },
      });

      throw new BadRequestException({
        message: `El archivo tiene ${resultado.errores.length} error(es). Corrija los errores antes de confirmar.`,
        loteId: lote.id,
        errores: resultado.errores.slice(0, 20), // Primeros 20 errores
        totalErrores: resultado.errores.length,
      });
    }

    const articulos: any[] = (resultado as any).articulos ?? [];
    const precios: any[] = (resultado as any).precios ?? [];

    // 3. Ejecutar dentro de transacción
    let articulosCreados = 0;
    let articulosOmitidos = 0;
    let preciosCreados = 0;
    let preciosOmitidos = 0;

    // La importación de inventario actual es una carga operativa inicial:
    // crea catálogo, stock y precios, pero no genera asientos contables.
    await this.prisma.$transaction(async (tx) => {
      // Crear o verificar artículos (idempotencia por código)
      for (const art of articulos) {
        const existe = await tx.producto.findUnique({
          where: { codigo: art.codigo },
          select: { id: true },
        });

        if (existe) {
          articulosOmitidos++;
          continue;
        }

        await tx.producto.create({
          data: {
            codigo: art.codigo,
            nombre: art.nombre,
            descripcion: art.descripcion || null,
            categoria: art.categoria,
            marca: art.marca || null,
            modelo: art.modelo || null,
            costo: art.costo,
            stock: art.stock ?? 0,
            stockMinimo: art.stockMinimo ?? 0,
            activo: art.activo !== 'NO',
          },
        });
        articulosCreados++;
      }

      // Crear precios (idempotencia por código + meses)
      for (const precio of precios) {
        const producto = await tx.producto.findUnique({
          where: { codigo: precio.codigoProducto },
          select: { id: true },
        });

        if (!producto) {
          preciosOmitidos++;
          continue;
        }

        const existePrecio = await tx.precioProducto.findFirst({
          where: { productoId: producto.id, meses: precio.meses },
          select: { id: true },
        });

        if (existePrecio) {
          preciosOmitidos++;
          continue;
        }

        await tx.precioProducto.create({
          data: {
            productoId: producto.id,
            meses: precio.meses,
            precio: precio.precio,
            activo: precio.activo !== 'NO',
          },
        });
        preciosCreados++;
      }
    });

    // 4. Registrar lote confirmado
    const lote = await this.prisma.importacionLote.create({
      data: {
        tipo: 'INVENTARIO',
        estado: 'CONFIRMADO',
        nombreArchivo: file.originalname,
        totalFilas: resultado.resumen.totalFilas,
        filasValidas: resultado.resumen.filasValidas,
        filasConError: resultado.resumen.filasConError,
        advertencias: resultado.resumen.advertencias,
        resumen: resultado.resumen as any,
        creadoPorId,
        confirmadoEn: new Date(),
      },
    });

    return {
      loteId: lote.id,
      estado: 'CONFIRMADO',
      articulosCreados,
      articulosOmitidos,
      preciosCreados,
      preciosOmitidos,
      resumen: resultado.resumen,
    };
  }

  async confirmarClientesCreditos(
    file: Express.Multer.File,
    creadoPorId: string,
  ): Promise<{
    loteId: string;
    clientesCreados: number;
    clientesOmitidos: number;
    creditosHistoricosCreados: number;
    creditosOperativosCreados: number;
    creditosOmitidos: number;
    creditosNoSoportados: number;
    transaccionesCreadas: number;
    asientosCreados: number;
    cuotasCreadas: number;
    mensajes: string[];
    resumen: any;
  }> {
    if (!file || !file.buffer) {
      throw new BadRequestException('Archivo no proporcionado');
    }

    // 1. Re-validar
    let resultado: ResultadoValidacion;
    try {
      resultado = await this.clientesCreditosParser.parseAndValidate(file.buffer, file.originalname);
    } catch {
      throw new BadRequestException('El archivo no es un Excel válido o está dañado.');
    }

    // 2. Bloquear si hay errores
    if (resultado.errores.length > 0) {
      const lote = await this.prisma.importacionLote.create({
        data: {
          tipo: 'CLIENTES_CREDITOS',
          estado: 'FALLIDO',
          nombreArchivo: file.originalname,
          totalFilas: resultado.resumen.totalFilas,
          filasValidas: resultado.resumen.filasValidas,
          filasConError: resultado.resumen.filasConError,
          advertencias: resultado.resumen.advertencias,
          resumen: resultado.resumen as any,
          errores: resultado.errores as any,
          creadoPorId,
        },
      });

      throw new BadRequestException({
        message: `El archivo tiene ${resultado.errores.length} error(es). Corrija los errores antes de confirmar.`,
        loteId: lote.id,
        errores: resultado.errores.slice(0, 20),
        totalErrores: resultado.errores.length,
      });
    }

    const clientes: any[] = (resultado as any).clientes ?? [];
    
    // Mapeo de NivelRiesgo (operativo a Prisma)
    const mapNivelRiesgo = (nivel: string): 'VERDE' | 'AMARILLO' | 'ROJO' => {
      const n = (nivel || '').toUpperCase();
      if (n === 'PRECAUCION' || n === 'MODERADO') return 'AMARILLO';
      if (n === 'CRITICO') return 'ROJO';
      return 'VERDE'; // MINIMO, LEVE o por defecto
    };

    let clientesCreados = 0;
    let clientesOmitidos = 0;
    let creditosHistoricosCreados = 0;
    let creditosOperativosCreados = 0;
    let creditosOmitidos = 0;
    let creditosNoSoportados = 0;
    let transaccionesCreadas = 0;
    let asientosCreados = 0;
    let cuotasCreadas = 0;
    const mensajes: string[] = [];
    const rutaCodigoInformada = clientes.some((cli) => Boolean(cli.rutaCodigo));

    if (rutaCodigoInformada) {
      mensajes.push('Advertencia: rutaCodigo se valida, pero la asignación automática de ruta queda pendiente para V2.3.1.');
    }

    let loteId = '';

    // 3. Ejecutar dentro de transacción con try-catch para rollback y lote FALLIDO
    try {
      await this.prisma.$transaction(async (tx) => {
        for (const cli of clientes) {
        // Idempotencia por DNI o código
        const existente = await tx.cliente.findFirst({
          where: {
            OR: [
              { dni: cli.cc },
              { codigo: cli.codigoImp },
              { idempotencyKey: cli.codigoImp },
            ],
          },
          select: { id: true },
        });

        if (existente) {
          clientesOmitidos++;
          continue;
        }

        await tx.cliente.create({
          data: {
            codigo: cli.codigoImp || cli.cc, // Fallback si no viene algo único
            idempotencyKey: cli.codigoImp, // Usamos el código importación del excel
            dni: cli.cc,
            nombres: cli.nombres,
            apellidos: cli.apellidos,
            correo: cli.correo || null,
            telefono: cli.telefono,
            direccion: cli.direccion || null,
            referencia: cli.referencia || null,
            referencia1Nombre: cli.referencia1Nombre || null,
            referencia1Telefono: cli.referencia1Telefono || null,
            referencia2Nombre: cli.referencia2Nombre || null,
            referencia2Telefono: cli.referencia2Telefono || null,
            nivelRiesgo: mapNivelRiesgo(cli.nivelRiesgo),
            creadoPorId,
            estadoAprobacion: 'APROBADO',
            aprobadoPorId: creadoPorId,
            // Si la ruta viene en el excel y es válida, deberíamos asignarla?
            // Por el momento lo agregamos simple si aplica.
          },
        });
        clientesCreados++;
      }

        // V2.3 usa CAJA-OFICINA como caja institucional para importaciones administrativas.
        // La resolución por caja de ruta queda pendiente para una fase posterior.
        const cajaOficina = await tx.caja.findFirst({
          where: { codigo: 'CAJA-OFICINA' },
        });

        let saldoDisponibleCajaOficina = cajaOficina ? Number(cajaOficina.saldoActual || 0) : 0;

        // Procesar créditos
        const creditos: any[] = (resultado as any).creditos ?? [];
        const roundMoney = (value: number) => Math.round(value * 100) / 100;
        const hayCreditoOperativoEfectivo = creditos.some(
          (cred) =>
            cred.tipoCarga === 'OPERATIVA' &&
            cred.descontarCaja === 'SI' &&
            cred.tipoPrestamo === 'EFECTIVO',
        );

        if (hayCreditoOperativoEfectivo) {
          mensajes.push('V2.3 usa CAJA-OFICINA como caja institucional para créditos operativos importados.');
        }
      
        for (const cred of creditos) {
        const isHistorica = cred.tipoCarga === 'HISTORICA' && cred.descontarCaja === 'NO';
        const isOperativaEfectivo = cred.tipoCarga === 'OPERATIVA' && cred.descontarCaja === 'SI' && cred.tipoPrestamo === 'EFECTIVO';

        if (!isHistorica && !isOperativaEfectivo) {
          creditosNoSoportados++;
          if (cred.tipoCarga === 'OPERATIVA' && cred.tipoPrestamo === 'ARTICULO') {
            mensajes.push(`Fila ${cred.fila}: La importación operativa de créditos por artículo se implementará en una fase posterior.`);
          } else if (cred.tipoCarga === 'OPERATIVA' && cred.descontarCaja === 'NO') {
            mensajes.push(`Fila ${cred.fila}: La importación operativa sin afectación de caja se implementará en una fase posterior.`);
          }
          continue;
        }

        if (isOperativaEfectivo && cred.cuotaInicial > 0) {
          creditosNoSoportados++;
          mensajes.push(`Fila ${cred.fila}: La cuota inicial en créditos operativos de efectivo aún no está soportada.`);
          continue;
        }

        // Idempotencia de préstamo
        const prestamoExistente = await tx.prestamo.findFirst({
          where: {
            OR: [
              { numeroPrestamo: cred.numeroPrestamo },
              { idempotencyKey: cred.codigoImp },
            ],
          },
          select: { id: true },
        });

        if (prestamoExistente) {
          creditosOmitidos++;
          continue;
        }

        // Buscar cliente
        const cliente = await tx.cliente.findUnique({
          where: { dni: cred.ccCliente },
          select: { id: true },
        });

        if (!cliente) {
          // El cliente debería existir si pasó la validación, si no, omitimos por seguridad
          creditosOmitidos++;
          continue;
        }

        if (isOperativaEfectivo) {
          if (!cajaOficina) {
            throw new BadRequestException('No se encontró la caja institucional CAJA-OFICINA para desembolsos importados.');
          }
          if (!cajaOficina.activa) {
            throw new BadRequestException('La caja CAJA-OFICINA no está activa.');
          }
          const montoDesembolso = Number(cred.monto);
          if (saldoDisponibleCajaOficina < montoDesembolso) {
            throw new BadRequestException(`La caja CAJA-OFICINA no tiene saldo suficiente para confirmar el crédito operativo (Fila ${cred.fila}). Saldo disponible: ${saldoDisponibleCajaOficina}, Monto: ${montoDesembolso}`);
          }

          // Solo control acumulado para validar el lote completo.
          // El movimiento real de caja lo hace ledgerService.registrarDesembolso()
          // dentro de esta misma transacción mediante cajaDelta.
          saldoDisponibleCajaOficina = roundMoney(saldoDisponibleCajaOficina - montoDesembolso);
        }

        let productoId: string | undefined;
        let precioProductoId: string | undefined;
        let precioVentaArticulo: number | undefined;
        let costoArticulo: number | undefined;
        let margenArticulo: number | undefined;

        if (cred.tipoPrestamo === 'ARTICULO') {
          const producto = await tx.producto.findUnique({
            where: { codigo: cred.productoCodigo },
            select: {
              id: true,
              costo: true,
              precios: {
                where: {
                  meses: cred.plazoMeses,
                  activo: true,
                },
                select: {
                  id: true,
                  precio: true,
                },
                take: 1,
              },
            },
          });
          
          if (producto) {
            productoId = producto.id;
            precioProductoId = producto.precios[0]?.id;
            precioVentaArticulo = producto.precios[0]?.precio ? Number(producto.precios[0].precio) : undefined;
            costoArticulo = producto.costo ? Number(producto.costo) : undefined;
            if (precioVentaArticulo !== undefined && costoArticulo !== undefined) {
              margenArticulo = precioVentaArticulo - costoArticulo;
            }
          }
          // Nota V2.2: Para históricos, no bloqueamos si no hay precioProducto (precioProductoId/margen pueden quedar null).
          // El crédito se crea porque el monto real ya viene dado en el Excel.
        }

        // Cálculos financieros
        const monto = Number(cred.monto);
        const plazoMeses = Number(cred.plazoMeses);
        const tasaInteres = Number(cred.tasaInteres);
        const cantidadCuotas = Number(cred.cantidadCuotas);
        
        // Interés total simple: monto * (tasa / 100) * plazoMeses

        
        const interesTotal = roundMoney(monto * (tasaInteres / 100) * plazoMeses);
        const totalPrestamo = roundMoney(monto + interesTotal);
        
        const capitalBase = roundMoney(monto / cantidadCuotas);
        const interesBase = roundMoney(interesTotal / cantidadCuotas);

        // Pre-calcular fechas de cuotas
        const fechasCuotas: Date[] = [];
        let fechaVencimiento = new Date(cred.fechaPrimerCobro || cred.fechaCredito);
        
        for (let i = 1; i <= cantidadCuotas; i++) {
          fechasCuotas.push(new Date(fechaVencimiento));
          if (cred.frecuenciaPago === 'MENSUAL') {
            fechaVencimiento.setMonth(fechaVencimiento.getMonth() + 1);
          } else if (cred.frecuenciaPago === 'QUINCENAL') {
            fechaVencimiento.setDate(fechaVencimiento.getDate() + 15);
          } else if (cred.frecuenciaPago === 'SEMANAL') {
            fechaVencimiento.setDate(fechaVencimiento.getDate() + 7);
          } else if (cred.frecuenciaPago === 'DIARIO') {
            fechaVencimiento.setDate(fechaVencimiento.getDate() + 1);
          }
        }

        const fechaFin = fechasCuotas[fechasCuotas.length - 1];

        const prestamo = await tx.prestamo.create({
          data: {
            numeroPrestamo: cred.numeroPrestamo,
            idempotencyKey: cred.codigoImp,
            clienteId: cliente.id,
            productoId,
            precioProductoId,
            precioVentaArticulo,
            costoArticulo,
            margenArticulo,
            tipoPrestamo: cred.tipoPrestamo,
            tipoAmortizacion: cred.tipoAmortizacion || 'INTERES_PLANO',
            monto,
            tasaInteres,
            tasaInteresMora: cred.tasaInteresMora || 0,
            plazoMeses,
            frecuenciaPago: cred.frecuenciaPago,
            cantidadCuotas,
            fechaInicio: cred.fechaCredito,
            fechaPrimerCobro: cred.fechaPrimerCobro || cred.fechaCredito,
            fechaFin,
            estado: 'ACTIVO',
            creadoPorId,
            aprobadoPorId: creadoPorId,
            estadoAprobacion: 'APROBADO',
            interesTotal,
            saldoPendiente: totalPrestamo,
            totalPagado: 0,
            capitalPagado: 0,
            interesPagado: 0,
            interesMoraPagado: 0,
            
            // Nota V2.2: En importación histórica, cuotaInicial se conserva como dato informativo
            // y no reduce el saldoPendiente ni el cálculo de cuotas históricas.
            cuotaInicial: cred.cuotaInicial || 0,
            estadoSincronizacion: 'PENDIENTE',
            garantia: cred.garantia || null,
            notas: cred.notas || null,
          },
        });

        if (isOperativaEfectivo) {
          creditosOperativosCreados++;
        } else {
          creditosHistoricosCreados++;
        }

        // Si es operativo, registrar transacción de desembolso
        if (isOperativaEfectivo && cajaOficina) {
          const montoDesembolso = Number(cred.monto);
          const transaccion = await tx.transaccion.create({
            data: {
              numeroTransaccion: `IMP-DES-${prestamo.id.slice(0, 24)}`,
              idempotencyKey: `IMP-DESEMBOLSO-${prestamo.id}`,
              cajaId: cajaOficina.id,
              clienteId: cliente.id,
              tipo: 'EGRESO',
              monto: montoDesembolso,
              descripcion: `Desembolso de crédito operativo importado #${cred.numeroPrestamo}`,
              creadoPorId,
              tipoReferencia: 'PRESTAMO',
              referenciaId: prestamo.id,
            },
          });
          transaccionesCreadas++;

          const accountCodeOrigen = this.getAccountCodeCaja(cajaOficina);

          const journalEntry = await this.ledgerService.registrarDesembolso(
            {
              prestamoId: prestamo.id,
              monto: montoDesembolso,
              cajaOrigenId: cajaOficina.id,
              accountCodeOrigen,
              createdBy: creadoPorId,
            },
            tx,
          );
          if (journalEntry) {
            asientosCreados++;
          }
        }

        // Crear cuotas
        let capitalAcumulado = 0;
        let interesAcumulado = 0;

        for (let i = 1; i <= cantidadCuotas; i++) {
          const esUltima = i === cantidadCuotas;
          const capitalCuota = esUltima ? roundMoney(monto - capitalAcumulado) : capitalBase;
          const interesCuota = esUltima ? roundMoney(interesTotal - interesAcumulado) : interesBase;
          const montoCuota = roundMoney(capitalCuota + interesCuota);

          capitalAcumulado = roundMoney(capitalAcumulado + capitalCuota);
          interesAcumulado = roundMoney(interesAcumulado + interesCuota);

          await tx.cuota.create({
            data: {
              prestamoId: prestamo.id,
              numeroCuota: i,
              fechaVencimiento: fechasCuotas[i - 1],
              monto: montoCuota,
              montoCapital: capitalCuota,
              montoInteres: interesCuota,
              montoInteresMora: 0,
              estado: 'PENDIENTE',
              montoPagado: 0,
            },
          });
          cuotasCreadas++;
        }
      }

      // 4. Registrar lote confirmado dentro de la transacción
      const lote = await tx.importacionLote.create({
        data: {
          tipo: 'CLIENTES_CREDITOS',
          estado: 'CONFIRMADO',
          nombreArchivo: file.originalname,
          totalFilas: resultado.resumen.totalFilas,
          filasValidas: resultado.resumen.filasValidas,
          filasConError: resultado.resumen.filasConError,
          advertencias: resultado.resumen.advertencias,
          resumen: resultado.resumen as any,
          creadoPorId,
          confirmadoEn: new Date(),
        },
      });
      loteId = lote.id;
    });
    } catch (error) {
      await this.prisma.importacionLote.create({
        data: {
          tipo: 'CLIENTES_CREDITOS',
          estado: 'FALLIDO',
          nombreArchivo: file.originalname,
          totalFilas: resultado.resumen.totalFilas,
          filasValidas: resultado.resumen.filasValidas,
          filasConError: resultado.resumen.filasConError,
          advertencias: resultado.resumen.advertencias,
          resumen: resultado.resumen as any,
          errores: [
            {
              hoja: 'GLOBAL',
              fila: 0,
              campo: 'confirmacion',
              mensaje:
                error instanceof Error
                  ? error.message
                  : 'Error inesperado confirmando importación',
              valor: null,
            },
          ] as any,
          creadoPorId,
        },
      });

      throw error;
    }

    mensajes.push('Clientes y créditos confirmados correctamente.');

    return {
      loteId,
      clientesCreados,
      clientesOmitidos,
      creditosHistoricosCreados,
      creditosOperativosCreados,
      creditosOmitidos,
      creditosNoSoportados,
      transaccionesCreadas,
      asientosCreados,
      cuotasCreadas,
      mensajes,
      resumen: resultado.resumen,
    };
  }
}
