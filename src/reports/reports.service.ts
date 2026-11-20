import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EstadoAprobacion, RolUsuario, Prisma } from '@prisma/client';
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
} from './dto/cuentas-vencidas.dto';
import { CuentasVencidasResponseDto } from './dto/responses-cuentas-vencidas.dto';
import { TipoAprobacion, EstadoPrestamo } from '@prisma/client';
import {
  ReportPeriod,
  GetOperationalReportDto,
} from './dto/get-operational-report.dto';
import {
  OperationalReportResponse,
  RoutePerformanceDetail,
} from './dto/responses-routes.dto';
import {
  TimeFilterPeriod,
  calculateDateRange,
  getBogotaDayKey,
  getBogotaStartEndOfDay,
} from '../utils/date-utils';
import { RoutesService } from '../routes/routes.service';
import {
  generarExcelMora,
  generarPDFMora,
  MoraRow,
  MoraTotales,
} from '../templates/exports/cuentas-mora.template';
import {
  generarExcelVencidas,
  generarPDFVencidas,
  VencidasRow,
  VencidasTotales,
} from '../templates/exports/cuentas-vencidas.template';
import {
  generarExcelOperativo,
  generarPDFOperativo,
  OperativoRow,
  OperativoResumen,
} from '../templates/exports/reporte-operativo.template';
import {
  generarExcelFinanciero,
  generarPDFFinanciero,
} from '../templates/exports/reporte-financiero.template';

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
        /*
         * Excluir los de cierre pendiente SIN perder los de siempre.
         *
         * Esto era `NOT: { origenGestion: 'CIERRE_PENDIENTE' }`, y en SQL
         * `NOT (columna = 'X')` vale UNKNOWN cuando la columna es NULL, asi que
         * la fila NO pasa. `origenGestion` es nulo en el cobro normal de la
         * calle —medido: 84 de 85 pagos—, de modo que ese `NOT` dejaba fuera
         * CASI TODOS los pagos.
         *
         * Lo que veia el dueno: el grafico de evolucion mensual del reporte
         * financiero mostraba ingresos 0 en los DOCE meses y solo egresos, o
         * sea un negocio que pierde dinero todos los meses, habiendo 7.883.331
         * de cobranza en la base.
         *
         * Los otros siete sitios del backend que filtran por `origenGestion` ya
         * usaban esta forma; este se quedo atras.
         */
        OR: [
          { origenGestion: null },
          { origenGestion: { not: 'CIERRE_PENDIENTE' } },
        ],
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

  /**
   * Filtro de ruta según el rol del actor, para restringir los reportes a lo
   * que le corresponde SIN alterar los cálculos: solo acota el conjunto.
   *
   * - Supervisor: solo las rutas que supervisa.
   * - Cobrador: solo las suyas (asignación activa o cobrador de la ruta).
   * - Admin, coordinador, superadmin (o sin actor): sin filtro, ven todo.
   *
   * Se aplica sobre consultas de Préstamo (`{ ruta: { is: ... } }`).
   */
  private filtroRutaScopePrestamo(
    actor?: { id?: string; rol?: RolUsuario } | null,
  ): Prisma.PrestamoWhereInput {
    const rol = String(actor?.rol || '').toUpperCase();
    if (!actor?.id) return {};
    if (rol === RolUsuario.SUPERVISOR) {
      return { ruta: { is: { supervisorId: actor.id } } };
    }
    if (rol === RolUsuario.COBRADOR) {
      return {
        ruta: {
          is: {
            OR: [
              { cobradorId: actor.id },
              {
                asignaciones: { some: { activa: true, cobradorId: actor.id } },
              },
            ],
          },
        },
      };
    }
    return {};
  }

  async obtenerPrestamosEnMora(
    filtros: PrestamosMoraFiltrosDto,
    pagina: number = 1,
    limite: number = 50,
    actor?: { id?: string; rol?: RolUsuario } | null,
  ): Promise<PrestamosMoraResponseDto> {
    const skip = (pagina - 1) * limite;

    const { startDate: hoyInicioBogota } = getBogotaStartEndOfDay(new Date());
    const hoyKeyBogota = getBogotaDayKey(new Date());

    const diasMoraDiarioExcluyendoDomingos = (
      startKey: string,
      endKey: string,
    ): number => {
      // Cuenta los días transcurridos DESPUÉS del vencimiento hasta hoy inclusive,
      // excluyendo domingos (no se cobra).
      //
      // Importante: usamos llaves YYYY-MM-DD (UTC key para vencimientos + hoyKeyBogota)
      // y construimos fechas en Bogotá al mediodía para evitar desfases por zona horaria.
      if (!startKey || !endKey) return 0;
      const cur = new Date(`${startKey}T12:00:00-05:00`);
      const endD = new Date(`${endKey}T12:00:00-05:00`);
      if (isNaN(cur.getTime()) || isNaN(endD.getTime())) return 0;

      let count = 0;
      cur.setDate(cur.getDate() + 1);
      while (cur.getTime() <= endD.getTime()) {
        if (cur.getDay() !== 0) count++;
        cur.setDate(cur.getDate() + 1);
      }
      return count;
    };

    const utcDateKey = (d: Date): string => {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const whereConditions: Prisma.PrestamoWhereInput = {
      estado: { in: ['EN_MORA', 'ACTIVO'] },
      // El supervisor/cobrador solo ve la mora de sus rutas.
      ...this.filtroRutaScopePrestamo(actor),
    };

    // Nota importante:
    // No dependemos únicamente de que el job marque la cuota como VENCIDA.
    // Para el reporte (y para que sea consistente con ruta/dashboard), consideramos
    // cuotas no pagadas (PENDIENTE/PARCIAL/VENCIDA) y validamos en memoria con
    // la fecha efectiva (prórroga si existe) contra la llave Bogotá.
    whereConditions.OR = [
      { estado: 'EN_MORA' },
      {
        cuotas: {
          some: {
            estado: { in: ['PENDIENTE', 'PARCIAL', 'VENCIDA'] },
            // Filtro preliminar por fecha (evita traer demasiadas filas). Luego se valida en memoria
            // con la fecha efectiva (prórroga si existe) y la llave Bogotá.
            fechaVencimiento: { lt: hoyInicioBogota },
          },
        },
      },
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
      // Se anota el objeto: `cliente` es un `XOR` de Prisma (filtro de relacion o filtro de
      // campos), y sin la anotacion tsc elige la rama del filtro de relacion, donde
      // `nivelRiesgo` no existe.
      const filtroCliente: Prisma.ClienteWhereInput = {
        ...whereConditions.cliente,
        nivelRiesgo: filtros.nivelRiesgo,
      };
      whereConditions.cliente = filtroCliente;
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

    /*
     * Se traen TODOS los candidatos y la pagina se corta al final, despues del
     * filtro en memoria.
     *
     * Antes la consulta paginaba con `skip`/`take: limite` y el filtro de
     * `tieneMoraReal` se aplicaba DESPUES, sobre esas 50 filas. De ahi salian
     * tres cosas torcidas:
     *
     *  - `total` era el numero de supervivientes de la pagina, no del conjunto,
     *    asi que el paginador decia que habia una sola pagina;
     *  - los `totales` —deuda en riesgo y casos criticos— sumaban solo esas 50
     *    filas: con la cartera real del cliente, la pantalla habria mostrado
     *    MENOS dinero del que hay, sin avisar de nada;
     *  - y las paginas salian de tamaños distintos, porque las filas se
     *    descartaban despues de cortar.
     *
     * El contador que si mira el conjunto completo ya estaba escrito —un
     * `count` guardado en `_totalRaw`, con el guion bajo de «no se usa»— y se
     * tiraba a la basura.
     *
     * No se nota con pocos datos: hoy, en la base de desarrollo, son 41 filas
     * contra un limite de 50. Se nota el dia de la importacion.
     */
    const prestamos = await this.prisma.prestamo.findMany({
      where: whereConditions,
      include: {
        cliente: true,
        /*
         * La ruta DEL CREDITO, con su cobrador.
         *
         * Antes estas dos columnas salian de un
         * `asignacionRuta.findFirst({ clienteId })` dentro del `map` —una
         * consulta por fila— y describian la ruta del CLIENTE. Para un credito
         * sin ruta eso significa mostrarlo en la ruta de su dueño y, peor, con
         * el nombre de un cobrador que no lo tiene en su jornada.
         */
        ruta: { include: { cobrador: true } },
        cuotas: {
          where: {
            estado: { in: ['PENDIENTE', 'PARCIAL', 'VENCIDA'] },
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
      // El tipo de retorno se DECLARA, no se castea al final: asi un campo que el DTO no
      // tenga -o que el DTO pida y no se mande- deja de compilar. El `as PrestamoMoraDto`
      // que habia abajo dejaba pasar tres campos de prorroga sin declarar.
      prestamos.map(async (prestamo): Promise<PrestamoMoraDto | null> => {
        // Obtener asignación de ruta activa del cliente
        const cuotas = prestamo?.cuotas || [];
        const cuotasVencidas = cuotas.filter((c) => {
          const eff = c?.fechaVencimientoProrroga
            ? new Date(c.fechaVencimientoProrroga)
            : new Date(c.fechaVencimiento);
          if (!eff || isNaN(eff.getTime())) return false;
          const key = utcDateKey(eff);
          return !!key && key < hoyKeyBogota;
        });

        // El tipo del acumulador se DERIVA del arreglo, con
        // `(typeof cuotasVencidas)[number]`, en vez de repetirlo como `any` dos veces.
        type CuotaVencida = (typeof cuotasVencidas)[number];
        const cuotaMasAntigua = cuotasVencidas.reduce(
          (acc, c) => {
            const eff = c?.fechaVencimientoProrroga
              ? new Date(c.fechaVencimientoProrroga)
              : new Date(c.fechaVencimiento);
            if (!acc) return { cuota: c, eff };
            return eff < acc.eff ? { cuota: c, eff } : acc;
          },
          null as null | { cuota: CuotaVencida; eff: Date },
        );

        const cuotaMasAntiguaKey = cuotaMasAntigua?.eff
          ? utcDateKey(cuotaMasAntigua.eff)
          : '';

        const diasMora = (() => {
          if (!cuotaMasAntiguaKey) return 0;
          const frecuencia = String(
            prestamo?.frecuenciaPago || '',
          ).toUpperCase();
          if (frecuencia === 'DIARIO') {
            return diasMoraDiarioExcluyendoDomingos(
              cuotaMasAntiguaKey,
              hoyKeyBogota || '',
            );
          }
          // Para frecuencias NO diarias, usamos llaves YYYY-MM-DD y fechas a mediodía Bogotá
          // para evitar desfases por hora/zona (UTC vs Bogotá) que pueden dar 0d aunque
          // la cuota ya esté vencida por llave.
          const parseKeyToBogotaMidday = (key: string) =>
            new Date(`${key}T12:00:00-05:00`);
          const start = parseKeyToBogotaMidday(cuotaMasAntiguaKey);
          const end = parseKeyToBogotaMidday(hoyKeyBogota || '');
          if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
          const diff = Math.floor(
            (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
          );
          return diff > 0 ? diff : 0;
        })();

        // Calcular monto de mora (suma de intereses de mora de cuotas vencidas)
        const montoMora = cuotasVencidas.reduce(
          (sum, cuota) => sum + cuota.montoInteresMora.toNumber(),
          0,
        );

        // Obtener último pago
        const ultimoPago = prestamo.pagos[0];

        // Prorroga activa: la extension mas reciente
        const extension = prestamo.extensiones?.[0];
        const fechaProrroga = extension?.nuevaFechaVencimiento
          ? format(new Date(extension.nuevaFechaVencimiento), 'yyyy-MM-dd')
          : undefined;
        const diasProrroga = extension?.nuevaFechaVencimiento
          ? Math.ceil(
              (new Date(extension.nuevaFechaVencimiento).getTime() -
                Date.now()) /
                (1000 * 60 * 60 * 24),
            )
          : undefined;

        const tieneMoraReal =
          cuotasVencidas.length > 0 || diasMora > 0 || montoMora > 0;
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
          ruta: prestamo.ruta?.nombre || 'Sin asignar',
          cobrador: prestamo.ruta?.cobrador
            ? `${prestamo.ruta.cobrador.nombres} ${prestamo.ruta.cobrador.apellidos}`
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
        };
      }),
    );

    // El `filter(Boolean)` no le quita el `null` al tipo: hace falta el guarda. Antes
    // habia un `as PrestamoMoraDto[]`, que ademas tapaba que al objeto de arriba le
    // faltaban tres campos por declarar en el DTO (los de prorroga).
    const prestamosEnriquecidos = prestamosEnriquecidosRaw.filter(
      (p): p is NonNullable<typeof p> => p !== null,
    );
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

    // La pagina se corta aqui: `total` y `totales` ya miran el conjunto
    // completo, que es lo que hace que el paginador y las cifras de dinero
    // digan la verdad con mas de una pagina de morosos.
    const paginaDePrestamos = prestamosEnriquecidos.slice(skip, skip + limite);

    return {
      prestamos: paginaDePrestamos,
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
    const filas: MoraRow[] = prestamos.map((p) => ({
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

    throw new BadRequestException(
      `Formato de exportacion no valido: ${formato ?? 'ninguno'}. Use "excel" o "pdf".`,
    );
  }

  async obtenerEstadisticasMora(
    actor?: { id?: string; rol?: RolUsuario } | null,
  ) {
    // El supervisor/cobrador solo cuenta la mora de sus rutas.
    const scope = this.filtroRutaScopePrestamo(actor);
    const [
      totalPrestamosMora,
      prestamosRojos,
      prestamosListaNegra,
      moraAcumulada,
      deudaTotal,
    ] = await Promise.all([
      this.prisma.prestamo.count({
        where: { estado: 'EN_MORA', ...scope },
      }),
      this.prisma.prestamo.count({
        where: {
          estado: 'EN_MORA',
          cliente: {
            nivelRiesgo: 'ROJO',
          },
          ...scope,
        },
      }),
      this.prisma.prestamo.count({
        where: {
          estado: 'EN_MORA',
          cliente: {
            nivelRiesgo: 'LISTA_NEGRA',
          },
          ...scope,
        },
      }),
      this.prisma.cuota.aggregate({
        where: {
          estado: 'VENCIDA',
          prestamo: {
            estado: 'EN_MORA',
            ...scope,
          },
        },
        _sum: {
          montoInteresMora: true,
        },
      }),
      this.prisma.prestamo.aggregate({
        where: { estado: 'EN_MORA', ...scope },
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
    actor?: { id?: string; rol?: RolUsuario } | null,
  ): Promise<CuentasVencidasResponseDto> {
    const skip = (pagina - 1) * limite;
    const hoy = new Date();

    const whereConditions: Prisma.PrestamoWhereInput = {
      fechaFin: { lt: hoy },
      estado: { in: ['EN_MORA', 'INCUMPLIDO', 'PERDIDA'] },
      saldoPendiente: { gt: 0 },
      // El supervisor/cobrador solo ve las vencidas de sus rutas.
      ...this.filtroRutaScopePrestamo(actor),
    };

    if (filtros.busqueda) {
      whereConditions.OR = [
        {
          cliente: {
            nombres: { contains: filtros.busqueda, mode: 'insensitive' },
          },
        },
        {
          cliente: {
            apellidos: { contains: filtros.busqueda, mode: 'insensitive' },
          },
        },
        {
          cliente: { dni: { contains: filtros.busqueda, mode: 'insensitive' } },
        },
        { numeroPrestamo: { contains: filtros.busqueda, mode: 'insensitive' } },
      ];
    }

    if (filtros.nivelRiesgo) {
      // Se anota el objeto: `cliente` es un `XOR` de Prisma (filtro de relacion o filtro de
      // campos), y sin la anotacion tsc elige la rama del filtro de relacion, donde
      // `nivelRiesgo` no existe.
      const filtroCliente: Prisma.ClienteWhereInput = {
        ...whereConditions.cliente,
        nivelRiesgo: filtros.nivelRiesgo,
      };
      whereConditions.cliente = filtroCliente;
    }

    if (filtros.rutaId) {
      const clientesRuta = await this.prisma.asignacionRuta.findMany({
        where: { rutaId: filtros.rutaId, activa: true },
        select: { clienteId: true },
      });
      whereConditions.clienteId = {
        in: clientesRuta.map((cr) => cr.clienteId),
      };
    }

    const total = await this.prisma.prestamo.count({ where: whereConditions });

    /*
     * Sin `skip`/`take`: la pagina se corta al final.
     *
     * `totalRegistros` ya miraba el conjunto completo —es el `count` de
     * arriba—, pero el DINERO (`totalVencido`, `totalInteresesMora`,
     * `totalMontoOriginal`) y el promedio de dias se sumaban sobre las filas de
     * la pagina. O sea que la pantalla decia «41 cuentas» y debajo una deuda
     * que solo cubria las primeras 50: el numero de cuentas y el dinero no
     * hablaban del mismo conjunto, y el dinero salia por debajo sin avisar.
     */
    const prestamos = await this.prisma.prestamo.findMany({
      where: whereConditions,
      include: {
        cliente: true,
        cuotas: { where: { estado: 'VENCIDA' } },
        /*
         * La ruta DEL CREDITO. Antes esto era un
         * `asignacionRuta.findFirst({ clienteId })` dentro del `map`, o sea una
         * consulta POR FILA, y encima leia la ruta del CLIENTE: un credito sin
         * ruta se mostraba en la ruta de su dueño, igual que pasaba en el
         * listado de creditos. Aqui importa el doble, porque esta es la
         * pantalla de perseguir lo vencido.
         *
         * El `include` traia tambien el cobrador de esa ruta y no lo leia
         * nadie.
         */
        ruta: { select: { nombre: true } },
      },
      orderBy: [{ fechaFin: 'asc' }, { saldoPendiente: 'desc' }],
    });

    const cuentasVencidas = await Promise.all(
      prestamos.map(async (prestamo) => {
        const diasVencidos = differenceInDays(hoy, prestamo.fechaFin);
        const interesesMora = prestamo.cuotas.reduce(
          (sum, cuota) => sum + cuota.montoInteresMora.toNumber(),
          0,
        );

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
          ruta: prestamo.ruta?.nombre || 'Sin asignar',
          nivelRiesgo: prestamo.cliente.nivelRiesgo,
          estado: prestamo.estado,
          interesesMora,
        };
      }),
    );

    const totales: TotalesVencidasDto = {
      totalVencido: cuentasVencidas.reduce(
        (sum, c) => sum + c.saldoPendiente,
        0,
      ),
      totalRegistros: total,
      diasPromedioVencimiento:
        cuentasVencidas.length > 0
          ? Math.round(
              cuentasVencidas.reduce((sum, c) => sum + c.diasVencidos, 0) /
                cuentasVencidas.length,
            )
          : 0,
      totalInteresesMora: cuentasVencidas.reduce(
        (s, c) => s + (c.interesesMora || 0),
        0,
      ),
      totalMontoOriginal: cuentasVencidas.reduce(
        (s, c) => s + (c.montoOriginal || 0),
        0,
      ),
    };

    // La pagina se corta aqui, con los totales ya calculados sobre el conjunto
    // completo: asi el numero de cuentas y el dinero hablan de lo mismo.
    return {
      cuentas: cuentasVencidas.slice(skip, skip + limite),
      totales,
      total,
      pagina,
      limite,
    };
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
      throw new NotFoundException('Préstamo no encontrado');
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
    if (
      decisionDto.decision === 'PRORROGAR' ||
      decisionDto.decision === 'DEJAR_QUIETO'
    ) {
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
      if (u)
        nombreUsuario = `${u.nombres} ${u.apellidos}`.trim() || nombreUsuario;
    } catch {
      // Es accesorio: si falla, la operacion principal ya quedo hecha
      // y se sigue con el valor por defecto.
    }

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
      } catch {
        // Es accesorio: si falla, la operacion principal ya quedo hecha
        // y se sigue con el valor por defecto.
      }

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
      } catch {
        // Es accesorio: si falla, la operacion principal ya quedo hecha
        // y se sigue con el valor por defecto.
      }
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

    const filas: VencidasRow[] = cuentas.map((c) => ({
      numeroPrestamo: c.numeroPrestamo || '',
      cliente:
        typeof c.cliente === 'string' ? c.cliente : c.cliente?.nombre || '',
      documento:
        typeof c.cliente === 'object' ? c.cliente?.documento || '' : '',
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
      diasPromedioVencimiento: Number(
        data.totales?.diasPromedioVencimiento || 0,
      ),
      totalRegistros: Number(data.totales?.totalRegistros || 0),
      totalInteresesMora: Number(data.totales?.totalInteresesMora || 0),
      totalMontoOriginal: Number(data.totales?.totalMontoOriginal || 0),
    };

    if (formato === 'excel') return generarExcelVencidas(filas, totales, fecha);
    if (formato === 'pdf') return generarPDFVencidas(filas, totales, fecha);

    throw new BadRequestException(
      `Formato de exportacion no valido: ${formato ?? 'ninguno'}. Use "excel" o "pdf".`,
    );
  }

  /**
   * Filtro directo sobre la tabla Ruta según el actor (para consultas
   * `ruta.findMany`). Mismo criterio que `filtroRutaScopePrestamo` pero al
   * nivel de la propia ruta.
   */
  private filtroRutaDirectoPorActor(
    actor?: { id?: string; rol?: RolUsuario } | null,
  ): Prisma.RutaWhereInput {
    const rol = String(actor?.rol || '').toUpperCase();
    if (!actor?.id) return {};
    if (rol === RolUsuario.SUPERVISOR) return { supervisorId: actor.id };
    if (rol === RolUsuario.COBRADOR) {
      return {
        OR: [
          { cobradorId: actor.id },
          { asignaciones: { some: { activa: true, cobradorId: actor.id } } },
        ],
      };
    }
    return {};
  }

  private async cargarNovedadesPorRuta(
    rutaIds: string[],
    startDate: Date,
    endDate: Date,
  ) {
    const prestamosPorRuta = new Map<
      string,
      { cantidad: number; monto: number }
    >();
    const clientesPorRuta = new Map<string, Set<string>>();

    if (rutaIds.length === 0) {
      return { prestamosPorRuta, clientesPorRuta, clientesUnicos: 0 };
    }

    const [prestamos, clientes] = await Promise.all([
      this.prisma.prestamo.findMany({
        where: {
          rutaId: { in: rutaIds },
          creadoEn: { gte: startDate, lte: endDate },
          eliminadoEn: null,
          estado: {
            in: [
              EstadoPrestamo.ACTIVO,
              EstadoPrestamo.EN_MORA,
              EstadoPrestamo.PAGADO,
            ],
          },
        },
        select: { id: true, rutaId: true, monto: true },
      }),
      this.prisma.cliente.findMany({
        where: {
          creadoEn: { gte: startDate, lte: endDate },
          asignacionesRuta: {
            some: { rutaId: { in: rutaIds }, activa: true },
          },
        },
        select: {
          id: true,
          asignacionesRuta: {
            where: { rutaId: { in: rutaIds }, activa: true },
            select: { rutaId: true },
          },
        },
      }),
    ]);

    for (const prestamo of prestamos) {
      if (!prestamo.rutaId) continue;
      const actual = prestamosPorRuta.get(prestamo.rutaId) || {
        cantidad: 0,
        monto: 0,
      };
      actual.cantidad += 1;
      actual.monto += Number(prestamo.monto || 0);
      prestamosPorRuta.set(prestamo.rutaId, actual);
    }

    for (const cliente of clientes) {
      for (const asignacion of cliente.asignacionesRuta) {
        const ids = clientesPorRuta.get(asignacion.rutaId) || new Set<string>();
        ids.add(cliente.id);
        clientesPorRuta.set(asignacion.rutaId, ids);
      }
    }

    return {
      prestamosPorRuta,
      clientesPorRuta,
      clientesUnicos: new Set(clientes.map((cliente) => cliente.id)).size,
    };
  }

  async getOperationalReport(
    filters: GetOperationalReportDto,
    actor?: { id?: string; rol?: RolUsuario } | null,
  ): Promise<OperationalReportResponse> {
    const { period, routeId, startDate, endDate } = filters;

    // Para el reporte diario, el objetivo debe ser la meta REAL del día por ruta,
    // igual a la vista del listado de rutas (metaDelDia/cobranzaDelDia/avanceDiario).
    // Esto evita discrepancias y hace que el objetivo tenga sentido operativo.
    // Se compara contra el miembro del enum y no contra el literal: asi un valor
    // mal escrito lo atrapa el compilador.
    if (period === ReportPeriod.TODAY) {
      // El actor filtra las rutas: el supervisor/cobrador solo ve las suyas.
      const rutasListado = await this.routesService.findAll(
        { activa: true },
        actor,
      );
      const rutas = rutasListado?.data || [];

      const rutasFiltradas = routeId
        ? rutas.filter((r) => r.id === routeId)
        : rutas;
      const { startDate: hoyInicio, endDate: hoyFin } = getBogotaStartEndOfDay(
        new Date(),
      );

      const novedades = await this.cargarNovedadesPorRuta(
        rutasFiltradas.map((ruta) => ruta.id),
        hoyInicio,
        hoyFin,
      );

      const rendimientoRutas: RoutePerformanceDetail[] = rutasFiltradas.map(
        (r) => {
          const prestamosNuevos = novedades.prestamosPorRuta.get(r.id);
          return {
            id: r.id,
            ruta: r.nombre,
            cobrador: r.cobrador,
            cobradorId: r.cobradorId,
            meta: Number(r.metaDelDia || 0),
            recaudado: Number(r.cobranzaDelDia || 0),
            eficiencia: Number(r.avanceDiario || 0),
            nuevosPrestamos: prestamosNuevos?.cantidad || 0,
            nuevosClientes: novedades.clientesPorRuta.get(r.id)?.size || 0,
            montoNuevosPrestamos: prestamosNuevos?.monto || 0,
          };
        },
      );

      const totalRecaudo = rendimientoRutas.reduce(
        (sum, rr) => sum + Number(rr.recaudado || 0),
        0,
      );
      const totalMeta = rendimientoRutas.reduce(
        (sum, rr) => sum + Number(rr.meta || 0),
        0,
      );
      const porcentajeGlobal =
        totalMeta > 0 ? Math.round((totalRecaudo / totalMeta) * 100) : 0;

      const totalPrestamosNuevos = rendimientoRutas.reduce(
        (sum, rr) => sum + Number(rr.nuevosPrestamos || 0),
        0,
      );
      const totalAfiliaciones = rendimientoRutas.reduce(
        (sum, rr) => sum + Number(rr.nuevosClientes || 0),
        0,
      );
      const totalMontoPrestamosNuevos = rendimientoRutas.reduce(
        (sum, rr) => sum + Number(rr.montoNuevosPrestamos || 0),
        0,
      );
      const efectividadPromedio =
        rendimientoRutas.length > 0
          ? Math.round(
              rendimientoRutas.reduce(
                (sum, rr) => sum + Number(rr.eficiencia || 0),
                0,
              ) / rendimientoRutas.length,
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
        rendimientoRutas,
        periodo: period,
        fechaInicio: hoyInicio,
        fechaFin: hoyFin,
      };
    }

    const dateRange = calculateDateRange(period, startDate, endDate);

    const routes = await this.prisma.ruta.findMany({
      where: {
        ...(routeId && { id: routeId }),
        activa: true,
        // El supervisor/cobrador solo ve sus rutas en el reporte operativo.
        ...this.filtroRutaDirectoPorActor(actor),
      },
      include: {
        cobrador: {
          select: {
            id: true,
            nombres: true,
            apellidos: true,
          },
        },
      },
    });

    const routeIds = routes.map((route) => route.id);
    const [pagos, cuotas, novedades] = await Promise.all([
      this.prisma.pago.findMany({
        where: {
          prestamo: { rutaId: { in: routeIds } },
          fechaPago: {
            gte: dateRange.startDate,
            lte: dateRange.endDate,
          },
        },
        select: {
          montoTotal: true,
          prestamo: { select: { rutaId: true } },
        },
      }),
      this.prisma.cuota.findMany({
        where: {
          prestamo: {
            rutaId: { in: routeIds },
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
        select: {
          monto: true,
          montoInteresMora: true,
          prestamo: { select: { rutaId: true } },
        },
      }),
      this.cargarNovedadesPorRuta(
        routeIds,
        dateRange.startDate,
        dateRange.endDate,
      ),
    ]);

    const recaudoPorRuta = new Map<string, number>();
    for (const pago of pagos) {
      const rutaIdPago = pago.prestamo.rutaId;
      if (!rutaIdPago) continue;
      recaudoPorRuta.set(
        rutaIdPago,
        (recaudoPorRuta.get(rutaIdPago) || 0) + Number(pago.montoTotal || 0),
      );
    }

    const metaPorRuta = new Map<string, number>();
    for (const cuota of cuotas) {
      const rutaIdCuota = cuota.prestamo.rutaId;
      if (!rutaIdCuota) continue;
      const monto =
        Number(cuota.monto || 0) + Number(cuota.montoInteresMora || 0);
      metaPorRuta.set(rutaIdCuota, (metaPorRuta.get(rutaIdCuota) || 0) + monto);
    }

    const routePerformance: RoutePerformanceDetail[] = routes.map((route) => {
      const collected = recaudoPorRuta.get(route.id) || 0;
      const target = metaPorRuta.get(route.id) || 0;
      const prestamosNuevos = novedades.prestamosPorRuta.get(route.id);

      const efficiency =
        target > 0 ? Math.round((collected / target) * 100) : 0;

      return {
        id: route.id,
        ruta: route.nombre,
        cobrador: `${route.cobrador.nombres} ${route.cobrador.apellidos}`,
        cobradorId: route.cobrador.id,
        meta: target,
        recaudado: collected,
        eficiencia: efficiency,
        nuevosPrestamos: prestamosNuevos?.cantidad || 0,
        nuevosClientes: novedades.clientesPorRuta.get(route.id)?.size || 0,
        montoNuevosPrestamos: prestamosNuevos?.monto || 0,
      };
    });

    const totalRecaudo = routePerformance.reduce(
      (sum, route) => sum + route.recaudado,
      0,
    );
    const totalMeta = routePerformance.reduce(
      (sum, route) => sum + route.meta,
      0,
    );
    const totalMontoPrestamosNuevos = routePerformance.reduce(
      (sum, route) => sum + route.montoNuevosPrestamos,
      0,
    );
    const totalPrestamosNuevos = routePerformance.reduce(
      (sum, route) => sum + route.nuevosPrestamos,
      0,
    );

    const porcentajeGlobal =
      totalMeta > 0 ? Math.round((totalRecaudo / totalMeta) * 100) : 0;

    const totalAfiliaciones = novedades.clientesUnicos;

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

  async getRouteDetail(
    routeId: string,
    // Lo que manda el controlador desde el query string, ni mas ni menos
    // (reports.controller.ts:321). `period` se castea a `TimeFilterPeriod` mas abajo.
    filters: { period?: string; startDate?: string; endDate?: string },
    actor?: { id?: string; rol?: RolUsuario } | null,
  ) {
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

    // Un supervisor solo puede ver el detalle de las rutas que supervisa; de lo
    // contrario podria consultar el recaudo y los clientes de cualquier ruta.
    // Admin, coordinador y superadmin tienen vision total.
    const rolActor = String(actor?.rol || '').toUpperCase();
    if (
      rolActor === RolUsuario.SUPERVISOR &&
      actor?.id &&
      route.supervisorId !== actor.id
    ) {
      throw new ForbiddenException('No supervisa esta ruta');
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

  /**
   * Exporta el reporte operativo.
   *
   * El `actor` no estaba y la llamada de abajo iba sin el, asi que el archivo
   * se armaba con TODAS las rutas, viera el que lo pide las que viera. Hasta
   * ahora no se notaba porque solo coordinador y admin podian exportar, y los
   * dos ven todo; en cuanto entra el supervisor —que solo ve las suyas— la
   * diferencia es que el Excel le daria las rutas de los demas.
   */
  async exportOperationalReport(
    filters: GetOperationalReportDto,
    format: 'excel' | 'pdf',
    actor?: { id?: string; rol?: RolUsuario } | null,
  ): Promise<{ data: Buffer; contentType: string; filename: string }> {
    const reportData = await this.getOperationalReport(filters, actor);
    const fecha = getBogotaDayKey(new Date());

    const filas: OperativoRow[] = (reportData.rendimientoRutas || []).map(
      (r) => ({
        ruta: r.ruta || '',
        cobrador: r.cobrador || '',
        meta: Number(r.meta || 0),
        recaudado: Number(r.recaudado || 0),
        eficiencia: Number(r.eficiencia || 0),
        nuevosPrestamos: Number(r.nuevosPrestamos || 0),
        nuevosClientes: Number(r.nuevosClientes || 0),
      }),
    );

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

    throw new BadRequestException(
      `Formato de exportacion no valido: ${format ?? 'ninguno'}. Use "excel" o "pdf".`,
    );
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

    if (format === 'excel')
      return generarExcelFinanciero(summary, monthly, expenses, fecha);
    if (format === 'pdf')
      return generarPDFFinanciero(summary, monthly, expenses, fecha);

    throw new BadRequestException(
      `Formato de exportacion no valido: ${format ?? 'ninguno'}. Use "excel" o "pdf".`,
    );
  }
}
