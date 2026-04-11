import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  EstadoPrestamo,
  EstadoCuota,
  NivelRiesgo,
  FrecuenciaPago,
  TipoAprobacion,
  EstadoAprobacion,
  RolUsuario,
  TipoAmortizacion,
  Prisma,
} from '@prisma/client';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { NotificacionesGateway } from '../notificaciones/notificaciones.gateway';
import { AuditService } from '../audit/audit.service';
import { PushService } from '../push/push.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import { UpdateLoanData } from '../common/types';
import { 
  generarExcelCartera, 
  generarPDFCartera, 
  CarteraRow, 
  CarteraTotales 
} from '../templates/exports/cartera-creditos.template';
import { ContratoData, generarContratoPDF } from '../templates/exports';
import {
  calculateDateRange,
  formatBogotaOffsetIso,
  getBogotaDayKey,
  getBogotaWeekday,
  getBogotaStartEndOfDay,
  getBogotaStartEndOfDayFromKey,
} from '../utils/date-utils';


@Injectable()
export class LoansService implements OnModuleInit {
  private readonly logger = new Logger(LoansService.name);

  constructor(
    private prisma: PrismaService,
    private notificacionesService: NotificacionesService,
    private auditService: AuditService,
    private pushService: PushService,
    private notificacionesGateway: NotificacionesGateway,
    private configuracionService: ConfiguracionService,
  ) {}

  async onModuleInit() {
    this.logger.log('🔄 [AUTO-FIX] Verificando e iniciando corrección de intereses al arranque...');
    try {
        const result = await this.fixInterestCalculations();
        this.logger.log(`✅ [AUTO-FIX] Proceso completado. ${result.corrected} préstamos corregidos de ${result.processed} verificados.`);
    } catch (error) {
        this.logger.error(`❌ [AUTO-FIX] Error durante la corrección automática: ${error}`);
    }
  }

  /**
   * Construye el objeto metadata estándar para notificaciones de préstamo.
   * Centraliza el bloque de campos repetido en notifyApprovers + notificacionesService.create
   * dentro de createLoan.
   */
  private buildPrestamoNotifMetadata(params: {
    prestamo: { id: string; numeroPrestamo: string; monto: any; fechaInicio?: Date | null };
    data: { frecuenciaPago: any; cuotaInicial?: number; notas?: string; esContado?: boolean; tipoPrestamo: string };
    cliente: { id: string };
    cantidadCuotas: number;
    numPlazoMeses: number;
    articuloNombre: string;
    isFinanciamientoArticulo: boolean;
    precioArticuloTotal: number;
    safeNumber: (v: any) => number;
  }) {
    const { prestamo, data, cliente, cantidadCuotas, numPlazoMeses, articuloNombre, isFinanciamientoArticulo, precioArticuloTotal, safeNumber } = params;
    return {
      tipoAprobacion: 'NUEVO_PRESTAMO',
      prestamoId: prestamo.id,
      clienteId: cliente.id,
      numeroPrestamo: prestamo.numeroPrestamo,
      monto: safeNumber(prestamo.monto),
      tipoPrestamo: data.tipoPrestamo,
      esContado: !!data.esContado,
      articulo: String(articuloNombre).replace(/&amp;/gi, '&'),
      valorArticulo: isFinanciamientoArticulo ? safeNumber(precioArticuloTotal) : safeNumber(prestamo.monto),
      cuotas: safeNumber(cantidadCuotas),
      cantidadCuotas: safeNumber(cantidadCuotas),
      plazoMeses: numPlazoMeses,
      frecuenciaPago: String(data.frecuenciaPago),
      cuotaInicial: safeNumber(data.cuotaInicial),
      notas: String(data.notas || ''),
      fechaInicio: prestamo.fechaInicio ? formatBogotaOffsetIso(prestamo.fechaInicio) : undefined,
      fecha: prestamo.fechaInicio ? formatBogotaOffsetIso(prestamo.fechaInicio) : undefined,
    };
  }

  async generarContrato(prestamoId: string) {
    const prestamo = await this.prisma.prestamo.findUnique({
      where: { id: prestamoId },
      include: {
        cliente: true,
        producto: true,
        precioProducto: true,
        creadoPor: { select: { nombres: true, apellidos: true } },
        cuotas: { orderBy: { numeroCuota: 'asc' } },
      },
    });

    if (!prestamo) {
      throw new NotFoundException('Préstamo no encontrado');
    }

    if (prestamo.tipoPrestamo !== 'ARTICULO') {
      throw new BadRequestException('Este préstamo no corresponde a un crédito de artículo');
    }

    const fechaParsed = prestamo.fechaInicio ?? prestamo.creadoEn;
    const fmtFechaFormatoLargo = (d: Date) => {
      const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
      return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
    };

    const fmtFecha = (d?: Date | null) =>
      d ? new Date(d).toLocaleDateString('es-CO') : '';

    const clienteNombre = `${prestamo.cliente?.nombres || ''} ${prestamo.cliente?.apellidos || ''}`.trim();
    const vendedorNombre = `${prestamo.creadoPor?.nombres || ''} ${prestamo.creadoPor?.apellidos || ''}`.trim();

    const ref1 = [(prestamo.cliente as any)?.referencia1Nombre, (prestamo.cliente as any)?.referencia1Telefono].filter(Boolean).join(' - ');
    const ref2 = [(prestamo.cliente as any)?.referencia2Nombre, (prestamo.cliente as any)?.referencia2Telefono].filter(Boolean).join(' - ');

    const abonoInicial = prestamo.cuotaInicial ? Number(prestamo.cuotaInicial) : 0;
    const montoFinanciado = prestamo.monto ? Number(prestamo.monto) : 0;
    const precioContado = prestamo.precioProducto?.precio
      ? Number(prestamo.precioProducto.precio)
      : (montoFinanciado + abonoInicial);
    const interesTotal = prestamo.interesTotal ? Number(prestamo.interesTotal) : 0;
    const totalAPagar = montoFinanciado + interesTotal;

    const cuotaPromedio = prestamo.cuotas?.length
      ? Number(prestamo.cuotas[0].monto)
      : 0;

    const frecuencia = (() => {
      switch (prestamo.frecuenciaPago) {
        case 'DIARIO': return 'DIARIO' as any;
        case 'SEMANAL': return 'SEMANAL' as any;
        case 'QUINCENAL': return 'QUINCENAL' as any;
        case 'MENSUAL': return 'MENSUAL' as any;
        default: return undefined;
      }
    })();

    let saldo = totalAPagar;
    const cuotas = (prestamo.cuotas || []).map((c) => {
      const valorCuota = Number(c.monto);
      saldo = Math.max(0, saldo - valorCuota);
      return {
        numero: Number(c.numeroCuota),
        fechaVenc: fmtFecha(c.fechaVencimiento),
        capital: Number((c as any).montoCapital ?? 0),
        interes: Number((c as any).montoInteres ?? 0),
        valorCuota,
        saldo,
      };
    });

    const data: ContratoData = {
      numeroPrestamo: prestamo.numeroPrestamo,
      tipo: 'CREDITO',
      fechaContrato: fmtFechaFormatoLargo(new Date(fechaParsed)),

      clienteNombre,
      clienteCedula: String((prestamo.cliente as any)?.dni ?? ''),
      clienteTelefono: (prestamo.cliente as any)?.telefono ? String((prestamo.cliente as any)?.telefono) : undefined,
      clienteDireccion: (prestamo.cliente as any)?.direccion ? String((prestamo.cliente as any)?.direccion) : undefined,
      referencia1: ref1 || undefined,
      referencia2: ref2 || undefined,

      articulo: prestamo.producto?.nombre || 'Artículo',
      marca: (prestamo.producto as any)?.marca ? String((prestamo.producto as any)?.marca) : undefined,
      modelo: (prestamo.producto as any)?.modelo ? String((prestamo.producto as any)?.modelo) : undefined,

      precioContado,
      abonoInicial,
      montoFinanciado,
      tasaInteres: prestamo.tasaInteres ? Number(prestamo.tasaInteres) : 0,
      interesTotal,
      totalAPagar,

      numeroCuotas: prestamo.cantidadCuotas ? Number(prestamo.cantidadCuotas) : undefined,
      frecuencia,
      valorCuota: cuotaPromedio,
      fechaPrimerPago: prestamo.cuotas?.length ? fmtFecha(prestamo.cuotas[0].fechaVencimiento) : undefined,
      fechaUltimoPago: prestamo.cuotas?.length ? fmtFecha(prestamo.cuotas[prestamo.cuotas.length - 1].fechaVencimiento) : undefined,
      cuotas,

      vendedorNombre: vendedorNombre || undefined,
    };

    return generarContratoPDF(data);
  }

  /**
   * Genera tabla de amortización francesa (cuota fija).
   * La tasa que recibe es la tasa MENSUAL del crédito (ej: 10 = 10% mensual).
   * La conversión a tasa por período se hace de forma compuesta:
   * i_periodo = (1 + i_mensual)^(fracción del mes) - 1
   *
   * @param capital      Monto a financiar
   * @param tasaTotal    Tasa de interés mensual del crédito (%)
   * @param numCuotas    Cantidad de cuotas
   * @param plazoMeses   Plazo en meses (no afecta el cálculo de i_periodo)
   * @param frecuencia   Frecuencia de pago
   * @returns { cuotaFija, interesTotal, tabla[] }
   */
  private calcularAmortizacionFrancesa(
    capital: number,
    tasaTotal: number,
    numCuotas: number,
    plazoMeses: number,
    frecuencia: FrecuenciaPago,
  ) {
    if (numCuotas <= 0 || capital <= 0) {
      return { cuotaFija: 0, interesTotal: 0, tabla: [] };
    }

    // Convertir tasa mensual (%) a tasa mensual decimal
    const tasaMensual = tasaTotal / 100;

    // Convertir a tasa por período de forma compuesta
    // (1 + i_m)^(fracción) - 1
    let fraccionMes = 1;
    switch (frecuencia) {
      case FrecuenciaPago.DIARIO:
        fraccionMes = 1 / 30;
        break;
      case FrecuenciaPago.SEMANAL:
        fraccionMes = 1 / 4;
        break;
      case FrecuenciaPago.QUINCENAL:
        fraccionMes = 1 / 2;
        break;
      case FrecuenciaPago.MENSUAL:
      default:
        fraccionMes = 1;
        break;
    }

    const tasaPeriodo = Math.pow(1 + tasaMensual, fraccionMes) - 1;

    // Si la tasa es 0, amortización lineal pura
    if (tasaPeriodo === 0) {
      const cuotaFija = capital / numCuotas;
      return {
        cuotaFija: Math.round(cuotaFija * 100) / 100,
        interesTotal: 0,
        tabla: Array.from({ length: numCuotas }, (_, i) => ({
          numeroCuota: i + 1,
          montoCapital: Math.round((capital / numCuotas) * 100) / 100,
          montoInteres: 0,
          monto: Math.round(cuotaFija * 100) / 100,
          saldoRestante: Math.round((capital - (capital / numCuotas) * (i + 1)) * 100) / 100,
        })),
      };
    }

    // Fórmula francesa: C = P × r / (1 - (1+r)^-n)
    const cuotaFija =
      (capital * tasaPeriodo) / (1 - Math.pow(1 + tasaPeriodo, -numCuotas));

    let saldo = capital;
    let interesTotalAcumulado = 0;
    const tabla: Array<{
      numeroCuota: number;
      montoCapital: number;
      montoInteres: number;
      monto: number;
      saldoRestante: number;
    }> = [];

    for (let i = 0; i < numCuotas; i++) {
      const interesPeriodo = saldo * tasaPeriodo;
      let capitalPeriodo = cuotaFija - interesPeriodo;

      // Última cuota: ajustar para cerrar el saldo exacto
      if (i === numCuotas - 1) {
        capitalPeriodo = saldo;
      }

      saldo = Math.max(0, saldo - capitalPeriodo);
      interesTotalAcumulado += interesPeriodo;

      const montoCuota = capitalPeriodo + interesPeriodo;

      tabla.push({
        numeroCuota: i + 1,
        montoCapital: Math.round(capitalPeriodo * 100) / 100,
        montoInteres: Math.round(interesPeriodo * 100) / 100,
        monto: Math.round(montoCuota * 100) / 100,
        saldoRestante: Math.round(saldo * 100) / 100,
      });
    }

    return {
      cuotaFija: Math.round(cuotaFija * 100) / 100,
      interesTotal: Math.round(interesTotalAcumulado * 100) / 100,
      tabla,
    };
  }

  /**
   * Avanza la fecha al siguiente día hábil si cae en domingo.
   * Para pagos DIARIO: si cae en domingo, se mueve al lunes siguiente.
   * Para SEMANAL/QUINCENAL: si cae en domingo, se mueve al sábado anterior.
   * Para MENSUAL: si cae en domingo, se mueve al lunes siguiente.
   */
  private saltarDomingo(fecha: Date, frecuencia: FrecuenciaPago): Date {
    // 0 = Domingo (en Bogotá)
    if (getBogotaWeekday(fecha) !== 0) return fecha;

    const key = getBogotaDayKey(fecha);
    if (!key) return fecha;

    const shiftDays = (days: number) => new Date(`${key}T12:00:00-05:00`).getTime() + days * 86_400_000;

    // Para diario/mensual: mover al lunes (siguiente día hábil)
    if (frecuencia === FrecuenciaPago.DIARIO || frecuencia === FrecuenciaPago.MENSUAL) {
      return new Date(shiftDays(1));
    }

    // Para semanal/quincenal: mover al sábado (día hábil anterior)
    return new Date(shiftDays(-1));
  }

  private calcularFechaVencimiento(
    fechaBase: Date,
    numeroCuota: number,
    frecuencia: FrecuenciaPago,
  ): Date {
    const baseKey = getBogotaDayKey(fechaBase);
    if (!baseKey) return fechaBase;

    const offset = Math.max(0, numeroCuota - 1);

    const toNoonBogota = (key: string) => new Date(`${key}T12:00:00-05:00`);

    const addDaysSkippingSunday = (startKey: string, daysToAdd: number): string => {
      let key = startKey;
      let added = 0;
      while (added < daysToAdd) {
        const next = new Date(toNoonBogota(key).getTime() + 86_400_000);
        const nextKey = getBogotaDayKey(next);
        if (!nextKey) break;
        key = nextKey;
        if (getBogotaWeekday(next) !== 0) added++;
      }
      return key;
    };

    const addDaysPlain = (startKey: string, daysToAdd: number): string => {
      const next = new Date(toNoonBogota(startKey).getTime() + daysToAdd * 86_400_000);
      return getBogotaDayKey(next);
    };

    const addMonths = (startKey: string, monthsToAdd: number): string => {
      const [yStr, mStr, dStr] = startKey.split('-');
      const y = Number(yStr);
      const m = Number(mStr);
      const d = Number(dStr);
      if (!y || !m || !d) return startKey;

      const totalMonths = (m - 1) + monthsToAdd;
      const newY = y + Math.floor(totalMonths / 12);
      const newM0 = ((totalMonths % 12) + 12) % 12;
      const newM = newM0 + 1;

      // Clamp del día al último del mes
      const firstNextMonth = newM === 12
        ? new Date(`${newY + 1}-01-01T12:00:00-05:00`)
        : new Date(`${newY}-${padStart2(newM + 1)}-01T12:00:00-05:00`);
      const lastDay = new Date(firstNextMonth.getTime() - 86_400_000);
      const lastKey = getBogotaDayKey(lastDay);
      const lastDayNum = Number(lastKey.split('-')[2] || '0');
      const safeDay = Math.min(d, lastDayNum || d);
      return `${newY}-${padStart2(newM)}-${padStart2(safeDay)}`;
    };

    const padStart2 = (n: number) => String(n).padStart(2, '0');

    let targetKey = baseKey;

    switch (frecuencia) {
      case FrecuenciaPago.DIARIO:
        targetKey = addDaysSkippingSunday(baseKey, offset);
        break;
      case FrecuenciaPago.SEMANAL:
        targetKey = addDaysPlain(baseKey, offset * 7);
        break;
      case FrecuenciaPago.QUINCENAL:
        targetKey = addDaysPlain(baseKey, offset * 15);
        break;
      case FrecuenciaPago.MENSUAL:
        targetKey = addMonths(baseKey, offset);
        break;
      default:
        targetKey = baseKey;
    }

    // devolver un instante al mediodía Bogotá; el consumidor compara por día con helpers Bogotá
    return this.saltarDomingo(toNoonBogota(targetKey), frecuencia);
  }

