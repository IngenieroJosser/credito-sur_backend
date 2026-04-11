import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; 
import { EstadoAprobacion } from '@prisma/client';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import {
  PrestamosMoraFiltrosDto,
  TotalesMoraDto,
  PrestamoMoraDto,
} from './dto/prestamo-mora.dto';
import { PrestamosMoraResponseDto } from './dto/responses.dto';
import { differenceInDays, format } from 'date-fns';
import {
  TotalesVencidasDto,
  DecisionCastigoDto,
  CuentasVencidasFiltrosDto,
  CuentaVencidaDto,
} from './dto/cuentas-vencidas.dto';
import { CuentasVencidasResponseDto } from './dto/responses-cuentas-vencidas.dto';
import { TipoAprobacion, EstadoPrestamo } from '@prisma/client';
import { GetOperationalReportDto } from './dto/get-operational-report.dto';
import {
  OperationalReportResponse,
  RoutePerformanceDetail,
} from './dto/responses-routes.dto';
import { TimeFilterPeriod, calculateDateRange, getBogotaDayKey, getBogotaStartEndOfDay } from '../utils/date-utils';
import { RoutesService } from '../routes/routes.service';
import { generarExcelMora, generarPDFMora, MoraRow, MoraTotales } from '../templates/exports/cuentas-mora.template';
import { generarExcelVencidas, generarPDFVencidas, VencidasRow, VencidasTotales } from '../templates/exports/cuentas-vencidas.template';
import { generarExcelOperativo, generarPDFOperativo, OperativoRow, OperativoResumen } from '../templates/exports/reporte-operativo.template';
import { generarExcelFinanciero, generarPDFFinanciero } from '../templates/exports/reporte-financiero.template';