  private parseBogotaDayKey(dateStr: string): Date {
    const key = String(dateStr || '').includes('T') ? String(dateStr).split('T')[0] : String(dateStr);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return new Date();
    return new Date(`${key}T00:00:00-05:00`);
  }

  private calculateLoanEndDate(fechaInicio: Date, plazoMeses: number): Date {
    const startKey = getBogotaDayKey(fechaInicio);
    if (!startKey) return fechaInicio;

    const mesesEfectivos = Math.max(1, plazoMeses);
    const wholeMonths = Math.floor(mesesEfectivos);
    const decimales = mesesEfectivos - wholeMonths;

    // Reusar lógica mensual por key para evitar UTC
    const addMonthsKey = (key: string, monthsToAdd: number): string => {
      const [yStr, mStr, dStr] = key.split('-');
      const y = Number(yStr);
      const m = Number(mStr);
      const d = Number(dStr);
      if (!y || !m || !d) return key;
      const totalMonths = (m - 1) + monthsToAdd;
      const newY = y + Math.floor(totalMonths / 12);
      const newM0 = ((totalMonths % 12) + 12) % 12;
      const newM = newM0 + 1;
      const pad2 = (n: number) => String(n).padStart(2, '0');
      const firstNext = newM === 12
        ? new Date(`${newY + 1}-01-01T12:00:00-05:00`)
        : new Date(`${newY}-${pad2(newM + 1)}-01T12:00:00-05:00`);
      const lastDay = new Date(firstNext.getTime() - 86_400_000);
      const lastKey = getBogotaDayKey(lastDay);
      const lastDayNum = Number(lastKey.split('-')[2] || '0');
      const safeDay = Math.min(d, lastDayNum || d);
      return `${newY}-${pad2(newM)}-${pad2(safeDay)}`;
    };

    let endKey = addMonthsKey(startKey, wholeMonths);
    if (decimales > 0) {
      const base = new Date(`${endKey}T12:00:00-05:00`);
      const shifted = new Date(base.getTime() + Math.round(decimales * 30) * 86_400_000);
      endKey = getBogotaDayKey(shifted) || endKey;
    }

    return new Date(`${endKey}T00:00:00-05:00`);
  }

  private calculateInterestAndCuotas(
    tipoAmortizacion: TipoAmortizacion,
    monto: number,
    tasaInteres: number,
    cantidadCuotas: number,
    plazoMeses: number,
    frecuenciaPago: FrecuenciaPago,
    fechaInicio: Date,
    fechaPrimerCobro?: Date,
    esContado: boolean = false,
  ) {
    let interesTotal = 0;
    let cuotas: Array<{
      numeroCuota: number;
      fechaVencimiento: Date;
      monto: number;
      montoCapital: number;
      montoInteres: number;
      estado: EstadoCuota;
      montoPagado: number;
    }> = [];

    const fechaBase = fechaPrimerCobro || fechaInicio;

    if (tipoAmortizacion === TipoAmortizacion.FRANCESA) {
      const amortizacion = this.calcularAmortizacionFrancesa(
        monto,
        tasaInteres,
        cantidadCuotas,
        plazoMeses,
        frecuenciaPago,
      );
      interesTotal = amortizacion.interesTotal;
      cuotas = amortizacion.tabla.map((cuota) => ({
        numeroCuota: cuota.numeroCuota,
        fechaVencimiento: this.calcularFechaVencimiento(
          fechaBase,
          fechaPrimerCobro ? cuota.numeroCuota : cuota.numeroCuota + 1,
          frecuenciaPago,
        ),
        monto: cuota.monto,
        montoCapital: cuota.montoCapital,
        montoInteres: cuota.montoInteres,
        estado: esContado ? EstadoCuota.PAGADA : EstadoCuota.PENDIENTE,
        montoPagado: esContado ? cuota.monto : 0,
      }));
    } else {
      const mesesInteres = Math.max(1, plazoMeses);
      interesTotal = (monto * tasaInteres * mesesInteres) / 100;
      const montoTotalSimple = monto + interesTotal;
      const montoCuota =
        cantidadCuotas > 0 ? montoTotalSimple / cantidadCuotas : 0;
      const montoCapitalCuota =
        cantidadCuotas > 0 ? monto / cantidadCuotas : 0;
      const montoInteresCuota =
        cantidadCuotas > 0 ? interesTotal / cantidadCuotas : 0;

      cuotas = Array.from({ length: cantidadCuotas }, (_, i) => ({
        numeroCuota: i + 1,
        fechaVencimiento: this.calcularFechaVencimiento(
          fechaBase,
          fechaPrimerCobro ? i + 1 : i + 2,
          frecuenciaPago,
        ),
        monto: Math.round(montoCuota * 100) / 100,
        montoCapital: Math.round(montoCapitalCuota * 100) / 100,
        montoInteres: Math.round(montoInteresCuota * 100) / 100,
        estado: esContado ? EstadoCuota.PAGADA : EstadoCuota.PENDIENTE,
        montoPagado: esContado ? Math.round(montoCuota * 100) / 100 : 0,
      }));
    }

    return { interesTotal, cuotas };
  }

  async getAllLoans(filters: {
    estado?: string;
    ruta?: string;
    search?: string;
    tipo?: string;
    page?: number;
    limit?: number;
  }) {
    try {
      this.logger.log(`Getting loans with filters: ${JSON.stringify(filters)}`);

      const {
        estado = 'todos',
        ruta = 'todas',
        search = '',
        tipo = 'todos',
        page = 1,
        limit = 8,
      } = filters;

      const skip = (page - 1) * limit;

      // Construir filtros de forma segura
      const where: Prisma.PrestamoWhereInput = {
        eliminadoEn: null, // Solo préstamos no eliminados
      };

      // Filtro por tipo de préstamo
      if (tipo !== 'todos' && tipo !== '') {
        where.tipoPrestamo = tipo;
      }

      // Filtro por estado
      if (estado !== 'todos') {
        const estadosValidos = Object.values(EstadoPrestamo);
        if (estadosValidos.includes(estado as EstadoPrestamo)) {
          (where as Record<string, unknown>).estado = estado;
        } else {
          this.logger.warn(`Estado inválido recibido: ${estado}`);
        }
      }

      // Filtro por ruta (usando asignaciones de ruta)
      if (ruta !== 'todas' && ruta !== '') {
        where.cliente = {
          asignacionesRuta: {
            some: {
              rutaId: ruta,
              activa: true,
            },
          },
        };
      }

      // Filtro por búsqueda
      if (search && search.trim() !== '') {
        const searchTerm = search.trim();
        where.OR = [
          {
            numeroPrestamo: {
              contains: searchTerm,
              mode: 'insensitive' as any,
            },
          },
          {
            cliente: {
              OR: [
                {
                  nombres: {
                    contains: searchTerm,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
                {
                  apellidos: {
                    contains: searchTerm,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
                {
                  dni: {
                    contains: searchTerm,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
              ],
            },
          },
          {
            producto: {
              nombre: {
                contains: searchTerm,
                mode: Prisma.QueryMode.insensitive,
              },
            },
          },
        ];
      }

      this.logger.log(`Query where clause: ${JSON.stringify(where)}`);

      // Obtener préstamos con relaciones - CORREGIDO: cliente solo aparece una vez
      const [prestamos, total] = await Promise.all([
        this.prisma.prestamo.findMany({
          where,
          include: {
            cliente: {
              select: {
                id: true,
                nombres: true,
                apellidos: true,
                dni: true,
                telefono: true,
                nivelRiesgo: true,
                // Incluir asignaciones de ruta dentro del mismo select del cliente
                asignacionesRuta: {
                  where: { activa: true },
                  select: {
                    ruta: {
                      select: {
                        id: true,
                        nombre: true,
                        codigo: true,
                      },
                    },
                  },
                  take: 1,
                },
              },
            },
            producto: {
              select: {
                id: true,
                nombre: true,
                categoria: true,
              },
            },
            precioProducto: {
              select: {
                id: true,
                meses: true,
                precio: true,
              },
            },
            cuotas: {
              select: {
                id: true,
                numeroCuota: true,
                estado: true,
                fechaVencimiento: true,
                monto: true,
                montoPagado: true,
                montoInteresMora: true,
              },
            },
            creadoPor: {
              select: {
                id: true,
                nombres: true,
                apellidos: true,
                rol: true,
              },
            },
          },
          skip,
          take: limit,
          orderBy: { creadoEn: 'desc' },
        }),
        this.prisma.prestamo.count({ where }),
      ]);

      this.logger.log(`Found ${prestamos.length} loans, total: ${total}`);

      // Calcular estadísticas globales (sin filtros de eliminados)
      const whereStats = { eliminadoEn: null };

      const [
        totalPrestamos,
        activos,
        enMora,
        incumplidos,
        perdida,
        pagados,
        totales,
        moraTotal,
      ] = await Promise.all([
        this.prisma.prestamo.count({ where: whereStats }),
        this.prisma.prestamo.count({
          where: { ...whereStats, estado: EstadoPrestamo.ACTIVO },
        }),
        this.prisma.prestamo.count({
          where: { ...whereStats, estado: EstadoPrestamo.EN_MORA },
        }),
        this.prisma.prestamo.count({
          where: { ...whereStats, estado: EstadoPrestamo.INCUMPLIDO },
        }),
        this.prisma.prestamo.count({
          where: { ...whereStats, estado: EstadoPrestamo.PERDIDA },
        }),
        this.prisma.prestamo.count({
          where: { ...whereStats, estado: EstadoPrestamo.PAGADO },
        }),
        this.prisma.prestamo.aggregate({
          where: whereStats,
          _sum: {
            monto: true,
            saldoPendiente: true,
          },
        }),
        this.prisma.prestamo.aggregate({
          where: {
            ...whereStats,
            estado: EstadoPrestamo.EN_MORA,
          },
          _sum: {
            saldoPendiente: true,
          },
        }),
      ]);

      // Transformar datos para el frontend de forma segura
      const prestamosTransformados = prestamos.map((prestamo) => {
        try {
          // Calcular campos adicionales
          const cuotas = prestamo.cuotas || [];
          const cuotasPagadas = cuotas.filter(
            (c) => c.estado === EstadoCuota.PAGADA,
          ).length;
          const cuotasTotales = cuotas.length;
          const cuotasVencidas = cuotas.filter(
            (c) => c.estado === EstadoCuota.VENCIDA,
          ).length;

          // Manejar valores numéricos de forma segura
          const monto = Number(prestamo.monto) || 0;
          const interesTotal = Number(prestamo.interesTotal) || 0;
          const saldoPendiente = Number(prestamo.saldoPendiente) || 0;
          const totalPagado = Number(prestamo.totalPagado) || 0;

          const montoTotal = monto + interesTotal;
          const montoPendiente = saldoPendiente;
          const montoPagado = totalPagado;

          // Calcular mora acumulada de forma segura
          const moraAcumulada = cuotas.reduce((sum, cuota) => {
            if (cuota.estado === EstadoCuota.VENCIDA) {
              return sum + (Number(cuota.montoInteresMora) || 0);
            }
            return sum;
          }, 0);

          // Determinar tipo de producto
          let tipoProducto = 'efectivo';
          if (prestamo.producto) {
            const categoria = (prestamo.producto.categoria || '').toLowerCase();
            if (
              categoria.includes('electrodoméstico') ||
              categoria.includes('electro')
            ) {
              tipoProducto = 'electrodomestico';
            } else if (categoria.includes('mueble')) {
              tipoProducto = 'mueble';
            } else {
              tipoProducto = categoria;
            }
          }

          // Obtener ruta del cliente (si existe) - CORREGIDO
          let rutaAsignada = 'Sin asignar';
          let rutaNombre = 'Sin asignar';

          if (
            prestamo.cliente &&
            prestamo.cliente.asignacionesRuta &&
            prestamo.cliente.asignacionesRuta.length > 0
          ) {
            const asignacion = prestamo.cliente.asignacionesRuta[0];
            if (asignacion.ruta) {
              rutaAsignada = asignacion.ruta.codigo || asignacion.ruta.id;
              rutaNombre = asignacion.ruta.nombre || 'Ruta asignada';
            }
          }

          return {
            id: prestamo.id || '',
            numeroPrestamo: prestamo.numeroPrestamo || 'N/A',
            clienteId: prestamo.clienteId || '',
            cliente:
              `${prestamo.cliente?.nombres || ''} ${prestamo.cliente?.apellidos || ''}`.trim(),
            clienteDni: prestamo.cliente.dni || '',
            clienteTelefono: prestamo.cliente.telefono || '',
            producto: prestamo.producto?.nombre || 'Préstamo en efectivo',
            tipoProducto,
            tipoPrestamo: prestamo.tipoPrestamo,
            montoTotal,
            montoPendiente,
            montoPagado,
            cuotaInicial: Number(prestamo.cuotaInicial) || 0,
            valorCuota: cuotas.length > 0 ? Number(cuotas[0].monto) : 0,
            tasaInteres: Number(prestamo.tasaInteres) || 0,
            frecuenciaPago: prestamo.frecuenciaPago,
            moraAcumulada,
            cuotasPagadas,
            cuotasTotales,
            cuotasVencidas,
            estado: prestamo.estado || EstadoPrestamo.BORRADOR,
            riesgo: prestamo.cliente.nivelRiesgo || NivelRiesgo.VERDE,
            ruta: rutaAsignada,
            rutaNombre,
            vendedor: prestamo.creadoPor?.nombres || 'Sin asignar',
            vendedorRol: (prestamo.creadoPor as any)?.rol || '',
            creadoPorRol: (prestamo.creadoPor as any)?.rol || '',
            fechaInicio: prestamo.fechaInicio || new Date(),
            fechaFin: prestamo.fechaFin || new Date(),
            creadoEn: prestamo.creadoEn || new Date(),
            progreso:
              cuotasTotales > 0 ? (cuotasPagadas / cuotasTotales) * 100 : 0,
          };
        } catch (error) {
          this.logger.error(`Error transforming loan ${prestamo.id}:`, error);
          // Devolver un objeto seguro en caso de error
          return {
            id: prestamo.id || 'error',
            numeroPrestamo: prestamo.numeroPrestamo || 'ERROR',
            clienteId: '',
            cliente: 'Error al cargar',
            clienteDni: '',
            clienteTelefono: '',
            producto: 'Error',
            tipoProducto: 'efectivo',
            montoTotal: 0,
            montoPendiente: 0,
            montoPagado: 0,
            moraAcumulada: 0,
            cuotasPagadas: 0,
            cuotasTotales: 0,
            cuotasVencidas: 0,
            estado: EstadoPrestamo.BORRADOR,
            riesgo: NivelRiesgo.VERDE,
            ruta: 'Error',
            rutaNombre: 'Error',
            fechaInicio: new Date(),
            fechaFin: new Date(),
            progreso: 0,
          };
        }
      });

      return {
        prestamos: prestamosTransformados,
        estadisticas: {
          total: totalPrestamos || 0,
          activos: activos || 0,
          atrasados: enMora || 0,
          morosos: (incumplidos || 0) + (perdida || 0),
          pagados: pagados || 0,
          cancelados: perdida || 0,
          montoTotal: Number(totales._sum?.monto || 0),
          montoPendiente: Number(totales._sum?.saldoPendiente || 0),
          moraTotal: Number(moraTotal._sum?.saldoPendiente || 0),
        },
        paginacion: {
          total: total || 0,
          pagina: page,
          limite: limit,
          totalPaginas: Math.ceil((total || 0) / limit),
        },
      };
    } catch (error) {
      this.logger.error('Error in getAllLoans:', error);
      // Devolver respuesta segura en caso de error
      return {
        prestamos: [],
        estadisticas: {
          total: 0,
          activos: 0,
          atrasados: 0,
          morosos: 0,
          pagados: 0,
          cancelados: 0,
          montoTotal: 0,
          montoPendiente: 0,
          moraTotal: 0,
        },
        paginacion: {
          total: 0,
          pagina: filters.page || 1,
          limite: filters.limit || 8,
          totalPaginas: 0,
        },
      };
    }
  }

  async getLoanById(id: string) {
    try {
      const prestamo = await this.prisma.prestamo.findUnique({
        where: {
          id,
          eliminadoEn: null, // Solo si no está eliminado
        },
        include: {
          archivos: {
            where: { estado: 'ACTIVO' },
          },
          cliente: {
            include: {
              archivos: true,
              asignacionesRuta: {
                where: { activa: true },
                include: {
                  ruta: true,
                },
              },
            },
          },
          producto: true,
          precioProducto: true,
          cuotas: {
            orderBy: { numeroCuota: 'asc' },
          },
          pagos: {
            include: {
              detalles: true,
              archivos: {
                where: { estado: 'ACTIVO' },
              },
            },
            orderBy: { fechaPago: 'desc' },
          },
          extensiones: {
            orderBy: { creadoEn: 'desc' },
          },
          creadoPor: {
            select: {
              id: true,
              nombres: true,
              apellidos: true,
              rol: true,
            },
          },
          aprobadoPor: {
            select: {
              id: true,
              nombres: true,
              apellidos: true,
              rol: true,
            },
          },
        },
      });

      if (!prestamo) {
        throw new NotFoundException('Préstamo no encontrado');
      }

      return prestamo;
    } catch (error) {
      this.logger.error(`Error getting loan ${id}:`, error);
      throw error;
    }
  }

  async getLoanByIdIncludingArchived(id: string) {
    try {
      const prestamo = await this.prisma.prestamo.findUnique({
        where: {
          id,
        },
        include: {
          archivos: {
            where: { estado: 'ACTIVO' },
          },
          cliente: {
            include: {
              archivos: true,
              asignacionesRuta: {
                where: { activa: true },
                include: {
                  ruta: true,
                },
              },
            },
          },
          producto: true,
          precioProducto: true,
          cuotas: {
            orderBy: { numeroCuota: 'asc' },
          },
          pagos: {
            include: {
              detalles: true,
              archivos: {
                where: { estado: 'ACTIVO' },
              },
            },
            orderBy: { fechaPago: 'desc' },
          },
          extensiones: {
            orderBy: { creadoEn: 'desc' },
          },
          creadoPor: {
            select: {
              id: true,
              nombres: true,
              apellidos: true,
              rol: true,
            },
          },
          aprobadoPor: {
            select: {
              id: true,
              nombres: true,
              apellidos: true,
              rol: true,
            },
          },
        },
      });

      if (!prestamo) {
        throw new NotFoundException('Préstamo no encontrado');
      }

      return prestamo;
    } catch (error) {
      this.logger.error(`Error getting archived loan ${id}:`, error);
      throw error;
    }
  }

  async deleteLoan(id: string, userId: string) {
    try {
      // Verificar si el préstamo existe
      const prestamo = await this.prisma.prestamo.findUnique({
        where: {
          id,
          eliminadoEn: null, // Solo si no está eliminado
        },
      });

      if (!prestamo) {
        throw new NotFoundException('Préstamo no encontrado');
      }

      // Actualizar estado en lugar de eliminar físicamente
      const prestamoEliminado = await this.prisma.prestamo.update({
        where: { id },
        data: {
          estado: EstadoPrestamo.PERDIDA,
          eliminadoEn: new Date(),
          estadoSincronizacion: 'PENDIENTE',
        },
      });

      // Eliminar o anular aprobaciones pendientes para este préstamo
      // Esto asegura que desaparezca del módulo de revisiones
      await this.prisma.aprobacion.updateMany({
        where: {
          referenciaId: id,
          estado: EstadoAprobacion.PENDIENTE,
        },
        data: {
          estado: EstadoAprobacion.RECHAZADO,
          comentarios: 'Crédito archivado antes de aprobación',
          revisadoEn: new Date(),
        },
      });

      // Auditoría
      await this.auditService.create({
        usuarioId: userId,
        accion: 'ELIMINAR_PRESTAMO',
        entidad: 'Prestamo',
        entidadId: prestamo.id,
        datosAnteriores: { 
          eliminadoEn: null, 
          estado: prestamo.estado,
          numeroPrestamo: prestamo.numeroPrestamo
        },
        datosNuevos: {
          eliminadoEn: prestamoEliminado.eliminadoEn,
          estado: prestamoEliminado.estado,
        },
      });

      return prestamoEliminado;
    } catch (error) {
      this.logger.error(`Error deleting loan ${id}:`, error);
      throw error;
    }
  }

  async updateLoan(id: string, updateData: UpdateLoanData, userId: string) {
    try {
      const prestamo = await this.prisma.prestamo.findUnique({
        where: { id, eliminadoEn: null },
      });

      if (!prestamo) {
        throw new NotFoundException('Préstamo no encontrado');
      }

      const datosAnteriores = {
        monto: prestamo.monto,
        tasaInteres: prestamo.tasaInteres,
        plazoMeses: prestamo.plazoMeses,
        frecuenciaPago: prestamo.frecuenciaPago,
        estado: prestamo.estado,
      };

      const archivos = updateData?.archivos;

      // Build update payload - only allow safe fields
      // Record tipado con los campos permitidos del schema
      const data: Record<string, unknown> = { estadoSincronizacion: 'PENDIENTE' };

      if (updateData.monto !== undefined) data.monto = updateData.monto;
      if (updateData.tasaInteres !== undefined) data.tasaInteres = updateData.tasaInteres;
      if (updateData.plazoMeses !== undefined) data.plazoMeses = updateData.plazoMeses;
      if (updateData.cantidadCuotas !== undefined) data.cantidadCuotas = updateData.cantidadCuotas;
      if (updateData.frecuenciaPago !== undefined) data.frecuenciaPago = updateData.frecuenciaPago;
      if (updateData.estado !== undefined) {
        const estadosValidos = Object.values(EstadoPrestamo);
        if (estadosValidos.includes(updateData.estado as EstadoPrestamo)) {
          data.estado = updateData.estado;
        }
      }
      if (updateData.notas !== undefined) data.notas = updateData.notas;
      if (updateData.garantia !== undefined) data.garantia = updateData.garantia;
      if (updateData.tasaInteresMora !== undefined) data.tasaInteresMora = updateData.tasaInteresMora;
      if (updateData.cuotaInicial !== undefined) data.cuotaInicial = updateData.cuotaInicial;
      if (updateData.tipoAmortizacion !== undefined) data.tipoAmortizacion = updateData.tipoAmortizacion;
      if (updateData.fechaInicio !== undefined) data.fechaInicio = new Date(updateData.fechaInicio);
      
      const newMonto = data.monto === undefined ? Number(prestamo.monto) : Number(data.monto);
      const newTasa = data.tasaInteres === undefined ? Number(prestamo.tasaInteres) : Number(data.tasaInteres);
      const newPlazo = data.plazoMeses === undefined ? Number(prestamo.plazoMeses) : Number(data.plazoMeses);
      const newFechaInicio = data.fechaInicio === undefined ? prestamo.fechaInicio : (data.fechaInicio as Date);
      const newInteresTotal = (newMonto * newTasa * newPlazo) / 100;

      const shouldRecalculateFinancing =
        data.monto !== undefined ||
        data.tasaInteres !== undefined ||
        data.plazoMeses !== undefined ||
        data.fechaInicio !== undefined;

      if (shouldRecalculateFinancing) {
        data.interesTotal = newInteresTotal;
        data.saldoPendiente = (newMonto + newInteresTotal) - Number(prestamo.totalPagado || 0);
      }

      // Regenerate cuotas if cantidadCuotas, monto, tasaInteres, frecuenciaPago or tipoAmortizacion changed
      const shouldRegenerateCuotas = (
        data.cantidadCuotas !== undefined || 
        data.monto !== undefined || 
        data.tasaInteres !== undefined || 
        data.frecuenciaPago !== undefined ||
        data.tipoAmortizacion !== undefined
      );

      if (shouldRegenerateCuotas) {
        const cantidadCuotas = data.cantidadCuotas !== undefined
          ? Number(data.cantidadCuotas)
          : (prestamo.cantidadCuotas ?? 0);
        const frecuenciaPago = (data.frecuenciaPago !== undefined
          ? data.frecuenciaPago
          : prestamo.frecuenciaPago) as FrecuenciaPago;
        const tipoAmortizacion = (data.tipoAmortizacion !== undefined
          ? data.tipoAmortizacion
          : (prestamo.tipoAmortizacion || TipoAmortizacion.INTERES_SIMPLE)) as TipoAmortizacion;

        // Delete existing cuotas
        await this.prisma.cuota.deleteMany({
          where: { prestamoId: id }
        });

        // Generate new cuotas using helper
        const { cuotas: planCuotas } = this.calculateInterestAndCuotas(
          tipoAmortizacion,
          newMonto,
          newTasa,
          cantidadCuotas,
          newPlazo,
          frecuenciaPago,
          newFechaInicio,
          (prestamo as any).fechaPrimerCobro,
          false // esContado
        );

        // Homogeneizar vencimiento del préstamo con el cronograma real
        if (planCuotas.length > 0) {
          data.fechaFin = new Date(planCuotas[planCuotas.length - 1].fechaVencimiento);
        }

        const cuotasData = planCuotas.map(c => ({
          numeroCuota: c.numeroCuota,
          fechaVencimiento: c.fechaVencimiento,
          monto: c.monto,
          montoCapital: c.montoCapital,
          montoInteres: c.montoInteres,
          estado: c.estado,
          montoPagado: c.montoPagado,
          prestamoId: id
        }));

        // Create new cuotas
        await this.prisma.cuota.createMany({
          data: cuotasData
        });

        data.cantidadCuotas = cantidadCuotas;
      }

      const prestamoActualizado = await this.prisma.prestamo.update({
        where: { id },
        data,
        include: {
          cliente: true,
          producto: true,
          cuotas: true,
        },
      });

      // Actualizar archivos del préstamo si vienen en el payload
      if (archivos !== undefined) {
        this.logger.log(`[DEBUG] Actualizando archivos para préstamo ${id}. Archivos recibidos: ${Array.isArray(archivos) ? archivos.length : 'N/A'}`);

        const activos = await this.prisma.multimedia.findMany({
          where: {
            prestamoId: id,
            estado: 'ACTIVO',
          },
          select: { id: true },
        });

        if (activos.length > 0) {
          await this.prisma.multimedia.updateMany({
            where: { id: { in: activos.map((a) => a.id) } },
            data: {
              estado: 'ELIMINADO' as const,
              eliminadoEn: new Date(),
            },
          });
        }

        if (Array.isArray(archivos) && archivos.length > 0) {
          const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

          const nuevosArchivos = archivos.map((archivo: any) => {
            const url = archivo.url || archivo.path || archivo.ruta;
            const urlFinal = typeof url === 'string' && url.startsWith('http') ? url : undefined;

            const rutaValue = String(archivo.ruta || archivo.path || archivo.nombreAlmacenamiento || '').trim();
            const tipoArchivoValue = String(archivo.tipoArchivo || '').toLowerCase();
            const isVideo = tipoArchivoValue.startsWith('video/');

            const urlDerivada = (!urlFinal && cloudName && rutaValue)
              ? `https://res.cloudinary.com/${cloudName}/${isVideo ? 'video' : 'image'}/upload/${rutaValue}`
              : undefined;

            return {
              prestamoId: id,
              tipoContenido: archivo.tipoContenido,
              tipoArchivo: archivo.tipoArchivo,
              formato: archivo.formato || archivo.tipoArchivo?.split('/')[1] || 'jpg',
              nombreOriginal: archivo.nombreOriginal,
              nombreAlmacenamiento: archivo.nombreAlmacenamiento || archivo.nombreOriginal,
              ruta: archivo.ruta || archivo.path,
              url: urlFinal || urlDerivada,
              tamanoBytes: archivo.tamanoBytes || 0,
              subidoPorId: archivo.subidoPorId || userId || prestamoActualizado.creadoPorId,
              estado: 'ACTIVO' as const,
            };
          });

          await this.prisma.multimedia.createMany({
            data: nuevosArchivos,
          });
        }
      }

      try {
        const estadoAnterior = prestamo.estado;
        const estadoNuevo = prestamoActualizado.estado;
        const cambioEstado = data.estado !== undefined && estadoAnterior !== estadoNuevo;
        if (cambioEstado) {
          const clienteNombre = `${prestamoActualizado.cliente?.nombres || ''} ${prestamoActualizado.cliente?.apellidos || ''}`.trim();
          const tituloBase = `Crédito ${prestamoActualizado.numeroPrestamo || ''} actualizado`;
          const msgBase = `El crédito ${prestamoActualizado.numeroPrestamo || ''} del cliente ${clienteNombre || ''} cambió de ${estadoAnterior} a ${estadoNuevo}.`;
          
          let actorNombre = '';
          try {
            const usuario = await this.prisma.usuario.findUnique({
              where: { id: userId },
              select: { nombres: true, apellidos: true },
            });
            if (usuario) {
              actorNombre = `${usuario.nombres || ''} ${usuario.apellidos || ''}`.trim();
            }
          } catch {}

          const metadataBase = {
            estadoAnterior,
            estadoNuevo,
            solicitadoPor: actorNombre || undefined,
            solicitadoPorId: userId,
            cliente: clienteNombre || undefined,
            numeroPrestamo: prestamoActualizado.numeroPrestamo || undefined,
          };
          
          await this.notificacionesService.create({
            usuarioId: userId,
            titulo: tituloBase,
            mensaje: msgBase,
            tipo: 'PRESTAMO',
            entidad: 'Prestamo',
            entidadId: prestamoActualizado.id,
            metadata: metadataBase,
          });
          
          if (estadoNuevo === EstadoPrestamo.PENDIENTE_APROBACION) {
            await this.notificacionesService.notifyApprovers({
              titulo: `Crédito marcado como PENDIENTE`,
              mensaje: msgBase,
              tipo: 'PRESTAMO',
              entidad: 'Prestamo',
              entidadId: prestamoActualizado.id,
              metadata: metadataBase,
            });
          }
          
          if (estadoNuevo === EstadoPrestamo.ACTIVO) {
            if (prestamo.creadoPorId && prestamo.creadoPorId !== userId) {
              await this.notificacionesService.create({
                usuarioId: prestamo.creadoPorId,
                titulo: `Crédito activado`,
                mensaje: msgBase,
                tipo: 'PRESTAMO',
                entidad: 'Prestamo',
                entidadId: prestamoActualizado.id,
                metadata: metadataBase,
              });
            }
          }
        }
      } catch (e) {
        this.logger.error('Error enviando notificaciones de cambio de estado:', e);
      }

      // Auditoría
      await this.auditService.create({
        usuarioId: userId,
        accion: 'ACTUALIZAR_PRESTAMO',
        entidad: 'Prestamo',
        entidadId: prestamo.id,
        datosAnteriores,
        datosNuevos: data,
      });

      this.logger.log(`Loan ${id} updated by user ${userId}`);
      return prestamoActualizado;
    } catch (error) {
      this.logger.error(`Error updating loan ${id}:`, error);
      throw error;
    }
  }

  async restoreLoan(id: string, userId: string) {
    try {
      const prestamo = await this.prisma.prestamo.findUnique({
        where: { id },
      });

      if (!prestamo) {
        throw new NotFoundException('Préstamo no encontrado');
      }

      if (!prestamo.eliminadoEn) {
        throw new Error('El préstamo no está eliminado');
      }

      const prestamoRestaurado = await this.prisma.prestamo.update({
        where: { id },
        data: {
          estado: EstadoPrestamo.ACTIVO,
          eliminadoEn: null,
          estadoSincronizacion: 'PENDIENTE',
        },
      });

      // Auditoría
      await this.auditService.create({
        usuarioId: userId,
        accion: 'RESTAURAR_PRESTAMO',
        entidad: 'Prestamo',
        entidadId: prestamo.id,
        datosAnteriores: { eliminadoEn: prestamo.eliminadoEn },
        datosNuevos: { eliminadoEn: null },
      });

      return prestamoRestaurado;
    } catch (error) {
      this.logger.error(`Error restoring loan ${id}:`, error);
      throw error;
    }
  }

  async createLoan_(createLoanDto: CreateLoanDto) {
    try {
      this.logger.log(`Creating loan for client ${createLoanDto.clienteId}`);

      // Verificar que el cliente existe
      const cliente = await this.prisma.cliente.findUnique({
        where: { id: createLoanDto.clienteId },
      });

      if (!cliente) {
        throw new NotFoundException('Cliente no encontrado');
      }

      // Generar numero de prestamo
      const count = await this.prisma.prestamo.count();
      const numeroPrestamo = `PRES-${String(count + 1).padStart(6, '0')}`;

      // Calcular fecha fin
      const fechaInicio = new Date(createLoanDto.fechaInicio);
      const fechaInicioKey = getBogotaDayKey(fechaInicio);
      const { startDate: fechaInicioBogota } = getBogotaStartEndOfDayFromKey(fechaInicioKey);
      fechaInicio.setTime(fechaInicioBogota.getTime());
      const fechaFin = new Date(fechaInicio);
      fechaFin.setMonth(fechaFin.getMonth() + createLoanDto.plazoMeses);

      const fechaPrimerCobroParsed = createLoanDto.fechaPrimerCobro
        ? new Date(createLoanDto.fechaPrimerCobro)
        : undefined;
      if (fechaPrimerCobroParsed) {
        const key = getBogotaDayKey(fechaPrimerCobroParsed);
        const { startDate } = getBogotaStartEndOfDayFromKey(key);
        fechaPrimerCobroParsed.setTime(startDate.getTime());
      }

      // Calcular cantidad de cuotas segun frecuencia
      let cantidadCuotas = 0;
      switch (createLoanDto.frecuenciaPago) {
        case FrecuenciaPago.DIARIO:
          cantidadCuotas = createLoanDto.plazoMeses * 30;
          break;
        case FrecuenciaPago.SEMANAL:
          cantidadCuotas = createLoanDto.plazoMeses * 4;
          break;
        case FrecuenciaPago.QUINCENAL:
          cantidadCuotas = createLoanDto.plazoMeses * 2;
          break;
        case FrecuenciaPago.MENSUAL:
          cantidadCuotas = createLoanDto.plazoMeses;
          break;
      }

      // Determinar tipo de amortización
      const tipoAmort = createLoanDto.tipoAmortizacion || TipoAmortizacion.INTERES_SIMPLE;
      const tasaInteres = createLoanDto.tasaInteres || 0;

      let interesTotal: number;
      let cuotasData: Array<{
        numeroCuota: number;
        fechaVencimiento: Date;
        monto: number;
        montoCapital: number;
        montoInteres: number;
        estado: typeof EstadoCuota.PENDIENTE;
      }>;

      if (tipoAmort === TipoAmortizacion.FRANCESA) {
        // Amortización francesa (cuota fija, interés decreciente)
        const amortizacion = this.calcularAmortizacionFrancesa(
          createLoanDto.monto,
          tasaInteres,
          cantidadCuotas,
          createLoanDto.plazoMeses,
          createLoanDto.frecuenciaPago,
        );
        interesTotal = amortizacion.interesTotal;
        cuotasData = amortizacion.tabla.map((cuota) => {
          const fechaBase = createLoanDto.fechaPrimerCobro ? new Date(createLoanDto.fechaPrimerCobro) : fechaInicio;
          const fechaVencimiento = this.calcularFechaVencimiento(fechaBase, cuota.numeroCuota, createLoanDto.frecuenciaPago);
          return {
            numeroCuota: cuota.numeroCuota,
            fechaVencimiento,
            monto: cuota.monto,
            montoCapital: cuota.montoCapital,
            montoInteres: cuota.montoInteres,
            estado: EstadoCuota.PENDIENTE,
          };
        });
      } else {
        // Interés simple (flat): capital × tasa mensual × plazoMeses (simple)
        interesTotal = (createLoanDto.monto * tasaInteres * createLoanDto.plazoMeses) / 100;
        const montoTotal = createLoanDto.monto + interesTotal;
        const montoCuota = cantidadCuotas > 0 ? montoTotal / cantidadCuotas : 0;
        const montoCapitalCuota = cantidadCuotas > 0 ? createLoanDto.monto / cantidadCuotas : 0;
        const montoInteresCuota = cantidadCuotas > 0 ? interesTotal / cantidadCuotas : 0;
        cuotasData = Array.from({ length: cantidadCuotas }, (_, i) => {
          const fechaBase = createLoanDto.fechaPrimerCobro ? new Date(createLoanDto.fechaPrimerCobro) : fechaInicio;
          const fechaVencimiento = this.calcularFechaVencimiento(fechaBase, i + 1, createLoanDto.frecuenciaPago);
          return {
            numeroCuota: i + 1,
            fechaVencimiento,
            monto: Math.round(montoCuota * 100) / 100,
            montoCapital: Math.round(montoCapitalCuota * 100) / 100,
            montoInteres: Math.round(montoInteresCuota * 100) / 100,
            estado: EstadoCuota.PENDIENTE,
          };
        });
      }

      // Homogeneizar vencimiento del préstamo con el cronograma real
      const fechaFinReal = cuotasData.length > 0
        ? new Date(cuotasData[cuotasData.length - 1].fechaVencimiento)
        : fechaFin;

      // Crear prestamo con cuotas
      const prestamo = await this.prisma.prestamo.create({
        data: {
          numeroPrestamo,
          clienteId: createLoanDto.clienteId,
          productoId: createLoanDto.productoId,
          precioProductoId: createLoanDto.precioProductoId,
          tipoPrestamo: createLoanDto.tipoPrestamo,
          tipoAmortizacion: tipoAmort,
          monto: createLoanDto.monto,
          cuotaInicial: createLoanDto.cuotaInicial || 0,
          tasaInteres: tasaInteres,
          tasaInteresMora: createLoanDto.tasaInteresMora || 2,
          plazoMeses: createLoanDto.plazoMeses,
          frecuenciaPago: createLoanDto.frecuenciaPago,
          cantidadCuotas,
          fechaInicio,
          fechaPrimerCobro: fechaPrimerCobroParsed,
          fechaFin: fechaFinReal,
          estado: EstadoPrestamo.PENDIENTE_APROBACION,
          estadoAprobacion: EstadoAprobacion.PENDIENTE,
          creadoPorId: createLoanDto.creadoPorId,
          interesTotal,
          saldoPendiente: createLoanDto.monto + interesTotal - (createLoanDto.cuotaInicial || 0),
          notas: createLoanDto.notas ? String(createLoanDto.notas) : undefined,
          garantia: createLoanDto.garantia ? String(createLoanDto.garantia) : undefined,
          cuotas: {
            create: cuotasData,
          },
        } as any,
        include: {
          cliente: true,
          producto: true,
          cuotas: true,
          creadoPor: {
            select: {
              id: true,
              nombres: true,
              apellidos: true,
              rol: true,
            },
          },
        },
      });

      // Registrar CUOTA INICIAL como abono a capital (no utilidad) cuando es crédito por ARTICULO.
      // Se registra como transacción de INGRESO y se excluye de ganancia neta en el resumen financiero.
      try {
        const isArticulo = String(createLoanDto.tipoPrestamo || '').toUpperCase() === 'ARTICULO';
        const cuotaInicial = Number(createLoanDto.cuotaInicial || 0);
        if (isArticulo && cuotaInicial > 0) {
          // Determinar caja destino: preferimos caja de la ruta del cliente; si no existe, Caja Principal.
          const rutaCliente = await this.prisma.asignacionRuta.findFirst({
            where: {
              clienteId: createLoanDto.clienteId,
              activa: true,
              ruta: { activa: true, eliminadoEn: null },
            },
            select: { rutaId: true },
          });

          const cajaRuta = rutaCliente?.rutaId
            ? await this.prisma.caja.findFirst({
                where: { rutaId: rutaCliente.rutaId, tipo: 'RUTA', activa: true },
                select: { id: true },
              })
            : null;

          const cajaOficina = await this.prisma.caja.findFirst({
            where: {
              activa: true,
              codigo: 'CAJA-OFICINA',
            },
            select: { id: true },
          });

          const cajaPrincipal = await this.prisma.caja.findFirst({
            where: {
              activa: true,
              OR: [{ codigo: 'CAJA-PRINCIPAL' }, { tipo: 'PRINCIPAL' }],
            },
            orderBy: [{ codigo: 'asc' as any }],
            select: { id: true },
          });

          // Determinar caja destino: Cuota Inicial debe registrarse en Caja Oficina.
          // Si no existe, usar Caja Principal; si no existe, la caja de ruta.
          const cajaIdDestino = cajaOficina?.id || cajaPrincipal?.id || cajaRuta?.id;

          if (cajaIdDestino) {
            const yaExiste = await this.prisma.transaccion.findFirst({
              where: {
                cajaId: cajaIdDestino,
                tipo: 'INGRESO',
                tipoReferencia: 'CUOTA_INICIAL',
                referenciaId: prestamo.id,
              },
              select: { id: true },
            });

            if (!yaExiste?.id) {
              const countTrx = await this.prisma.transaccion.count();
              const numeroTransaccion = `TRX-${Date.now().toString().slice(-8)}-${(countTrx + 1).toString().padStart(4, '0')}`;
              await this.prisma.$transaction([
                this.prisma.transaccion.create({
                  data: {
                    numeroTransaccion,
                    cajaId: cajaIdDestino,
                    tipo: 'INGRESO',
                    monto: cuotaInicial,
                    descripcion: `Cuota inicial crédito artículo #${prestamo.numeroPrestamo}`,
                    creadoPorId: createLoanDto.creadoPorId,
                    tipoReferencia: 'CUOTA_INICIAL',
                    referenciaId: prestamo.id,
                  },
                }),
                this.prisma.caja.update({
                  where: { id: cajaIdDestino },
                  data: { saldoActual: { increment: cuotaInicial } },
                }),
              ]);
            }
          }
        }
      } catch (e) {
        // No bloqueamos la creación del préstamo por un fallo contable accesorio.
        this.logger.error('Error registrando cuota inicial como transacción:', e);
      }

      this.logger.log(`Loan created successfully: ${prestamo.id} (${tipoAmort})`);

      // Crear solicitud de aprobación automáticamente
      const aprobacion = await this.prisma.aprobacion.create({
        // ... (rest of the code remains the same)
        data: {
          tipoAprobacion: TipoAprobacion.NUEVO_PRESTAMO,
          referenciaId: prestamo.id,
          tablaReferencia: 'Prestamo',
          solicitadoPorId: createLoanDto.creadoPorId,
          datosSolicitud: {
            prestamoId: prestamo.id,
            clienteId: prestamo.clienteId,
            monto: prestamo.monto,
            tipoPrestamo: prestamo.tipoPrestamo,
            saldoPendiente: prestamo.saldoPendiente,
            valorArticulo: prestamo.saldoPendiente + prestamo.cuotaInicial,
            cuotaInicial: prestamo.cuotaInicial,
            plazoMeses: prestamo.plazoMeses,
            tasaInteres: prestamo.tasaInteres,
            frecuenciaPago: prestamo.frecuenciaPago,
            fechaInicio: prestamo.fechaInicio,
            fechaFin: prestamo.fechaFin,
          },
          montoSolicitud: Number(prestamo.monto),
        },
      });

      /*
      // Notificar a coordinadores, admins y superadmins sobre nuevo préstamo pendiente de aprobación
      await this.notificacionesService.notifyApprovers({
        titulo: 'Nuevo Préstamo Requiere Aprobación',
        mensaje: `El usuario ha creado un préstamo para el cliente ${cliente.nombres} ${cliente.apellidos} por valor de ${createLoanDto.monto}`,
        tipo: 'APROBACION',
        entidad: 'Aprobacion',
        entidadId: aprobacion.id,
        metadata: {
           // ...
        },
      });
      */

      // Registrar Auditoría
      await this.auditService.create({
        usuarioId: createLoanDto.creadoPorId,
        accion: 'CREAR_PRESTAMO',
        entidad: 'Prestamo',
        entidadId: prestamo.id,
        datosNuevos: prestamo,
        metadata: { clienteId: createLoanDto.clienteId },
      });

      this.notificacionesGateway.broadcastPrestamosActualizados({
        accion: 'CREAR',
        prestamoId: prestamo.id,
      });
      this.notificacionesGateway.broadcastDashboardsActualizados({});

      return prestamo;
    } catch (error) {
      this.logger.error('Error creating loan:', error);
      throw error;
    }
  }

  async approveLoan(id: string, aprobadoPorId: string) {
    try {
      const prestamo = await this.prisma.prestamo.findUnique({
        where: { id },
      });

      if (!prestamo) {
        throw new NotFoundException('Préstamo no encontrado');
      }

      if (prestamo.estado !== EstadoPrestamo.PENDIENTE_APROBACION) {
        throw new Error(
          'El préstamo no está en estado pendiente de aprobación',
        );
      }

      const { startDate: aprobacionInicio } = getBogotaStartEndOfDay(new Date());

      const prestamoConCuotas = await this.prisma.prestamo.findUnique({
        where: { id },
        include: { cuotas: { orderBy: { numeroCuota: 'asc' } } },
      });

      // Si la fechaInicio del préstamo está en el pasado (fue creado ayer o antes),
      // reagendamos todas las cuotas PENDIENTES desde la fecha de aprobación (hoy).
      // Así el cliente no aparece en mora por el tiempo que pasó en aprobación.
      const fechaInicioOriginal = prestamoConCuotas?.fechaInicio
        ? new Date(prestamoConCuotas.fechaInicio)
        : null;
      const inicioOriginalKey = fechaInicioOriginal ? getBogotaDayKey(fechaInicioOriginal) : null;
      const aprobacionKey = getBogotaDayKey(aprobacionInicio);

      if (inicioOriginalKey && inicioOriginalKey < aprobacionKey && prestamoConCuotas?.cuotas?.length) {
        // Reagendar: calcular nuevo cronograma desde hoy
        const cuotasPendientes = prestamoConCuotas.cuotas.filter(
          (c) => c.estado === EstadoCuota.PENDIENTE || c.estado === EstadoCuota.VENCIDA
        );

        if (cuotasPendientes.length > 0) {
          const nuevaFechaBase = new Date(aprobacionInicio);

          const frecuencia = prestamoConCuotas.frecuenciaPago;

          for (let i = 0; i < cuotasPendientes.length; i++) {
            const nuevaFechaVenc = this.calcularFechaVencimiento(nuevaFechaBase, i + 1, frecuencia);
            await this.prisma.cuota.update({
              where: { id: cuotasPendientes[i].id },
              data: {
                fechaVencimiento: nuevaFechaVenc,
                estado: EstadoCuota.PENDIENTE,
              },
            });
          }

          // Actualizar fechaInicio y fechaFin del préstamo
          const nuevaFechaFin = this.calcularFechaVencimiento(
            nuevaFechaBase,
            cuotasPendientes.length,
            frecuencia,
          );
          await this.prisma.prestamo.update({
            where: { id },
            data: {
              fechaInicio: nuevaFechaBase,
              fechaFin: nuevaFechaFin,
            },
          });
        }
      }

      const prestamoActualizado = await this.prisma.prestamo.update({
        where: { id },
        data: {
          estado: EstadoPrestamo.ACTIVO,
          estadoAprobacion: EstadoAprobacion.APROBADO,
          aprobadoPorId,
          estadoSincronizacion: 'PENDIENTE',
        },
        include: {
          cliente: true,
          producto: true,
          cuotas: true,
        },
      });

      // Actualizar la aprobación
      await this.prisma.aprobacion.updateMany({
        where: {
          referenciaId: id,
          tipoAprobacion: TipoAprobacion.NUEVO_PRESTAMO,
          estado: EstadoAprobacion.PENDIENTE,
        },
        data: {
          estado: EstadoAprobacion.APROBADO,
          aprobadoPorId,
          revisadoEn: new Date(),
        },
      });

      // Notificar al Coordinador (INFO)
      await this.notificacionesService.notifyCoordinator({
        titulo: 'Préstamo Aprobado',
        mensaje: `El préstamo ${prestamo.numeroPrestamo} ha sido aprobado y activado.`,
        tipo: 'EXITO',
        entidad: 'PRESTAMO',
        entidadId: prestamo.id,
        metadata: { aprobadoPor: aprobadoPorId },
      });

      // Notificar a ADMIN y SUPER_ADMINISTRADOR
      const admins = await this.prisma.usuario.findMany({
        where: { 
          rol: { in: [RolUsuario.ADMIN, RolUsuario.SUPER_ADMINISTRADOR] },
          estado: 'ACTIVO' 
        },
      });

      const cliente = await this.prisma.cliente.findUnique({
        where: { id: prestamo.clienteId },
      });

      for (const admin of admins) {
        await this.notificacionesService.create({
          usuarioId: admin.id,
          titulo: 'Préstamo Aprobado',
          mensaje: `El préstamo ${prestamo.numeroPrestamo} para el cliente ${cliente?.nombres || ''} ${cliente?.apellidos || ''} ha sido aprobado y activado.`,
          tipo: 'EXITO',
          entidad: 'PRESTAMO',
          entidadId: prestamo.id,
          metadata: {
            prestamoId: prestamo.id,
            clienteId: prestamo.clienteId,
            monto: prestamo.monto,
            aprobadoPor: aprobadoPorId,
          },
        });
      }

      // Auditoría
      await this.auditService.create({
        usuarioId: aprobadoPorId,
        accion: 'APROBAR_PRESTAMO',
        entidad: 'Prestamo',
        entidadId: prestamo.id,
        datosAnteriores: {
          estado: prestamo.estado,
          estadoAprobacion: prestamo.estadoAprobacion,
        },
        datosNuevos: { estado: 'ACTIVO', estadoAprobacion: 'APROBADO' },
      });

      this.notificacionesGateway.broadcastPrestamosActualizados({
        accion: 'APROBAR',
        prestamoId: prestamoActualizado.id,
      });
      this.notificacionesGateway.broadcastDashboardsActualizados({});

      return prestamoActualizado;
    } catch (error) {
      this.logger.error(`Error approving loan ${id}:`, error);
      throw error;
    }
  }

  async rejectLoan(id: string, rechazadoPorId: string, motivo?: string) {
    try {
      const prestamo = await this.prisma.prestamo.findUnique({
        where: { id },
      });

      if (!prestamo) {
        throw new NotFoundException('Préstamo no encontrado');
      }

      const prestamoRechazado = await this.prisma.prestamo.update({
        where: { id },
        data: {
          estadoAprobacion: EstadoAprobacion.RECHAZADO,
          aprobadoPorId: rechazadoPorId,
          estadoSincronizacion: 'PENDIENTE',
        },
        include: {
          cliente: true,
          producto: true,
        },
      });

      // CORRECCIÓN: Restablecer stock si el préstamo incluye un artículo físico (stock !== undefined)
      if (prestamoRechazado.productoId && prestamoRechazado.producto?.stock !== undefined && prestamoRechazado.producto?.stock !== null) {
        try {
           await this.prisma.producto.update({
             where: { id: prestamoRechazado.productoId },
             data: { stock: { increment: 1 } }
           });
        } catch(e) {
          this.logger.error(`Error devolviendo stock al rechazar el préstamo ${id}:`, e);
        }
      }

      // Actualizar la aprobación
      await this.prisma.aprobacion.updateMany({
        where: {
          referenciaId: id,
          tipoAprobacion: TipoAprobacion.NUEVO_PRESTAMO,
          estado: EstadoAprobacion.PENDIENTE,
        },
        data: {
          estado: EstadoAprobacion.RECHAZADO,
          aprobadoPorId: rechazadoPorId,
          revisadoEn: new Date(),
          comentarios: motivo,
        },
      });

      // Notificar al Coordinador (ALERTA)
      await this.notificacionesService.notifyCoordinator({
        titulo: 'Préstamo Rechazado',
        mensaje: `El préstamo ${prestamo.numeroPrestamo} ha sido rechazado. Motivo: ${motivo || 'No especificado'}`,
        tipo: 'ALERTA',
        entidad: 'PRESTAMO',
        entidadId: prestamo.id,
        metadata: { rechazadoPor: rechazadoPorId, motivo },
      });

      // Auditoría
      await this.auditService.create({
        usuarioId: rechazadoPorId,
        accion: 'RECHAZAR_PRESTAMO',
        entidad: 'Prestamo',
        entidadId: prestamo.id,
        datosAnteriores: { estadoAprobacion: prestamo.estadoAprobacion },
        datosNuevos: { estadoAprobacion: 'RECHAZADO', motivo },
      });

      this.notificacionesGateway.broadcastPrestamosActualizados({
        accion: 'RECHAZAR',
        prestamoId: prestamoRechazado.id,
      });
      this.notificacionesGateway.broadcastDashboardsActualizados({});

      return prestamoRechazado;
    } catch (error) {
      this.logger.error(`Error rejecting loan ${id}:`, error);
      throw error;
    }
  }

  async getLoanCuotas(prestamoId: string) {
    try {
      const cuotas = await this.prisma.cuota.findMany({
        where: { prestamoId },
        orderBy: { numeroCuota: 'asc' },
      });

      return cuotas;
    } catch (error) {
      this.logger.error(`Error getting cuotas for loan ${prestamoId}:`, error);
      throw error;
    }
  }

  async createLoan(data: CreateLoanDto) {
    try {
      this.logger.log(
        `Creating loan for client ${data.clienteId}, type: ${data.tipoPrestamo}. Data: ${JSON.stringify(data)}`,
      );

      // Verificar que el cliente existe
      const cliente = await this.prisma.cliente.findUnique({
        where: { id: data.clienteId },
        include: {
          asignacionesRuta: {
            where: { activa: true },
            include: { ruta: true },
          },
        },
      });

      if (!cliente) {
        throw new NotFoundException('Cliente no encontrado');
      }

      // Verificar que el cliente no esté en lista negra
      if (cliente.enListaNegra) {
        throw new BadRequestException(
          'El cliente está en lista negra y no puede recibir créditos',
        );
      }

      // Verificar que el creador existe
      const creador = await this.prisma.usuario.findUnique({
        where: { id: data.creadoPorId },
      });

      if (!creador) {
        throw new NotFoundException('Usuario creador no encontrado');
      }

      // Regla (producción): un COBRADOR no puede solicitar un préstamo en efectivo
      // si su caja de ruta no tiene saldo suficiente para el desembolso.
      // Esto evita que el saldo de la caja quede negativo al aprobar/desembolsar.
      const isArticulo = String(data.tipoPrestamo || '').toUpperCase() === 'ARTICULO';
      if (creador.rol === RolUsuario.COBRADOR && !isArticulo) {
        const montoDesembolso = Number(data.monto || 0);
        if (montoDesembolso > 0) {
          const rutaCobrador = await this.prisma.ruta.findFirst({
            where: {
              eliminadoEn: null,
              activa: true,
              cobradorId: creador.id,
            },
            select: { id: true },
          });

          if (!rutaCobrador?.id) {
            throw new BadRequestException(
              'No tienes una ruta activa asignada para solicitar un crédito en efectivo.',
            );
          }

          const cajaRuta = await this.prisma.caja.findFirst({
            where: {
              rutaId: rutaCobrador.id,
              tipo: 'RUTA',
              activa: true,
            },
            select: { id: true, nombre: true, saldoActual: true },
          });

          const saldoCajaRuta = Number((cajaRuta as any)?.saldoActual || 0);
          if (!cajaRuta?.id) {
            throw new BadRequestException(
              'No existe una caja de ruta activa para tu ruta. Contacta al administrador.',
            );
          }

          if (saldoCajaRuta < montoDesembolso) {
            throw new BadRequestException(
              `Saldo insuficiente en tu caja de ruta para solicitar este crédito. Caja: ${cajaRuta.nombre}. Saldo: ${saldoCajaRuta.toLocaleString('es-CO')}. Monto solicitado: ${montoDesembolso.toLocaleString('es-CO')}.`,
            );
          }
        }
      }

      // Verificación de idempotencia / prevención de duplicados
      // Buscar si existe un préstamo idéntico creado en los últimos 2 minutos
      const dosMinutosAtras = new Date(Date.now() - 2 * 60 * 1000);
      const prestamoDuplicado = await this.prisma.prestamo.findFirst({
        where: {
          clienteId: data.clienteId,
          monto: data.monto,
          tipoPrestamo: data.tipoPrestamo,
          frecuenciaPago: data.frecuenciaPago,
          creadoEn: { gte: dosMinutosAtras },
        },
      });

      if (prestamoDuplicado) {
        throw new BadRequestException(
          'Se ha detectado un crédito idéntico creado hace menos de 2 minutos. Para evitar registros duplicados por problemas de conexión, la solicitud fue bloqueada.',
        );
      }

      // Determinar si requiere aprobación (ADMIN y SUPER_ADMINISTRADOR no requieren)
      const rolesAutoAprobacion: RolUsuario[] = [RolUsuario.ADMIN, RolUsuario.SUPER_ADMINISTRADOR];
      const requiereAprobacion = !rolesAutoAprobacion.includes(creador.rol);
      const estadoInicial = requiereAprobacion ? EstadoPrestamo.PENDIENTE_APROBACION : EstadoPrestamo.ACTIVO;
      const estadoAprobacionInicial = requiereAprobacion ? EstadoAprobacion.PENDIENTE : EstadoAprobacion.APROBADO;

      let producto: any = null;
      let precioProducto: any = null;
      let montoFinanciar = data.monto;
      let precioArticuloTotal = data.monto; // Precio total del artículo (sin descontar cuota inicial)

      let precioVentaArticulo: number | null = null;
      let costoArticulo: number | null = null;
      let margenArticulo: number | null = null;

      // Para crédito por artículo
      if (data.tipoPrestamo === 'ARTICULO') {
        if (!data.productoId) {
          throw new BadRequestException('Para crédito por artículo se requiere productoId');
        }


        // Obtener el producto y precio del producto
        producto = await this.prisma.producto.findUnique({
          where: { id: data.productoId },
        });

        if (!producto) {
          throw new NotFoundException('Producto no encontrado');
        }

        // Verificar stock - CORREGIDO: acceso seguro a la propiedad stock
        if (producto.stock !== undefined && producto.stock < 1) {
          throw new BadRequestException('Producto sin stock disponible');
        }

        if (!data.esContado && data.precioProductoId) {
          precioProducto = await this.prisma.precioProducto.findUnique({
            where: { id: data.precioProductoId },
          });

          if (!precioProducto) {
            throw new NotFoundException('Plan de precio no encontrado');
          }

          // Verificar que el precioProducto corresponda al producto - CORREGIDO: acceso seguro
          if (
            precioProducto.productoId &&
            precioProducto.productoId !== data.productoId
          ) {
            throw new BadRequestException(
              'El plan de precio no corresponde al producto seleccionado',
            );
          }
        }

        // Calcular monto a financiar (precio total - cuota inicial)
        const cuotaInicial = data.cuotaInicial || 0;
        const precioTotal = (data.esContado || !precioProducto)
          ? data.monto 
          : (precioProducto.precio ? Number(precioProducto.precio) : 0);
        precioArticuloTotal = precioTotal; // Guardar precio total para datosSolicitud
        montoFinanciar = Math.max(0, precioTotal - cuotaInicial);

        // Persistir margen (Modelo A): se reconoce una sola vez al crear el crédito.

        // No afecta caja: solo se guarda para poder calcular utilidad operativa real en reportes.
        precioVentaArticulo = Number(precioTotal || 0);
        costoArticulo = producto?.costo != null ? Number(producto.costo) : 0;
        margenArticulo = Number(precioVentaArticulo) - Number(costoArticulo);

        if (Number(margenArticulo) < 0) {
          this.logger.warn(
            `[MARGEN NEGATIVO] Crédito ARTICULO: productoId=${producto?.id}, precioVenta=${precioVentaArticulo}, costo=${costoArticulo}, margen=${margenArticulo}`,
          );
        }

        if (cuotaInicial > precioTotal) {
          throw new BadRequestException(
            'La cuota inicial no puede ser mayor al precio total del artículo.',
          );
        }

        // Descontar stock solo si el producto maneja stock
        if (producto.stock !== undefined && producto.stock !== null) {
          await this.prisma.producto.update({
            where: { id: data.productoId },
            data: { stock: { decrement: 1 } },
          });
        }
      }

      // Generar número de préstamo/crédito
      const count = await this.prisma.prestamo.count();
      const tipo = (data.tipoPrestamo || '').toUpperCase();
      const prefix = tipo === 'ARTICULO' ? 'ART' : 'PRES';
      const numeroPrestamo = `${prefix}-${String(count + 1).padStart(6, '0')}`;

      // Para el cálculo de cuotas y fechas, usamos el plazo real
      // EXTRAER DE FORMA INFALIBLE: recorremos todos los campos posibles en orden
      const getVal = (v: any) => {
        const n = Number(v);
        return isNaN(n) || n <= 0 ? null : n;
      };

      const numCantidadCuotas = 
        getVal(data.cantidadCuotas) || 
        getVal(data.cuotas) || 
        getVal(data.cuotasTotales) || 
        getVal((data as any).numCuotas) || 
        getVal((data as any).totalCuotas) || 
        0;

      let numPlazoMeses = Number(data.plazoMeses || (data as any).plazo || (data as any).numPlazo || 0);

      // Si no hay plazo pero hay cuotas, derivamos el plazo (0.4 para 12 días, etc.)
      if (numPlazoMeses === 0 && numCantidadCuotas > 0) {
        if (data.frecuenciaPago === FrecuenciaPago.DIARIO) {
           numPlazoMeses = numCantidadCuotas / 30;
        } else if (data.frecuenciaPago === FrecuenciaPago.SEMANAL) {
           numPlazoMeses = numCantidadCuotas / 4;
        } else if (data.frecuenciaPago === FrecuenciaPago.QUINCENAL) {
           numPlazoMeses = numCantidadCuotas / 2;
        }
      }

      // Para el cálculo de interés simple, usamos el numPlazoMeses (float)
      // Si el usuario quiere 1 mes de interés pero en 12 cuotas, numPlazoMeses será 1.
      
      // Para Prisma (el registro en la tabla), plazoMeses es Int.
      const plazoMesesPrisma = Math.max(1, Math.round(numPlazoMeses));
      
      // Calcular fechas
      const { startDate: fechaActual } = getBogotaStartEndOfDay(new Date());
      
      const fechaInicio = data.fechaInicio ? this.parseBogotaDayKey(data.fechaInicio) : fechaActual;
      
      // La fecha de vencimiento del préstamo (fechaFin) se basa estrictamente en el plazoMeses usando helper
      let fechaFin = this.calculateLoanEndDate(fechaInicio, numPlazoMeses);

      const fechaPrimerCobroParsed = data.fechaPrimerCobro
        ? this.parseBogotaDayKey(data.fechaPrimerCobro)
        : undefined;

      // Calcular cantidad de cuotas: Prioridad TOTAL al valor enviado por el usuario
      let cantidadCuotas = numCantidadCuotas;
      
      if (cantidadCuotas > 0) {
        this.logger.log(`[CUOTAS CALCULATION] Priorizando cuotas del usuario: ${cantidadCuotas}`);
      } else {
        this.logger.log(`[CUOTAS CALCULATION] Calculando cuotas desde plazoMeses=${numPlazoMeses} y frecu=${data.frecuenciaPago}`);
        switch (data.frecuenciaPago) {
          case FrecuenciaPago.DIARIO:
            cantidadCuotas = Math.ceil(numPlazoMeses * 30);
            break;
          case FrecuenciaPago.SEMANAL:
            cantidadCuotas = Math.ceil(numPlazoMeses * 4);
            break;
          case FrecuenciaPago.QUINCENAL:
            cantidadCuotas = Math.ceil(numPlazoMeses * 2);
            break;
          case FrecuenciaPago.MENSUAL:
            cantidadCuotas = Math.ceil(numPlazoMeses);
            break;
          default:
            cantidadCuotas = Math.ceil(numPlazoMeses * 4);
        }
      }
      
      // Aseguramos un mínimo de 1
      if (cantidadCuotas <= 0 && numPlazoMeses > 0) {
          cantidadCuotas = 1;
      }
      
      this.logger.log(`[CUOTAS CALCULATION] Cantidad final de cuotas a crear: ${cantidadCuotas}`);

      const tipoAmort = data.tipoAmortizacion || TipoAmortizacion.INTERES_SIMPLE;
      const tasaInteres = data.tasaInteres || 0;

      const { interesTotal, cuotas: cuotasData } =
        this.calculateInterestAndCuotas(
          tipoAmort,
          montoFinanciar,
          tasaInteres,
          cantidadCuotas,
          numPlazoMeses,
          data.frecuenciaPago,
          fechaInicio,
          fechaPrimerCobroParsed,
          data.esContado,
        );

      const cuotasDataFinal = data.esContado
        ? cuotasData.map((c: any) => ({
            ...c,
            fechaPago: fechaInicio,
          }))
        : cuotasData;

      // Homogeneizar vencimiento del préstamo con el cronograma real
      if (cuotasData.length > 0) {
        fechaFin = new Date(cuotasData[cuotasData.length - 1].fechaVencimiento);
      }

      const montoTotal = montoFinanciar + interesTotal;

      const autoAprobarCreditos = await this.configuracionService.shouldAutoApproveCredits();
      const esAutoAprobado = autoAprobarCreditos;
      this.logger.log(`[CREATE LOAN] Usuario: ${creador.nombres}, Rol: ${creador.rol}, Auto-aprobado por configuración global: ${esAutoAprobado}`);

      // Crear préstamo con cuotas
      const prestamo = await this.prisma.prestamo.create({
        data: {
          numeroPrestamo,
          clienteId: data.clienteId,
          productoId: data.productoId,
          precioProductoId: data.precioProductoId,
          tipoPrestamo: data.tipoPrestamo,
          tipoAmortizacion: tipoAmort,
          monto: montoFinanciar,
          precioVentaArticulo,
          costoArticulo,
          margenArticulo,
          tasaInteres: tasaInteres,
          tasaInteresMora: data.tasaInteresMora || 2,
          plazoMeses: plazoMesesPrisma,
          frecuenciaPago: data.frecuenciaPago,
          cantidadCuotas,
          cuotaInicial: data.cuotaInicial || 0,
          fechaInicio,
          fechaPrimerCobro: fechaPrimerCobroParsed,
          fechaFin,
          estado: data.esContado ? EstadoPrestamo.PAGADO : (esAutoAprobado ? EstadoPrestamo.ACTIVO : EstadoPrestamo.PENDIENTE_APROBACION),
          estadoAprobacion: data.esContado ? EstadoAprobacion.APROBADO : (esAutoAprobado ? EstadoAprobacion.APROBADO : EstadoAprobacion.PENDIENTE),
          aprobadoPorId: data.esContado || esAutoAprobado ? data.creadoPorId : undefined,
          creadoPorId: data.creadoPorId,
          interesTotal,
          saldoPendiente: data.esContado ? 0 : montoTotal,
          totalPagado: data.esContado ? montoTotal : 0,
          notas: (data.notas || (data as any).observaciones || (data as any).comentarios || (data as any).detalle || undefined) 
            ? String(data.notas || (data as any).observaciones || (data as any).comentarios || (data as any).detalle) 
            : undefined,
          garantia: data.garantia ? String(data.garantia) : undefined,
          cuotas: {
            create: cuotasDataFinal,
          },
        } as any,
        include: {
          cliente: true,
          producto: true,
          cuotas: true,
          creadoPor: {
            select: {
              id: true,
              nombres: true,
              apellidos: true,
              rol: true,
            },
          },
        },
      });

      const hoyKey = getBogotaDayKey(new Date());
      const { startDate: today } = getBogotaStartEndOfDayFromKey(hoyKey);
      const startKey = getBogotaDayKey(new Date(fechaInicio));
      const { startDate: startDate } = getBogotaStartEndOfDayFromKey(startKey);

      if (!data.esContado && startDate.getTime() === today.getTime()) {
        const rutaPreferida = cliente.asignacionesRuta?.find((a: any) => a?.activa && a?.ruta?.activa && !a?.ruta?.eliminadoEn);

        const rutaCobrador = !rutaPreferida && creador.rol === RolUsuario.COBRADOR
          ? await this.prisma.ruta.findFirst({
              where: {
                eliminadoEn: null,
                activa: true,
                cobradorId: creador.id,
              },
              select: { id: true, cobradorId: true },
            })
          : null;

        const rutaIdAsignar = (rutaPreferida as any)?.rutaId || (rutaPreferida as any)?.ruta?.id || rutaCobrador?.id;
        const cobradorIdAsignar = (rutaPreferida as any)?.cobradorId || (rutaPreferida as any)?.ruta?.cobradorId || rutaCobrador?.cobradorId;

        if (rutaIdAsignar && cobradorIdAsignar) {
          const existenteHoy = await this.prisma.asignacionRuta.findFirst({
            where: {
              rutaId: rutaIdAsignar,
              clienteId: cliente.id,
              activa: true,
              fechaEspecifica: today,
            },
            select: { id: true },
          });

          if (!existenteHoy) {
            const maxOrden = await this.prisma.asignacionRuta.aggregate({
              where: { rutaId: rutaIdAsignar, activa: true },
              _max: { ordenVisita: true },
            });

            await this.prisma.asignacionRuta.create({
              data: {
                rutaId: rutaIdAsignar,
                clienteId: cliente.id,
                cobradorId: cobradorIdAsignar,
                fechaEspecifica: today,
                ordenVisita: (maxOrden._max.ordenVisita || 0) + 1,
                activa: true,
              },
            });

            this.notificacionesGateway.broadcastRutasActualizadas({
              accion: 'ACTUALIZAR',
              rutaId: rutaIdAsignar,
              clienteId: cliente.id,
            });
          }
        }
      }

      this.logger.log(`Loan created successfully: ${prestamo.id}, requiereAprobacion: ${esAutoAprobado}`);

      if (data.esContado && prestamo.cuotas && prestamo.cuotas.length > 0) {
        await this.prisma.pago.create({
          data: {
            prestamoId: prestamo.id,
            registradoPorId: data.creadoPorId,
            montoPagado: montoTotal,
            fechaPago: new Date(),
            metodoPago: 'EFECTIVO',
            referenciaTx: 'VENTA_CONTADO',
            notas: 'Pago íntegro automático por venta de contado',
            estadoSincronizacion: 'PENDIENTE',
            detalles: {
              create: prestamo.cuotas.map((c: any) => ({
                cuotaId: c.id,
                montoAsignado: Number(c.monto),
                montoCapitalAsignado: Number(c.montoCapital),
                montoInteresAsignado: Number(c.montoInteres),
                moraAsignada: 0,
              }))
            }
          }
        });
      }

      const articuloNombre = (data as any).productoNombre || (prestamo as any).producto?.nombre || 'Artículo';
      const totalCuotasPrometidas = cantidadCuotas;
      const isFinanciamientoArticulo = data.tipoPrestamo === 'ARTICULO';

      const safeNumber = (val: any) => {
        const n = Number(val);
        return isNaN(n) ? 0 : n;
      };

      // Crear registro de aprobación
      const aprobacion = await this.prisma.aprobacion.create({
        data: {
          tipoAprobacion: TipoAprobacion.NUEVO_PRESTAMO,
          referenciaId: prestamo.id,
          tablaReferencia: 'Prestamo',
          solicitadoPorId: data.creadoPorId,
          datosSolicitud: {
            numeroPrestamo: prestamo.numeroPrestamo,
            cliente: `${cliente.nombres} ${cliente.apellidos}`,
            cedula: String(cliente.dni),
            telefono: String(cliente.telefono),
            monto: safeNumber(prestamo.monto),
            tipo: String(data.tipoPrestamo),
            // Sanitizar el nombre del artículo: reemplazar & HTML por símbolo natural
            articulo: String(articuloNombre).replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>'),
            // valorArticulo = precio total del artículo (incluye cuota inicial + monto financiado)
            valorArticulo: isFinanciamientoArticulo
              ? safeNumber((data as any).valorArticulo || precioArticuloTotal)
              : safeNumber(prestamo.monto),
            cuotas: safeNumber(totalCuotasPrometidas),
            plazoMeses: numPlazoMeses, // GUARDAR EL FLOAT (Ej: 0.4) para que la aprobación no lo redondee a 1.
            porcentaje: safeNumber(isFinanciamientoArticulo ? 0 : tasaInteres),
            frecuenciaPago: String(data.frecuenciaPago),
            cuotaInicial: safeNumber(data.cuotaInicial),
            notas: (data.notas || (data as any).observaciones || (data as any).comentarios || (data as any).detalle || undefined) 
              ? String(data.notas || (data as any).observaciones || (data as any).comentarios || (data as any).detalle) 
              : undefined,
            garantia: data.garantia ? String(data.garantia) : undefined,
            fechaInicio: prestamo.fechaInicio ? formatBogotaOffsetIso(prestamo.fechaInicio) : undefined,
            fechaPrimerCobro: (data as any).fechaPrimerCobro ? String((data as any).fechaPrimerCobro) : undefined,
            esContado: !!data.esContado,
          },
          // montoSolicitud = precio total del artículo, o monto del préstamo en efectivo
          montoSolicitud: isFinanciamientoArticulo ? precioArticuloTotal : safeNumber(prestamo.monto),
          estado: data.esContado || esAutoAprobado ? EstadoAprobacion.APROBADO : EstadoAprobacion.PENDIENTE,
          aprobadoPorId: data.esContado || esAutoAprobado ? data.creadoPorId : undefined,
        },
      });

      if (!esAutoAprobado && !data.esContado) {
        try {
          await this.notificacionesService.notifyApprovers({
            titulo: 'Nuevo crédito requiere aprobación',
            mensaje: `${creador.nombres} ${creador.apellidos} solicitó un ${data.tipoPrestamo === 'EFECTIVO' ? 'préstamo' : 'crédito por un artículo'} para ${cliente.nombres} ${cliente.apellidos} por ${montoFinanciar.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}.`,
            tipo: 'PRESTAMO',
            entidad: 'Aprobacion',
            entidadId: aprobacion.id,
            metadata: this.buildPrestamoNotifMetadata({ prestamo, data, cliente, cantidadCuotas, numPlazoMeses, articuloNombre, isFinanciamientoArticulo, precioArticuloTotal, safeNumber }),
          });
        } catch {}

        try {
          await this.notificacionesService.create({
            usuarioId: data.creadoPorId,
            titulo: 'Solicitud enviada',
            mensaje: 'Tu solicitud fue enviada con éxito y quedó pendiente de aprobación.',
            tipo: 'INFORMATIVO',
            entidad: 'Aprobacion',
            entidadId: aprobacion.id,
            metadata: this.buildPrestamoNotifMetadata({ prestamo, data, cliente, cantidadCuotas, numPlazoMeses, articuloNombre, isFinanciamientoArticulo, precioArticuloTotal, safeNumber }),
          });
        } catch {}
      }

      if (esAutoAprobado || data.esContado) {
        // Notificar a administradores sobre préstamo aprobado automáticamente o venta de contado
        const admins = await this.prisma.usuario.findMany({
          where: {
            rol: { in: [RolUsuario.ADMIN, RolUsuario.SUPER_ADMINISTRADOR] },
            estado: 'ACTIVO',
            id: { not: data.creadoPorId },
          },
        });

        for (const admin of admins) {
          await this.notificacionesService.create({
            usuarioId: admin.id,
            titulo: data.esContado ? 'Nueva Venta de Contado' : 'Préstamo Aprobado Automáticamente',
            mensaje: data.esContado 
              ? `${creador.nombres} realizó una venta de contado para ${cliente.nombres} ${cliente.apellidos} por ${montoFinanciar.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}`
              : `${creador.nombres} ${creador.apellidos} creó y aprobó automáticamente un préstamo para ${cliente.nombres} ${cliente.apellidos} por ${montoFinanciar.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}`,
            tipo: 'SISTEMA',
            entidad: 'PRESTAMO',
            entidadId: prestamo.id,
            metadata: {
              esContado: !!data.esContado,
              articulo: String(articuloNombre).replace(/&amp;/gi, '&'),
              valorArticulo: isFinanciamientoArticulo ? safeNumber(precioArticuloTotal) : safeNumber(prestamo.monto),
              monto: safeNumber(prestamo.monto),
              clienteId: cliente.id,
              numeroPrestamo: prestamo.numeroPrestamo,
              cuotas: safeNumber(totalCuotasPrometidas),
              plazoMeses: numPlazoMeses,
              frecuenciaPago: String(data.frecuenciaPago),
              cuotaInicial: safeNumber(data.cuotaInicial),
              notas: String(data.notas || ''),
              fechaInicio: prestamo.fechaInicio ? formatBogotaOffsetIso(prestamo.fechaInicio) : undefined,
              fecha: prestamo.fechaInicio ? formatBogotaOffsetIso(prestamo.fechaInicio) : undefined, // Duplicado para compatibilidad
            }
          });
        }

        // Enviar notificaciones push a administradores
        await this.pushService.sendPushNotification({
          title: 'Préstamo Aprobado Automáticamente',
          body: `${creador.nombres} ${creador.apellidos} creó y aprobó un préstamo por ${montoFinanciar.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}`,
          roleFilter: ['ADMIN', 'SUPER_ADMINISTRADOR'],
          data: {
            type: 'PRESTAMO_APROBADO',
            prestamoId: prestamo.id,
            numeroPrestamo: prestamo.numeroPrestamo
          }
        });

        // Notificar al creador
        await this.notificacionesService.create({
          usuarioId: data.creadoPorId,
          titulo: 'Préstamo Creado y Aprobado',
          mensaje: `El préstamo ${prestamo.numeroPrestamo} ha sido creado y aprobado automáticamente.`,
          tipo: 'EXITO',
          entidad: 'PRESTAMO',
          entidadId: prestamo.id,
        });

        // Enviar notificación push al creador
        await this.pushService.sendPushNotification({
          title: 'Préstamo Creado y Aprobado',
          body: `Tu préstamo ${prestamo.numeroPrestamo} ha sido creado y aprobado automáticamente.`,
          userId: data.creadoPorId,
          data: {
            type: 'PRESTAMO_CREADO',
            prestamoId: prestamo.id,
            numeroPrestamo: prestamo.numeroPrestamo
          }
        });
      } else {
        /* 
        // Notificar a coordinadores, admins y superadmins para aprobación
        await this.notificacionesService.notifyApprovers({
          titulo: 'Nuevo Préstamo Requiere Aprobación',
          mensaje: `El usuario ${creador.nombres} ${creador.apellidos} ha solicitado un ${data.tipoPrestamo === 'EFECTIVO' ? 'préstamo en efectivo' : 'crédito por un artículo'} para ${cliente.nombres} ${cliente.apellidos} por valor de ${montoFinanciar.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}`,
          tipo: 'APROBACION',
          entidad: 'Aprobacion',
          entidadId: aprobacion.id,
          metadata: {
             // ... [Omitido para no generar ruido de notificaciones de aprobación]
          },
        });
        */

        // Enviar notificaciones push a coordinadores
        await this.pushService.sendPushNotification({
          title: 'Nuevo Préstamo Requiere Aprobación',
          body: `${creador.nombres} ${creador.apellidos} ha solicitado un ${data.tipoPrestamo === 'EFECTIVO' ? 'préstamo' : 'crédito de artículo'} por ${montoFinanciar.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}`,
          roleFilter: ['COORDINADOR'],
          data: {
            type: 'PRESTAMO_PENDIENTE',
            prestamoId: prestamo.id,
            numeroPrestamo: prestamo.numeroPrestamo
          }
        });

// Notificar al creador
        await this.notificacionesService.create({
          usuarioId: data.creadoPorId,
          titulo: 'Préstamo Solicitado Exitosamente',
          mensaje: `Tu solicitud de préstamo ${prestamo.numeroPrestamo} ha sido creada exitosamente y está pendiente de aprobación.`,
          tipo: 'EXITO',
          entidad: 'PRESTAMO',
          entidadId: prestamo.id,
        });
      }

      // Auditoría
      await this.auditService.create({
        usuarioId: data.creadoPorId,
        accion: 'CREAR_PRESTAMO',
        entidad: 'Prestamo',
        entidadId: prestamo.id,
        datosNuevos: {
          numeroPrestamo: prestamo.numeroPrestamo,
          clienteId: prestamo.clienteId,
          tipoPrestamo: prestamo.tipoPrestamo,
          monto: prestamo.monto,
          plazoMeses: prestamo.plazoMeses,
          frecuenciaPago: prestamo.frecuenciaPago,
          autoAprobado: esAutoAprobado,
        },
        metadata: { notas: data.notas || null },
      });

      this.notificacionesGateway.broadcastPrestamosActualizados({
        accion: 'CREAR',
        prestamoId: prestamo.id,
      });
      this.notificacionesGateway.broadcastDashboardsActualizados({});

      return {
        ...prestamo,
        mensaje: esAutoAprobado
          ? 'Préstamo creado y aprobado automáticamente.'
          : 'Préstamo creado exitosamente. Pendiente de aprobación.',
        requiereAprobacion: !esAutoAprobado,
      };
    } catch (error) {
      this.logger.error('Error creating loan:', error);
      throw error;
    }
  }

  /**
   * Archivar préstamo como pérdida y agregar cliente a blacklist
   */
  async archiveLoan(prestamoId: string, data: { motivo: string; notas?: string; archivarPorId: string }) {
    const prestamo = await this.prisma.prestamo.findUnique({
      where: { id: prestamoId },
      include: { cliente: true },
    });

    if (!prestamo) {
      throw new NotFoundException('Préstamo no encontrado');
    }

    if (prestamo.estado === 'PERDIDA') {
      throw new BadRequestException('Este préstamo ya está archivado como pérdida');
    }

    // Realizar operaciones en transacción
    await this.prisma.$transaction(async (tx) => {
      // 1. Marcar préstamo como PERDIDA
      await tx.prestamo.update({
        where: { id: prestamoId },
        data: {
          estado: 'PERDIDA',
          eliminadoEn: new Date(),
        },
      });

      // 2. Marcar aprobaciones pendientes como RECHAZADAS (específicamente las de este préstamo)
      await tx.aprobacion.updateMany({
        where: {
          referenciaId: prestamoId,
          estado: 'PENDIENTE',
        },
        data: {
          estado: 'RECHAZADO',
          comentarios: `Archivado automáticamente: ${data.motivo}`,
          revisadoEn: new Date(),
        },
      });

      // 3. Registrar en auditoría
      await this.auditService.create({
        usuarioId: data.archivarPorId,
        accion: 'ARCHIVAR_PRESTAMO',
        entidad: 'Prestamo',
        entidadId: prestamoId,
        datosAnteriores: { 
          estado: prestamo.estado,
          numeroPrestamo: prestamo.numeroPrestamo,
          nombres: prestamo.cliente.nombres,
          apellidos: prestamo.cliente.apellidos
        },
        datosNuevos: { estado: 'PERDIDA', motivo: data.motivo },
      });

      // 4. Notificar (opcional - puede fallar si el servicio no tiene el método)
      try {
        await tx.notificacion.create({
          data: {
            usuarioId: data.archivarPorId,
            titulo: 'Cuenta Archivada',
            mensaje: `Préstamo ${prestamo.numeroPrestamo} archivado como pérdida.`,
            tipo: 'ALERTA',
            entidad: 'Prestamo',
            entidadId: prestamoId,
          },
        });
      } catch (err) {
        // Ignorar error de notificación
      }
    });

    try {
      const asignacion = await this.prisma.asignacionRuta.findFirst({
        where: { clienteId: prestamo.clienteId, activa: true },
        select: { ruta: { select: { cobradorId: true } } },
      });

      const cobradorId = asignacion?.ruta?.cobradorId;
      if (cobradorId) {
        await this.notificacionesService.create({
          usuarioId: cobradorId,
          titulo: `Cuenta gestionada — Reportada como pérdida (${prestamo.numeroPrestamo})`,
          mensaje: `El cliente ${prestamo.cliente.nombres} ${prestamo.cliente.apellidos} fue gestionado en Cuentas Vencidas y se reportó como pérdida.${data.motivo ? ` Motivo: ${data.motivo}` : ''}`,
          tipo: 'ADVERTENCIA',
          entidad: 'Prestamo',
          entidadId: prestamoId,
          metadata: {
            tipo: 'GESTION_VENCIDA',
            decision: 'CASTIGAR',
            prestamoId,
            clienteId: prestamo.clienteId,
            numeroPrestamo: prestamo.numeroPrestamo,
            motivo: data.motivo,
            archivarPorId: data.archivarPorId,
          },
        });
      }
    } catch {
      // no interrumpir
    }

    return {
      message: 'Préstamo archivado exitosamente',
      prestamoId,
      clienteId: prestamo.clienteId,
      montoPerdida: Number(prestamo.saldoPendiente),
    };
  }

  async reprogramarCuota(
    prestamoId: string,
    numeroCuota: number,
    data: {
      motivo: string;
      nuevaFecha: string;
      montoParcial?: number;
      reprogramadoPorId: string;
    }
  ) {
    // Validar que el préstamo exista
    const prestamo = await this.prisma.prestamo.findUnique({
      where: { id: prestamoId },
      include: { cuotas: true },
    });

    if (!prestamo) {
      throw new NotFoundException('Préstamo no encontrado');
    }

    // Buscar la cuota específica
    const cuota = prestamo.cuotas.find(c => c.numeroCuota === numeroCuota);
    if (!cuota) {
      throw new NotFoundException(`Cuota #${numeroCuota} no encontrada`);
    }

    // Validar que la cuota esté pendiente
    if (cuota.estado !== 'PENDIENTE') {
      throw new BadRequestException('Solo se pueden reprogramar cuotas pendientes');
    }

    // Validar la nueva fecha
    const nuevaFecha = new Date(data.nuevaFecha);
    if (isNaN(nuevaFecha.getTime())) {
      throw new BadRequestException('Fecha inválida');
    }

    // Actualizar la cuota
    const cuotaActualizada = await this.prisma.cuota.update({
      where: { id: cuota.id },
      data: {
        fechaVencimiento: nuevaFecha,
        ...(data.montoParcial && { monto: data.montoParcial }),
        actualizadoEn: new Date(),
      },
    });

    // Registrar auditoría
    await this.auditService.create({
      usuarioId: data.reprogramadoPorId,
      accion: 'REPROGRAMAR_CUOTA',
      entidad: 'Cuota',
      entidadId: cuota.id,
      datosNuevos: {
        prestamoId,
        numeroCuota,
        fechaAnterior: cuota.fechaVencimiento,
        fechaNueva: data.nuevaFecha,
        motivo: data.motivo,
        montoParcial: data.montoParcial,
      },
    });

    // Notificar al cliente (opcional)
    // TODO: Implementar notificación al cliente sobre reprogramación

    this.logger.log(`Cuota #${numeroCuota} del préstamo ${prestamoId} reprogramada a ${data.nuevaFecha}`);

    return {
      mensaje: 'Cuota reprogramada exitosamente',
      cuota: cuotaActualizada,
    };
  }

  /**
   * ADMIN: Corrige cálculos de intereses en préstamos existentes.
   * Recalcula el interés total basándose en Interés Simple Correcto (Capital * Tasa * PlazoMeses / 100).
   * Ajusta el saldo pendiente y distribuye la diferencia en las cuotas pendientes.
   */
  async fixInterestCalculations() {
    this.logger.log('Iniciando corrección masiva de intereses...');
    const results = {
      processed: 0,
      corrected: 0,
      details: [] as string[]
    };

    // 1. Obtener préstamos activos con interés SIMPLE
    const loans = await this.prisma.prestamo.findMany({
      where: {
        tipoAmortizacion: TipoAmortizacion.INTERES_SIMPLE,
        estado: { in: [EstadoPrestamo.ACTIVO, EstadoPrestamo.EN_MORA] },
      },
      include: { 
        cuotas: true
      },
    });

    results.processed = loans.length;

    for (const loan of loans) {
      // Ordenar cuotas en memoria para evitar fallos de driver con orderBy en include
      loan.cuotas.sort((a, b) => a.numeroCuota - b.numeroCuota);

      try {
        const capital = Number(loan.monto);
        const tasaMensual = Number(loan.tasaInteres);
        
        // Calcular plazo en meses aproximado si no existe, o usar el guardado
        let plazoMeses = loan.plazoMeses;
        if (!plazoMeses || plazoMeses === 0) {
            const factor = loan.frecuenciaPago === 'MENSUAL' ? 1 : 
                           loan.frecuenciaPago === 'QUINCENAL' ? 2 : 
                           loan.frecuenciaPago === 'SEMANAL' ? 4 : 30;
            plazoMeses = Math.ceil(loan.cantidadCuotas / factor);
        }
        
        // INTERES SIMPLE: I = C * i * t
        const interesCorrecto = Math.round((capital * (tasaMensual / 100) * plazoMeses) * 100) / 100;
        const interesActual = Number(loan.interesTotal);

        // Verificar discrepancia significativa (> $100 pesos)
        if (interesCorrecto > interesActual && (interesCorrecto - interesActual) > 100) {
          const diferenciaInteres = interesCorrecto - interesActual;
          
          this.logger.log(`Corrigiendo Préstamo ${loan.numeroPrestamo}: Interés Actual ${interesActual} -> Nuevo ${interesCorrecto} (Dif: ${diferenciaInteres})`);

          // Calcular deuda total previa y pagado
          const deudaTotalVieja = Number(loan.monto) + Number(loan.interesTotal);
          const pagado = deudaTotalVieja - Number(loan.saldoPendiente);
          
          // Nuevo saldo pendiente (Capital + NuevoInteres - Pagado)
          const nuevoMontoTotal = Number(loan.monto) + interesCorrecto;
          const nuevoSaldoPendiente = nuevoMontoTotal - pagado;

          // Actualizar préstamo
          await this.prisma.prestamo.update({
            where: { id: loan.id },
            data: {
              interesTotal: interesCorrecto,
              saldoPendiente: nuevoSaldoPendiente,
            }
          });

          // Ajustar cuotas NO pagadas totalmente (PENDIENTE, PARCIAL, VENCIDA)
          const cuotasAjustables = loan.cuotas.filter(c => 
            c.estado === 'PENDIENTE' || c.estado === 'PARCIAL' || c.estado === 'VENCIDA'
          );
          
          if (cuotasAjustables.length > 0) {
            const ajustePorCuota = Math.round((diferenciaInteres / cuotasAjustables.length) * 100) / 100;
            
            // Aplicar ajuste
            for (const cuota of cuotasAjustables) {
              await this.prisma.cuota.update({
                where: { id: cuota.id },
                data: {
                  montoInteres: { increment: ajustePorCuota },
                  monto: { increment: ajustePorCuota },
                }
              });
            }
          }

          results.corrected++;
          results.details.push(`Préstamo ${loan.numeroPrestamo}: Ajuste de +${diferenciaInteres}`);
        }
      } catch (error) {
        this.logger.error(`Error corrigiendo préstamo ${loan.numeroPrestamo}: ${error}`);
      }
    }

    return results;
  }

  // ── FLUJO DE APROBACIÓN DE REPROGRAMACIONES ─────────────────────────────────

  /**
   * El COBRADOR solicita reprogramar una cuota. Se registra como Aprobacion
   * en estado PENDIENTE y se notifica a los aprobadores (ADMIN/COORDINADOR).
   * Valida los límites de días: semanal ≤6 días, quincenal ≤14 días.
   */
  async solicitarReprogramacion(data: {
    prestamoId: string;
    cuotaId?: string;
    nuevaFecha: string;
    motivo: string;
    solicitadoPorId: string;
  }) {
    const prestamo = await this.prisma.prestamo.findUnique({
      where: { id: data.prestamoId },
      include: {
        cliente: true,
        cuotas: data.cuotaId
          ? { where: { id: data.cuotaId } }
          : { where: { estado: { not: 'PAGADA' } }, orderBy: { numeroCuota: 'asc' }, take: 1 },
      },
    });
    if (!prestamo) throw new NotFoundException('Préstamo no encontrado');

    const cuota = prestamo.cuotas[0];
    if (!cuota) throw new NotFoundException('Cuota no encontrada');
    if (cuota.estado === 'PAGADA') {
      throw new BadRequestException('La cuota ya fue pagada');
    }

    const { startDate: hoyLocal } = getBogotaStartEndOfDay(new Date());

    // Normalizar la nuevaFecha enviada por el frontend
    const nuevaFechaStr = data.nuevaFecha.includes('T') ? data.nuevaFecha.split('T')[0] : data.nuevaFecha;
    const nuevaFechaObj = new Date(`${nuevaFechaStr}T12:00:00-05:00`);

    const diasDesdeHoy = Math.round((nuevaFechaObj.getTime() - hoyLocal.getTime()) / 86_400_000);

    const limiteDias: Record<string, number> = {
      SEMANAL: 6,
      QUINCENAL: 14,
      MENSUAL: 30,
      DIARIO: 8,
    };
    const limite = limiteDias[prestamo.frecuenciaPago] ?? 30;
    if (diasDesdeHoy > limite) {
      throw new BadRequestException(
        `La reprogramación para créditos ${prestamo.frecuenciaPago.toLowerCase()} no puede exceder ${limite} días desde hoy`,
      );
    }
    if (diasDesdeHoy < 0) {
      throw new BadRequestException('La nueva fecha no puede ser anterior a la fecha actual');
    }

    // Crear solicitud de aprobación
    const aprobacion = await this.prisma.aprobacion.create({
      data: {
        tipoAprobacion: TipoAprobacion.REPROGRAMACION_CUOTA,
        referenciaId: cuota.id,
        tablaReferencia: 'cuotas',
        solicitadoPorId: data.solicitadoPorId,
        estado: EstadoAprobacion.PENDIENTE,
        datosSolicitud: {
          prestamoId: data.prestamoId,
          cuotaId: data.cuotaId || cuota.id,
          clienteNombre: `${prestamo.cliente.nombres} ${prestamo.cliente.apellidos}`,
          clienteId: prestamo.clienteId,
          numeroPrestamo: prestamo.numeroPrestamo,
          numeroCuota: cuota.numeroCuota,
          frecuenciaPago: prestamo.frecuenciaPago,
          fechaVencimientoOriginal: formatBogotaOffsetIso(cuota.fechaVencimiento),
          nuevaFecha: data.nuevaFecha,
          motivo: data.motivo,
          montoCuota: Number(cuota.monto),
        },
      },
    });

    // Validar Auto-Aprobación
    const usuarioSolicitante = await this.prisma.usuario.findUnique({
      where: { id: data.solicitadoPorId },
      select: { rol: true }
    });

    const rolNameText = usuarioSolicitante?.rol === 'SUPERVISOR' ? 'Supervisor' : 'Cobrador Principal';

    // Notificar a aprobadores (ADMIN / COORDINADOR / SUPERVISOR)
    await this.notificacionesService.notifyApprovers({
      titulo: 'Reprogramaciones',
      mensaje: `Solicitud de reprogramaciones por ${rolNameText}`,
      tipo: 'REPROGRAMACION',
      entidad: 'Aprobacion',
      entidadId: aprobacion.id,
      metadata: { aprobacionId: aprobacion.id, prestamoId: data.prestamoId },
    });

    this.logger.log(`Reprogramacion solicitada: cuota ${cuota.id} del prestamo ${data.prestamoId} -> ${data.nuevaFecha}`);

    try {
      await this.notificacionesService.create({
        usuarioId: data.solicitadoPorId,
        titulo: 'Solicitud de reprogramación enviada',
        mensaje: 'Tu solicitud fue enviada con éxito y quedó pendiente de aprobación.',
        tipo: 'INFORMATIVO',
        entidad: 'Aprobacion',
        entidadId: aprobacion.id,
        metadata: {
          tipoAprobacion: 'REPROGRAMACION_CUOTA',
          tipo: 'REPROGRAMACION_CUOTA',
          prestamoId: data.prestamoId,
        },
      });
    } catch {}

    // ⚡ Tiempo real: notificar a todos los clientes conectados
    this.notificacionesGateway.broadcastAprobacionesActualizadas({
      tipo: 'REPROGRAMACION_CUOTA',
      prestamoId: data.prestamoId,
      aprobacionId: aprobacion.id,
    });

    return { mensaje: 'Solicitud de reprogramacion enviada para revision', aprobacion };
  }

  /**
   * Lista todas las reprogramaciones PENDIENTES para el módulo de revisiones.
   */
  async listarReprogramacionesPendientes(estado?: string) {
    const where: any = {
      tipoAprobacion: TipoAprobacion.REPROGRAMACION_CUOTA,
    };
    if (estado && estado !== 'TODOS') {
      where.estado = estado as EstadoAprobacion;
    } else {
      where.estado = EstadoAprobacion.PENDIENTE;
    }

    const solicitudes = await this.prisma.aprobacion.findMany({
      where,
      orderBy: { creadoEn: 'desc' },
      include: {
        solicitadoPor: { select: { id: true, nombres: true, apellidos: true, rol: true } },
        aprobadoPor: { select: { id: true, nombres: true, apellidos: true } },
      },
    });

    return solicitudes.map(s => ({
      ...s,
      datosSolicitud: s.datosSolicitud as Record<string, any>,
    }));
  }

  /**
   * SUPERVISOR/ADMIN aprueba una reprogramación: aplica la nueva fecha a la cuota.
   */
  async aprobarReprogramacion(aprobacionId: string, aprobadoPorId: string) {
    const aprobacion = await this.prisma.aprobacion.findUnique({ where: { id: aprobacionId } });
    if (!aprobacion) throw new NotFoundException('Solicitud no encontrada');
    if (aprobacion.estado !== EstadoAprobacion.PENDIENTE) {
      throw new BadRequestException('Solo se pueden aprobar solicitudes pendientes');
    }

    const datos = aprobacion.datosSolicitud as Record<string, any>;

    // Aplicar la nueva fecha a la cuota
    await this.prisma.cuota.update({
      where: { id: datos.cuotaId || aprobacion.referenciaId },
      data: { fechaVencimiento: new Date(datos.nuevaFecha.includes('T') ? datos.nuevaFecha : datos.nuevaFecha + 'T12:00:00.000Z') },
    });

    // Actualizar estado de la aprobación
    await this.prisma.aprobacion.update({
      where: { id: aprobacionId },
      data: {
        estado: EstadoAprobacion.APROBADO,
        aprobadoPorId,
        revisadoEn: new Date(),
      },
    });

    // Notificar al cobrador que solicitó
    await this.notificacionesService.create({
      usuarioId: aprobacion.solicitadoPorId,
      titulo: 'Reprogramacion aprobada',
      mensaje: `La reprogramacion de la cuota del cliente ${datos.clienteNombre} al ${datos.nuevaFecha} fue APROBADA.`,
      tipo: 'REPROGRAMACION_APROBADA',
      entidad: 'Aprobacion',
      entidadId: aprobacionId,
    });

    // Avisar a todos los componentes que recarguen datos
    this.notificacionesGateway.broadcastRutasActualizadas();
    this.notificacionesGateway.broadcastDashboardsActualizados();
    this.notificacionesGateway.broadcastPrestamosActualizados();
    this.notificacionesGateway.broadcastAprobacionesActualizadas();

    return { mensaje: 'Reprogramación aprobada y aplicada exitosamente' };
  }

  /**
   * SUPERVISOR/ADMIN rechaza una reprogramación.
   */
  async rechazarReprogramacion(aprobacionId: string, rechazadoPorId: string, comentarios?: string) {
    const aprobacion = await this.prisma.aprobacion.findUnique({ where: { id: aprobacionId } });
    if (!aprobacion) throw new NotFoundException('Solicitud no encontrada');
    if (aprobacion.estado !== EstadoAprobacion.PENDIENTE) {
      throw new BadRequestException('Solo se pueden rechazar solicitudes pendientes');
    }

    const datos = aprobacion.datosSolicitud as Record<string, any>;

    await this.prisma.aprobacion.update({
      where: { id: aprobacionId },
      data: {
        estado: EstadoAprobacion.RECHAZADO,
        aprobadoPorId: rechazadoPorId,
        revisadoEn: new Date(),
        comentarios: comentarios || null,
      },
    });

    // Notificar al cobrador
    await this.notificacionesService.create({
      usuarioId: aprobacion.solicitadoPorId,
      titulo: 'Reprogramacion rechazada',
      mensaje: `La reprogramacion de la cuota del cliente ${datos.clienteNombre} fue RECHAZADA.${comentarios ? ` Motivo: ${comentarios}` : ''}`,
      tipo: 'REPROGRAMACION_RECHAZADA',
      entidad: 'Aprobacion',
      entidadId: aprobacionId,
    });

    // Actualizar vistas (revisiones, etc)
    this.notificacionesGateway.broadcastAprobacionesActualizadas();

    return { mensaje: 'Reprogramación rechazada' };
  }

  /**
   * Exportar cartera de préstamos en Excel o PDF.
   * Utiliza la plantilla completa cartera-creditos.template.ts
   */
  async exportLoans(
    format: 'excel' | 'pdf',
    filters: { estado?: string; ruta?: string; search?: string }
  ) {
    const rawLoans = await this.getAllLoans({
      estado: filters.estado || 'todos',
      ruta: filters.ruta || 'todas',
      search: filters.search || '',
      limit: 999999, // Traer todos para exportar
    });

    const prestamos = rawLoans.prestamos;
    
    // Calcular totales para la plantilla basados exactamente en lo que se va a mostrar
    const totales: CarteraTotales = {
      montoTotal:      prestamos.reduce((sum, p) => sum + (p.montoTotal || 0), 0),
      montoPendiente:  prestamos.reduce((sum, p) => sum + (p.montoPendiente || 0), 0),
      montoPagado:     prestamos.reduce((sum, p) => sum + (p.montoPagado || 0), 0),
      totalAdeudado:   prestamos.reduce((sum, p) => sum + ((p.montoPendiente || 0) + (p.moraAcumulada || 0)), 0),
      interesRecogido: 0, // Se mantiene 0 por ahora según lógica actual
      mora:            prestamos.reduce((sum, p) => sum + (p.moraAcumulada || 0), 0),
      recaudo:         prestamos.reduce((sum, p) => sum + (p.montoPagado || 0) + (p.moraAcumulada || 0), 0),
      totalRegistros:  prestamos.length,
    };

    const filas: CarteraRow[] = prestamos.map(p => ({
      numeroPrestamo: p.numeroPrestamo,
      cliente:        p.cliente,
      dni:            p.clienteDni,
      producto:       p.producto,
      estado:         p.estado,
      montoTotal:     p.montoTotal,
      montoPendiente: p.montoPendiente,
      montoPagado:    p.montoPagado,
      interesRecogido: 0,
      totalAdeudado:  p.montoPendiente + p.moraAcumulada,
      mora:           p.moraAcumulada,
      recaudo:        p.montoPagado + p.moraAcumulada, // Consistente con el recaudo total
      cuotasPagadas:  p.cuotasPagadas,
      cuotasTotales:  p.cuotasTotales,
      progreso:       p.progreso,
      riesgo:         p.riesgo,
      ruta:           p.rutaNombre,
      cobrador:       p.vendedor,
      fechaInicio:    p.fechaInicio,
      fechaFin:       p.fechaFin,
    }));

    const fechaStr = getBogotaDayKey(new Date());

    if (format === 'excel') {
      return generarExcelCartera(filas, totales, fechaStr);
    } else {
      return generarPDFCartera(filas, totales, fechaStr);
    }
  }
}