@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacionesService: NotificacionesService,
    private readonly routesService: RoutesService,
  ) {}

  async getFinancialSummary(startDate: Date, endDate: Date) {
    const { endDate: end } = getBogotaStartEndOfDay(endDate);

    const ingresosResult = await this.prisma.pago.aggregate({
      _sum: { montoTotal: true },
      where: {
        fechaPago: {
          gte: startDate,
          lte: end,
        },
      },
    });

    const egresosResult = await this.prisma.gasto.aggregate({
      _sum: { monto: true },
      where: {
        fechaGasto: {
          gte: startDate,
          lte: end,
        },
        estadoAprobacion: EstadoAprobacion.APROBADO,
      },
    });

    const ingresos = Number(ingresosResult._sum.montoTotal || 0);
    const egresos = Number(egresosResult._sum.monto || 0);
    const utilidad = ingresos - egresos;
    const margen = ingresos > 0 ? (utilidad / ingresos) * 100 : 0;

    return {
      ingresos,
      egresos,
      utilidad,
      margen: Number(margen.toFixed(2)),
    };
  }

  async getMonthlyEvolution(year: number) {
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59);

    const pagos = await this.prisma.pago.findMany({
      where: {
        fechaPago: { gte: startOfYear, lte: endOfYear },
      },
      select: { fechaPago: true, montoTotal: true },
    });

    const gastos = await this.prisma.gasto.findMany({
      where: {
        fechaGasto: { gte: startOfYear, lte: endOfYear },
        estadoAprobacion: EstadoAprobacion.APROBADO,
      },
      select: { fechaGasto: true, monto: true },
    });

    const months = Array.from({ length: 12 }, (_, i) => ({
      mes: new Date(year, i).toLocaleString('es-ES', { month: 'short' }),
      ingresos: 0,
      egresos: 0,
      utilidad: 0,
    }));

    pagos.forEach((p) => {
      const month = p.fechaPago.getMonth();
      months[month].ingresos += Number(p.montoTotal);
    });

    gastos.forEach((g) => {
      const month = g.fechaGasto.getMonth();
      months[month].egresos += Number(g.monto);
    });

    months.forEach((m) => {
      m.utilidad = m.ingresos - m.egresos;
    });

    return months;
  }

  async getExpenseDistribution(startDate: Date, endDate: Date) {
    const { endDate: end } = getBogotaStartEndOfDay(endDate);

    const gastos = await this.prisma.gasto.groupBy({
      by: ['tipoGasto'],
      _sum: { monto: true },
      where: {
        fechaGasto: { gte: startDate, lte: end },
        estadoAprobacion: EstadoAprobacion.APROBADO,
      },
    });

    return gastos.map((g) => ({
      categoria: g.tipoGasto,
      monto: Number(g._sum.monto || 0),
    }));
  }

  async getFinancialTargets() {
    const envValue =
      process.env.REPORTS_META_MARGEN ||
      process.env.META_MARGEN ||
      process.env.NEXT_PUBLIC_META_MARGEN;
    if (
      typeof envValue === 'undefined' ||
      envValue === null ||
      envValue === ''
    ) {
      return { metaMargen: null };
    }
    const parsed = parseFloat(envValue);
    const metaMargen = Number.isFinite(parsed) ? parsed : null;
    return { metaMargen };
  }

  async obtenerPrestamosEnMora(
    filtros: PrestamosMoraFiltrosDto,
    pagina: number = 1,
    limite: number = 50,
  ): Promise<PrestamosMoraResponseDto> {
    const skip = (pagina - 1) * limite;

    const { startDate: hoyInicioBogota } = getBogotaStartEndOfDay(new Date());
    const hoyKeyBogota = getBogotaDayKey(new Date());

    const utcDateKey = (d: Date): string => {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const whereConditions: any = {
      estado: { in: ['EN_MORA', 'ACTIVO'] },
    };

    // Nota importante:
    // Las fechas de vencimiento en BD pueden estar guardadas en UTC 00:00:00,
    // lo cual al convertirlas a Bogotá podría “correr” al día anterior y generar
    // falsos positivos. Por eso aquí SOLO filtramos por estado VENCIDA en Prisma
    // y aplicamos la regla de "vencida si fechaKey < hoyKeyBogota" en memoria.
    whereConditions.OR = [
      { estado: 'EN_MORA' },
      { cuotas: { some: { estado: { in: ['VENCIDA'] } } } },
    ];

    // Aplicar filtros
    if (filtros.busqueda) {
      whereConditions.OR = [
        {
          cliente: {
            nombres: {
              contains: filtros.busqueda,
              mode: 'insensitive',
            },
          },
        },
        {
          cliente: {
            apellidos: {
              contains: filtros.busqueda,
              mode: 'insensitive',
            },
          },
        },
        {
          cliente: {
            dni: {
              contains: filtros.busqueda,
              mode: 'insensitive',
            },
          },
        },
        {
          numeroPrestamo: {
            contains: filtros.busqueda,
            mode: 'insensitive',
          },
        },
      ];
    }

    if (filtros.nivelRiesgo) {
      whereConditions.cliente = {
        ...whereConditions.cliente,
        nivelRiesgo: filtros.nivelRiesgo,
      };
    }

    if (filtros.rutaId) {
      const clientesRuta = await this.prisma.asignacionRuta.findMany({
        where: {
          rutaId: filtros.rutaId,
          activa: true,
        },
        select: { clienteId: true },
      });

      const clienteIds = clientesRuta.map((cr) => cr.clienteId);
      whereConditions.clienteId = { in: clienteIds };
    }

    if (filtros.cobradorId) {
      const rutasCobrador = await this.prisma.ruta.findMany({
        where: {
          cobradorId: filtros.cobradorId,
          activa: true,
        },
        select: { id: true },
      });

      const rutaIds = rutasCobrador.map((rc) => rc.id);
      const clientesRuta = await this.prisma.asignacionRuta.findMany({
        where: {
          rutaId: { in: rutaIds },
          activa: true,
        },
        select: { clienteId: true },
      });

      const clienteIds = clientesRuta.map((cr) => cr.clienteId);
      whereConditions.clienteId = { in: clienteIds };
    }

    // Obtener total bruto de registros (antes del filtro en memoria)
    const _totalRaw = await this.prisma.prestamo.count({
      where: whereConditions,
    });

    // Obtener préstamos con relaciones
    const prestamos = await this.prisma.prestamo.findMany({
      where: whereConditions,
      skip,
      take: limite,
      include: {
        cliente: true,
        cuotas: {
          where: {
            estado: { in: ['VENCIDA'] },
          },
          orderBy: {
            fechaVencimiento: 'asc',
          },
        },
        pagos: {
          orderBy: {
            fechaPago: 'desc',
          },
          take: 1,
        },
        extensiones: {
          orderBy: { id: 'desc' },
          take: 1,
        },
      },
      orderBy: [
        {
          cliente: {
            nivelRiesgo: 'desc',
          },
        },
        {
          saldoPendiente: 'desc',
        },
      ],
    });

    // Enriquecer datos con información de ruta y cobrador
    const prestamosEnriquecidosRaw = await Promise.all(
      prestamos.map(async (prestamo) => {
        // Obtener asignación de ruta activa del cliente
        const asignacion = await this.prisma.asignacionRuta.findFirst({
          where: {
            clienteId: prestamo.clienteId,
            activa: true,
          },
          include: {
            ruta: {
              include: {
                cobrador: true,
              },
            },
          },
        });

        const cuotas = (prestamo as any)?.cuotas || [];
        const cuotasVencidas = cuotas.filter((c: any) => {
          const eff = c?.fechaVencimientoProrroga
            ? new Date(c.fechaVencimientoProrroga)
            : new Date(c.fechaVencimiento);
          if (!eff || isNaN(eff.getTime())) return false;
          const key = utcDateKey(eff);
          return !!key && key < hoyKeyBogota;
        });

        const cuotaMasAntigua = cuotasVencidas.reduce((acc: any, c: any) => {
          const eff = c?.fechaVencimientoProrroga
            ? new Date(c.fechaVencimientoProrroga)
            : new Date(c.fechaVencimiento);
          if (!acc) return { cuota: c, eff };
          return eff < acc.eff ? { cuota: c, eff } : acc;
        }, null as null | { cuota: any; eff: Date });

        const diasMora = cuotaMasAntigua?.eff
          ? Math.max(0, differenceInDays(hoyInicioBogota, cuotaMasAntigua.eff))
          : 0;

        // Calcular monto de mora (suma de intereses de mora de cuotas vencidas)
        const montoMora = cuotasVencidas.reduce(
          (sum, cuota) => sum + cuota.montoInteresMora.toNumber(),
          0,
        );

        // Obtener último pago
        const ultimoPago = prestamo.pagos[0];

        // Prorroga activa: la extension mas reciente
        const extension = (prestamo as any).extensiones?.[0];
        const fechaProrroga = extension?.nuevaFechaVencimiento
          ? format(new Date(extension.nuevaFechaVencimiento), 'yyyy-MM-dd')
          : undefined;
        const diasProrroga = extension?.nuevaFechaVencimiento
          ? Math.ceil((new Date(extension.nuevaFechaVencimiento).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : undefined;

        const tieneMoraReal = cuotasVencidas.length > 0 || diasMora > 0 || montoMora > 0;
        // Excluir falsos positivos (incluye casos donde el préstamo quedó EN_MORA
        // por un error histórico o por cuotas que vencen HOY).
        if (!tieneMoraReal) return null;

        return {
          id: prestamo.id,
          numeroPrestamo: prestamo.numeroPrestamo,
          clienteId: prestamo.clienteId,
          cliente: {
            id: prestamo.clienteId,
            nombre: `${prestamo.cliente.nombres} ${prestamo.cliente.apellidos}`,
            documento: prestamo.cliente.dni,
            telefono: prestamo.cliente.telefono,
            direccion: prestamo.cliente.direccion || '',
          },
          diasMora,
          montoMora,
          montoTotalDeuda: prestamo.saldoPendiente.toNumber(),
          montoOriginal: prestamo.monto.toNumber(),
          cuotasVencidas: cuotasVencidas.length,
          ruta: asignacion?.ruta?.nombre || 'Sin asignar',
          cobrador: asignacion?.ruta?.cobrador
            ? `${asignacion.ruta.cobrador.nombres} ${asignacion.ruta.cobrador.apellidos}`
            : 'Sin asignar',
          nivelRiesgo: prestamo.cliente.nivelRiesgo,
          estado: prestamo.estado,
          ultimoPago: ultimoPago
            ? format(ultimoPago.fechaPago, 'yyyy-MM-dd')
            : undefined,
          fechaVencimiento: format(prestamo.fechaFin, 'yyyy-MM-dd'),
          // Extension de pago (prorroga)
          fechaProrroga,
          diasProrroga,
          tieneProrroga: !!extension,
        } as PrestamoMoraDto;
      }),
    );

    const prestamosEnriquecidos = prestamosEnriquecidosRaw.filter(Boolean) as PrestamoMoraDto[];
    const total = prestamosEnriquecidos.length;

    // Calcular totales
    const totalMora = prestamosEnriquecidos.reduce(
      (sum, p) => sum + p.montoMora,
      0,
    );
    const totalDeuda = prestamosEnriquecidos.reduce(
      (sum, p) => sum + p.montoTotalDeuda,
      0,
    );
    const totalCasosCriticos = prestamosEnriquecidos.filter(
      (p) => p.nivelRiesgo === 'ROJO' || p.nivelRiesgo === 'LISTA_NEGRA',
    ).length;

    const totales: TotalesMoraDto = {
      totalMora,
      totalDeuda,
      totalCasosCriticos,
      totalRegistros: total,
    };

    return {
      prestamos: prestamosEnriquecidos,
      totales,
      total,
      pagina,
      limite,
    };
  }

  async generarReporteMora(
    filtros: PrestamosMoraFiltrosDto,
    formato: 'excel' | 'pdf',
  ): Promise<{ data: Buffer; contentType: string; filename: string }> {
    // 1. Solo consulta de BD
    const data = await this.obtenerPrestamosEnMora(filtros, 1, 10000);
    const prestamos = data.prestamos;
    const fecha = getBogotaDayKey(new Date());

    // 2. Mapeo al tipo del template
    const filas: MoraRow[] = prestamos.map((p: any) => ({
      numeroPrestamo: p.numeroPrestamo || '',
      cliente: p.cliente?.nombre || '',
      documento: p.cliente?.documento || '',
      diasMora: p.diasMora || 0,
      montoMora: p.montoMora || 0,
      montoTotalDeuda: p.montoTotalDeuda || 0,
      cuotasVencidas: p.cuotasVencidas || 0,
      ruta: p.ruta || '',
      cobrador: p.cobrador || '',
      nivelRiesgo: p.nivelRiesgo || '',
      ultimoPago: p.ultimoPago,
    }));

    const totales: MoraTotales = {
      totalMora: data.totales.totalMora || 0,
      totalDeuda: data.totales.totalDeuda || 0,
      totalCasosCriticos: data.totales.totalCasosCriticos || 0,
      totalRegistros: data.totales.totalRegistros || 0,
    };

    // 3. Delegamos al template
    if (formato === 'excel') return generarExcelMora(filas, totales, fecha);
    if (formato === 'pdf') return generarPDFMora(filas, totales, fecha);

    throw new Error(`Formato no soportado: ${formato}`);
  }

  async obtenerEstadisticasMora() {
    const [
      totalPrestamosMora,
      prestamosRojos,
      prestamosListaNegra,
      moraAcumulada,
      deudaTotal,
    ] = await Promise.all([
      this.prisma.prestamo.count({
        where: { estado: 'EN_MORA' },
      }),
      this.prisma.prestamo.count({
        where: {
          estado: 'EN_MORA',
          cliente: {
            nivelRiesgo: 'ROJO',
          },
        },
      }),
      this.prisma.prestamo.count({
        where: {
          estado: 'EN_MORA',
          cliente: {
            nivelRiesgo: 'LISTA_NEGRA',
          },
        },
      }),
      this.prisma.cuota.aggregate({
        where: {
          estado: 'VENCIDA',
          prestamo: {
            estado: 'EN_MORA',
          },
        },
        _sum: {
          montoInteresMora: true,
        },
      }),
      this.prisma.prestamo.aggregate({
        where: { estado: 'EN_MORA' },
        _sum: {
          saldoPendiente: true,
        },
      }),
    ]);

    return {
      totalPrestamosMora,
      casosCriticos: prestamosRojos + prestamosListaNegra,
      moraAcumulada: moraAcumulada._sum.montoInteresMora?.toNumber() || 0,
      deudaTotal: deudaTotal._sum.saldoPendiente?.toNumber() || 0,
    };
  }

  async obtenerCuentasVencidas(
    filtros: CuentasVencidasFiltrosDto,
    pagina: number = 1,
    limite: number = 50,
  ): Promise<CuentasVencidasResponseDto> {
    const skip = (pagina - 1) * limite;
    const hoy = new Date();

    const whereConditions: any = {
      fechaFin: { lt: hoy },
      estado: { in: ['EN_MORA', 'INCUMPLIDO', 'PERDIDA'] },
      saldoPendiente: { gt: 0 },
    };

    if (filtros.busqueda) {
      whereConditions.OR = [
        { cliente: { nombres: { contains: filtros.busqueda, mode: 'insensitive' } } },
        { cliente: { apellidos: { contains: filtros.busqueda, mode: 'insensitive' } } },
        { cliente: { dni: { contains: filtros.busqueda, mode: 'insensitive' } } },
        { numeroPrestamo: { contains: filtros.busqueda, mode: 'insensitive' } },
      ];
    }

    if (filtros.nivelRiesgo) {
      whereConditions.cliente = { ...whereConditions.cliente, nivelRiesgo: filtros.nivelRiesgo };
    }

    if (filtros.rutaId) {
      const clientesRuta = await this.prisma.asignacionRuta.findMany({
        where: { rutaId: filtros.rutaId, activa: true },
        select: { clienteId: true },
      });
      whereConditions.clienteId = { in: clientesRuta.map((cr) => cr.clienteId) };
    }

    const total = await this.prisma.prestamo.count({ where: whereConditions });

    const prestamos = await this.prisma.prestamo.findMany({
      where: whereConditions,
      skip,
      take: limite,
      include: {
        cliente: true,
        cuotas: { where: { estado: 'VENCIDA' } },
      },
      orderBy: [{ fechaFin: 'asc' }, { saldoPendiente: 'desc' }],
    });

    const cuentasVencidas = await Promise.all(
      prestamos.map(async (prestamo) => {
        const asignacion = await this.prisma.asignacionRuta.findFirst({
          where: { clienteId: prestamo.clienteId, activa: true },
          include: { ruta: { include: { cobrador: true } } },
        });

        const diasVencidos = differenceInDays(hoy, prestamo.fechaFin);
        const interesesMora = prestamo.cuotas.reduce((sum, cuota) => sum + cuota.montoInteresMora.toNumber(), 0);

        return {
          id: prestamo.id,
          numeroPrestamo: prestamo.numeroPrestamo,
          cliente: {
            nombre: `${prestamo.cliente.nombres} ${prestamo.cliente.apellidos}`,
            documento: prestamo.cliente.dni,
            telefono: prestamo.cliente.telefono,
            direccion: prestamo.cliente.direccion || '',
          },
          fechaVencimiento: format(prestamo.fechaFin, 'yyyy-MM-dd'),
          diasVencidos,
          saldoPendiente: prestamo.saldoPendiente.toNumber(),
          montoOriginal: prestamo.monto.toNumber(),
          ruta: asignacion?.ruta?.nombre || 'Sin asignar',
          nivelRiesgo: prestamo.cliente.nivelRiesgo,
          estado: prestamo.estado,
          interesesMora,
        } as CuentaVencidaDto & { interesesMora: number };
      }),
    );

    const totales: TotalesVencidasDto = {
      totalVencido: cuentasVencidas.reduce((sum, c) => sum + c.saldoPendiente, 0),
      totalRegistros: total,
      diasPromedioVencimiento: cuentasVencidas.length > 0
        ? Math.round(cuentasVencidas.reduce((sum, c) => sum + c.diasVencidos, 0) / cuentasVencidas.length)
        : 0,
      totalInteresesMora: cuentasVencidas.reduce((s, c: any) => s + (c.interesesMora || 0), 0),
      totalMontoOriginal: cuentasVencidas.reduce((s, c: any) => s + (c.montoOriginal || 0), 0),
    };

    return { cuentas: cuentasVencidas, totales, total, pagina, limite };
  }

  async procesarDecisionCastigo(
    decisionDto: DecisionCastigoDto,
    usuarioId: string,
  ) {
    const prestamo = await this.prisma.prestamo.findUnique({
      where: { id: decisionDto.prestamoId },
      include: { cliente: true },
    });

    if (!prestamo) {
      throw new Error('PrÃ©stamo no encontrado');
    }

    let cuotaId: string | null = null;
    if (decisionDto.decision === 'PRORROGAR') {
      const cuotaVencida = await this.prisma.cuota.findFirst({
        where: {
          prestamoId: decisionDto.prestamoId,
          estado: { in: ['VENCIDA', 'PENDIENTE'] },
        },
        orderBy: { numeroCuota: 'asc' },
      });
      cuotaId = cuotaVencida?.id || null;
    }

    let tipoAprobacion: TipoAprobacion;
    if (decisionDto.decision === 'PRORROGAR' || decisionDto.decision === 'DEJAR_QUIETO') {
      tipoAprobacion = TipoAprobacion.PRORROGA_PAGO;
    } else {
      tipoAprobacion = TipoAprobacion.BAJA_POR_PERDIDA;
    }

    const aprobacion = await this.prisma.aprobacion.create({
      data: {
        tipoAprobacion,
        referenciaId: decisionDto.prestamoId,
        tablaReferencia: 'Prestamo',
        solicitadoPorId: usuarioId,
        datosSolicitud: {
          decision: decisionDto.decision,
          montoInteres: decisionDto.montoInteres || 0,
          comentarios: decisionDto.comentarios,
          nuevaFechaVencimiento: decisionDto.nuevaFechaVencimiento,
          prestamoId: decisionDto.prestamoId,
          cuotaId,
          fechaVencimientoOriginal: prestamo.fechaFin,
          clienteNombre: `${prestamo.cliente.nombres} ${prestamo.cliente.apellidos}`,
          saldoPendiente: prestamo.saldoPendiente.toNumber(),
          numeroPrestamo: prestamo.numeroPrestamo,
          diasGracia: decisionDto.diasGracia,
        },
        montoSolicitud: decisionDto.montoInteres || 0,
      },
    });

    let nombreUsuario = 'Usuario';
    try {
      const u = await this.prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: { nombres: true, apellidos: true },
      });
      if (u) nombreUsuario = `${u.nombres} ${u.apellidos}`.trim() || nombreUsuario;
    } catch {}

    if (decisionDto.decision !== 'PRORROGAR') {
      try {
        await this.notificacionesService.notifyApprovers({
          titulo: 'Solicitud requiere aprobacion',
          mensaje: `${nombreUsuario} solicito ${decisionDto.decision.toLowerCase()} para el prestamo ${prestamo.numeroPrestamo} (${prestamo.cliente.nombres} ${prestamo.cliente.apellidos}).`,
          tipo: 'WARNING',
          entidad: 'Aprobacion',
          entidadId: aprobacion.id,
          metadata: {
            tipoAprobacion: tipoAprobacion,
            prestamoId: decisionDto.prestamoId,
            decision: decisionDto.decision,
            montoInteres: decisionDto.montoInteres || 0,
          },
        });
      } catch {}

      try {
        await this.notificacionesService.create({
          usuarioId,
          titulo: 'Solicitud enviada',
          mensaje: 'Tu solicitud fue enviada y quedo pendiente de aprobacion.',
          tipo: 'INFORMATIVO',
          entidad: 'Aprobacion',
          entidadId: aprobacion.id,
          metadata: {
            tipoAprobacion: tipoAprobacion,
            prestamoId: decisionDto.prestamoId,
            decision: decisionDto.decision,
          },
        });
      } catch {}
    }

    return {
      mensaje: `Decisión de ${decisionDto.decision.toLowerCase()} procesada exitosamente`,
      aprobacionId: aprobacion.id,
      nuevoEstado: prestamo.estado,
    };
  }

  async exportarCuentasVencidas(
    formato: 'excel' | 'pdf',
    filtros: CuentasVencidasFiltrosDto,
  ): Promise<{ data: Buffer; contentType: string; filename: string }> {
    const data = await this.obtenerCuentasVencidas(filtros, 1, 10000);
    const cuentas = data.cuentas;
    const fecha = getBogotaDayKey(new Date());

    const filas: VencidasRow[] = cuentas.map((c: any) => ({
      numeroPrestamo: c.numeroPrestamo || '',
      cliente: typeof c.cliente === 'string' ? c.cliente : (c.cliente?.nombre || ''),
      documento: typeof c.cliente === 'object' ? (c.cliente?.documento || '') : '',
      fechaVencimiento: c.fechaVencimiento || '',
      diasVencidos: Number(c.diasVencidos || 0),
      saldoPendiente: Number(c.saldoPendiente || 0),
      montoOriginal: Number(c.montoOriginal || 0),
      interesesMora: Number(c.interesesMora || 0),
      nivelRiesgo: c.nivelRiesgo || '',
      ruta: c.ruta || '',
      estado: c.estado || '',
    }));

    const totales: VencidasTotales = {
      totalVencido: Number(data.totales?.totalVencido || 0),
      diasPromedioVencimiento: Number(data.totales?.diasPromedioVencimiento || 0),
      totalRegistros: Number(data.totales?.totalRegistros || 0),
      totalInteresesMora: Number(data.totales?.totalInteresesMora || 0),
      totalMontoOriginal: Number(data.totales?.totalMontoOriginal || 0),
    };

    if (formato === 'excel') return generarExcelVencidas(filas, totales, fecha);
    if (formato === 'pdf') return generarPDFVencidas(filas, totales, fecha);

    throw new Error(`Formato no soportado: ${formato}`);
  }

  async getOperationalReport(
    filters: GetOperationalReportDto,
  ): Promise<OperationalReportResponse> {
    const { period, routeId, startDate, endDate } = filters;

    // Para el reporte diario, el objetivo debe ser la meta REAL del día por ruta,
    // igual a la vista del listado de rutas (metaDelDia/cobranzaDelDia/avanceDiario).
    // Esto evita discrepancias y hace que el objetivo tenga sentido operativo.
    if (period === 'today') {
      const rutasListado = await this.routesService.findAll({ activa: true });
      const rutas = (rutasListado as any)?.data || [];

      const rutasFiltradas = routeId ? rutas.filter((r: any) => r.id === routeId) : rutas;
      const { startDate: hoyInicio, endDate: hoyFin } = getBogotaStartEndOfDay(new Date());

      const rendimientoRutas: RoutePerformanceDetail[] = await Promise.all(
        rutasFiltradas.map(async (r: any) => {
          const nuevosPrestamosAgg = await this.prisma.prestamo.aggregate({
            where: {
              creadoEn: { gte: hoyInicio, lte: hoyFin },
              eliminadoEn: null,
              estado: { in: [EstadoPrestamo.ACTIVO, EstadoPrestamo.EN_MORA, EstadoPrestamo.PAGADO] },
              cliente: {
                asignacionesRuta: { some: { rutaId: r.id, activa: true } },
              },
            },
            _sum: { monto: true },
            _count: { id: true },
          });

          const nuevosPrestamos = nuevosPrestamosAgg._count.id || 0;
          const montoNuevosPrestamos = Number(nuevosPrestamosAgg._sum.monto || 0);

          const nuevosClientes = await this.prisma.cliente.count({
            where: {
              creadoEn: { gte: hoyInicio, lte: hoyFin },
              asignacionesRuta: { some: { rutaId: r.id, activa: true } },
            },
          });

          return {
            id: r.id,
            ruta: r.nombre,
            cobrador: r.cobrador,
            cobradorId: r.cobradorId,
            meta: Number(r.metaDelDia || 0),
            recaudado: Number(r.cobranzaDelDia || 0),
            eficiencia: Number(r.avanceDiario || 0),
            nuevosPrestamos,
            nuevosClientes,
            montoNuevosPrestamos,
          } as any;
        }),
      );

      const totalRecaudo = rendimientoRutas.reduce((sum, rr: any) => sum + Number(rr.recaudado || 0), 0);
      const totalMeta = rendimientoRutas.reduce((sum, rr: any) => sum + Number(rr.meta || 0), 0);
      const porcentajeGlobal = totalMeta > 0 ? Math.round((totalRecaudo / totalMeta) * 100) : 0;

      const totalPrestamosNuevos = rendimientoRutas.reduce((sum, rr: any) => sum + Number(rr.nuevosPrestamos || 0), 0);
      const totalAfiliaciones = rendimientoRutas.reduce((sum, rr: any) => sum + Number(rr.nuevosClientes || 0), 0);
      const totalMontoPrestamosNuevos = rendimientoRutas.reduce(
        (sum, rr: any) => sum + Number(rr.montoNuevosPrestamos || 0),
        0,
      );
      const efectividadPromedio =
        rendimientoRutas.length > 0
          ? Math.round(rendimientoRutas.reduce((sum, rr: any) => sum + Number(rr.eficiencia || 0), 0) / rendimientoRutas.length)
          : 0;

      return {
        totalRecaudo,
        totalMeta,
        porcentajeGlobal,
        totalPrestamosNuevos,
        totalAfiliaciones,
        efectividadPromedio,
        totalMontoPrestamosNuevos,
        rendimientoRutas,
        periodo: period,
        fechaInicio: hoyInicio,
        fechaFin: hoyFin,
      };
    }

    const dateRange = calculateDateRange(
      period as TimeFilterPeriod,
      startDate,
      endDate,
    );

    const routes = await this.prisma.ruta.findMany({
      where: {
        ...(routeId && { id: routeId }),
        activa: true,
      },
      include: {
        cobrador: {
          select: {
            id: true,
            nombres: true,
            apellidos: true,
          },
        },
        asignaciones: {
          include: {
            cliente: true,
          },
        },
      },
    });

    const routePerformancePromises = routes.map(async (route) => {
      const clientIds = route.asignaciones.map((a) => a.cliente.id);

      const routePayments = await this.prisma.pago.aggregate({
        where: {
          clienteId: { in: clientIds },
          fechaPago: {
            gte: dateRange.startDate,
            lte: dateRange.endDate,
          },
        },
        _sum: { montoTotal: true },
      });

      const collected = Number(routePayments._sum.montoTotal || 0);

      const routeNewLoansStats = await this.prisma.prestamo.aggregate({
        where: {
          clienteId: { in: clientIds },
          creadoEn: {
            gte: dateRange.startDate,
            lte: dateRange.endDate,
          },
          estado: { in: ['ACTIVO', 'EN_MORA', 'PAGADO'] },
        },
        _sum: {
          monto: true,
          cuotaInicial: true,
        },
        _count: { id: true },
      });

      const newLoans = routeNewLoansStats._count.id || 0;
      const newLoansAmount = Number(routeNewLoansStats._sum.monto || 0);
      const collectedFromCuotaInicial = Number(routeNewLoansStats._sum.cuotaInicial || 0);

      const newClients = await this.prisma.cliente.count({
        where: {
          asignacionesRuta: {
            some: { rutaId: route.id },
          },
          creadoEn: {
            gte: dateRange.startDate,
            lte: dateRange.endDate,
          },
        },
      });

      const routeDuePayments = await this.prisma.cuota.aggregate({
        where: {
          prestamo: {
            clienteId: { in: clientIds },
            estado: { in: ['ACTIVO', 'EN_MORA'] },
          },
          OR: [
            {
              fechaVencimiento: {
                gte: dateRange.startDate,
                lte: dateRange.endDate,
              },
            },
            {
              estado: { in: ['PENDIENTE', 'PARCIAL', 'VENCIDA'] },
              fechaVencimiento: { lt: dateRange.startDate },
            },
            {
              estado: 'PAGADA',
              fechaVencimiento: { lt: dateRange.startDate },
              fechaPago: {
                gte: dateRange.startDate,
                lte: dateRange.endDate,
              },
            },
          ],
        },
        _sum: {
          monto: true,
          montoInteresMora: true,
        },
      });

      const target = Number(routeDuePayments._sum.monto || 0) + 
                    Number(routeDuePayments._sum.montoInteresMora || 0) + 
                     collectedFromCuotaInicial;

      const efficiency =
        target > 0 ? Math.round(((collected + collectedFromCuotaInicial) / target) * 100) : 0;

      return {
        id: route.id,
        ruta: route.nombre,
        cobrador: `${route.cobrador.nombres} ${route.cobrador.apellidos}`,
        cobradorId: route.cobrador.id,
        meta: target,
        recaudado: collected + collectedFromCuotaInicial,
        eficiencia: efficiency,
        nuevosPrestamos: newLoans,
        nuevosClientes: newClients,
        montoNuevosPrestamos: newLoansAmount,
      } as any;
    });

    const routePerformance = await Promise.all(routePerformancePromises);

    const globalPayments = await this.prisma.pago.aggregate({
      where: {
        fechaPago: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      },
      _sum: { montoTotal: true },
    });

    const globalNewLoansStats = await this.prisma.prestamo.aggregate({
      where: {
        creadoEn: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
        estado: { in: ['ACTIVO', 'EN_MORA', 'PAGADO'] },
      },
      _sum: {
        monto: true,
        cuotaInicial: true,
      },
      _count: { id: true }
    });

    const totalRecaudo = Number(globalPayments._sum.montoTotal || 0) + Number(globalNewLoansStats._sum.cuotaInicial || 0);
    const totalMontoPrestamosNuevos = Number(globalNewLoansStats._sum.monto || 0);
    const totalPrestamosNuevos = globalNewLoansStats._count.id || 0;

    const globalDuePayments = await this.prisma.cuota.aggregate({
      where: {
        prestamo: {
          estado: { in: ['ACTIVO', 'EN_MORA'] },
        },
        OR: [
          {
            fechaVencimiento: {
              gte: dateRange.startDate,
              lte: dateRange.endDate,
            },
          },
          {
            estado: { in: ['PENDIENTE', 'PARCIAL', 'VENCIDA'] },
            fechaVencimiento: { lt: dateRange.startDate },
          },
          {
            estado: 'PAGADA',
            fechaVencimiento: { lt: dateRange.startDate },
            fechaPago: {
              gte: dateRange.startDate,
              lte: dateRange.endDate,
            },
          },
        ],
      },
      _sum: {
        monto: true,
        montoInteresMora: true,
      },
    });

    const totalMeta = Number(globalDuePayments._sum.monto || 0) + 
                     Number(globalDuePayments._sum.montoInteresMora || 0) + 
                     Number(globalNewLoansStats._sum.cuotaInicial || 0);

    const porcentajeGlobal = totalMeta > 0 ? Math.round((totalRecaudo / totalMeta) * 100) : 0;

    const totalAfiliaciones = await this.prisma.cliente.count({
      where: {
        creadoEn: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      },
    });

    const efectividadPromedio =
      routePerformance.length > 0
        ? Math.round(
            routePerformance.reduce((sum, r) => sum + (r.eficiencia || 0), 0) /
              routePerformance.length,
          )
        : 0;

    return {
      totalRecaudo,
      totalMeta,
      porcentajeGlobal,
      totalPrestamosNuevos,
      totalAfiliaciones,
      efectividadPromedio,
      totalMontoPrestamosNuevos,
      rendimientoRutas: routePerformance,
      periodo: period,
      fechaInicio: dateRange.startDate,
      fechaFin: dateRange.endDate,
    };
  }

  async getRouteDetail(routeId: string, filters: any) {
    const route = await this.prisma.ruta.findUnique({
      where: { id: routeId },
      include: {
        cobrador: {
          select: {
            id: true,
            nombres: true,
            apellidos: true,
            telefono: true,
          },
        },
        supervisor: {
          select: {
            id: true,
            nombres: true,
            apellidos: true,
          },
        },
      },
    });

    if (!route) {
      throw new NotFoundException(`Ruta con ID ${routeId} no encontrada`);
    }

    const dateRange = calculateDateRange(
      filters.period as TimeFilterPeriod,
      filters.startDate,
      filters.endDate,
    );

    const assignments = await this.prisma.asignacionRuta.findMany({
      where: {
        rutaId: routeId,
        activa: true,
      },
      include: {
        cliente: {
          include: {
            prestamos: {
              where: {
                estado: 'ACTIVO',
              },
              include: {
                cuotas: {
                  where: {
                    fechaVencimiento: {
                      gte: dateRange.startDate,
                      lte: dateRange.endDate,
                    },
                  },
                  orderBy: {
                    fechaVencimiento: 'asc',
                  },
                },
              },
            },
          },
        },
      },
    });

    const clientIds = assignments.map((a) => a.cliente.id);
    const payments = await this.prisma.pago.findMany({
      where: {
        clienteId: { in: clientIds },
        fechaPago: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      },
      include: {
        cliente: {
          select: {
            nombres: true,
            apellidos: true,
          },
        },
        detalles: {
          include: {
            cuota: true,
          },
        },
      },
      orderBy: {
        fechaPago: 'desc',
      },
    });

    const totalCollected = payments.reduce(
      (sum, p) => sum + Number(p.montoTotal),
      0,
    );
    const paymentCount = payments.length;

    const paymentsByDay = await this.prisma.$queryRaw`
      SELECT 
        DATE("fechaPago") as dia,
        COUNT(*) as cantidad,
        SUM("montoTotal") as total
      FROM "pagos"
      WHERE "clienteId" IN (${clientIds.join(',')})
        AND "fechaPago" >= ${dateRange.startDate}
        AND "fechaPago" <= ${dateRange.endDate}
      GROUP BY DATE("fechaPago")
      ORDER BY dia
    `;

    return {
      ruta: {
        id: route.id,
        nombre: route.nombre,
        codigo: route.codigo,
        zona: route.zona,
        cobrador: route.cobrador,
        supervisor: route.supervisor,
      },
      periodo: {
        tipo: filters.period,
        inicio: dateRange.startDate,
        fin: dateRange.endDate,
      },
      estadisticas: {
        totalClientes: assignments.length,
        totalRecaudado: totalCollected,
        totalPagos: paymentCount,
        promedioDiario: totalCollected / Math.max(1, dateRange.days),
        pagosPorDia: paymentsByDay,
      },
      pagosRecientes: payments.slice(0, 10).map((p) => ({
        id: p.id,
        numeroPago: p.numeroPago,
        cliente: `${p.cliente.nombres} ${p.cliente.apellidos}`,
        fecha: p.fechaPago,
        monto: p.montoTotal,
        metodo: p.metodoPago,
      })),
      clientesConPrestamos: assignments
        .filter((a) => a.cliente.prestamos.length > 0)
        .map((a) => ({
          id: a.cliente.id,
          nombre: `${a.cliente.nombres} ${a.cliente.apellidos}`,
          telefono: a.cliente.telefono,
          prestamosActivos: a.cliente.prestamos.length,
          proximaCuota: a.cliente.prestamos[0]?.cuotas[0] || null,
        })),
    };
  }

  async exportOperationalReport(
    filters: GetOperationalReportDto,
    format: 'excel' | 'pdf',
  ): Promise<any> {
    const reportData = await this.getOperationalReport(filters);
    const fecha = getBogotaDayKey(new Date());

    const filas: OperativoRow[] = (reportData.rendimientoRutas || []).map((r: any) => ({
      ruta: r.ruta || '',
      cobrador: r.cobrador || '',
      meta: Number(r.meta || 0),
      recaudado: Number(r.recaudado || 0),
      eficiencia: Number(r.eficiencia || 0),
      nuevosPrestamos: Number(r.nuevosPrestamos || 0),
      nuevosClientes: Number(r.nuevosClientes || 0),
    }));

    const resumen: OperativoResumen = {
      totalRecaudo: Number(reportData.totalRecaudo || 0),
      totalMeta: Number(reportData.totalMeta || 0),
      porcentajeGlobal: Number(reportData.porcentajeGlobal || 0),
      totalPrestamosNuevos: Number(reportData.totalPrestamosNuevos || 0),
      totalAfiliaciones: Number(reportData.totalAfiliaciones || 0),
      efectividadPromedio: Number(reportData.efectividadPromedio || 0),
      periodo: String(reportData.periodo || filters.period || ''),
      fechaInicio: String(reportData.fechaInicio || filters.startDate || ''),
      fechaFin: String(reportData.fechaFin || filters.endDate || ''),
    };

    if (format === 'excel') return generarExcelOperativo(filas, resumen, fecha);
    if (format === 'pdf') return generarPDFOperativo(filas, resumen, fecha);

    throw new Error(`Formato no soportado: ${format}`);
  }

  async exportFinancialReport(
    startDate: Date,
    endDate: Date,
    format: 'excel' | 'pdf',
  ): Promise<{ data: Buffer; contentType: string; filename: string }> {
    const [summary, monthly, expenses] = await Promise.all([
      this.getFinancialSummary(startDate, endDate),
      this.getMonthlyEvolution(startDate.getFullYear()),
      this.getExpenseDistribution(startDate, endDate),
    ]);
    const fecha = getBogotaDayKey(new Date());

    if (format === 'excel') return generarExcelFinanciero(summary, monthly, expenses, fecha);
    if (format === 'pdf') return generarPDFFinanciero(summary, monthly, expenses, fecha);

    throw new Error(`Formato no soportado: ${format}`);
  }
}
