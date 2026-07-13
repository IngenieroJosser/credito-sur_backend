import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
  ConflictException,
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
  TipoTransaccion,
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
import { LedgerService } from '../accounting/ledger.service';
import {
  generarPDFCartera,
  CarteraRow,
  CarteraTotales,
} from '../templates/exports/cartera-creditos.template';
import { generarExcelClientesCreditosImportable } from '../templates/exports/importables.template';
import { createHash, randomUUID } from 'crypto';
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

  private isCollector(actor?: { rol?: RolUsuario | string } | null) {
    return String(actor?.rol || '').toUpperCase() === RolUsuario.COBRADOR;
  }

  private isOperatorWithBase(actor?: { rol?: RolUsuario | string } | null) {
    const rol = String(actor?.rol || '').toUpperCase();
    return rol === RolUsuario.COBRADOR || rol === RolUsuario.SUPERVISOR;
  }

  private puedeCrearCreditoConFechaAntigua(
    rol?: RolUsuario | string | null,
  ): boolean {
    const normalized = String(rol || '').toUpperCase();
    return (
      normalized === RolUsuario.ADMIN ||
      normalized === RolUsuario.SUPER_ADMINISTRADOR
    );
  }

  private toBogotaDateKey(value: Date | string): string {
    if (value instanceof Date) return getBogotaDayKey(value);

    const raw = String(value || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

    return getBogotaDayKey(this.parseBogotaDayKey(raw));
  }

  private hoyBogotaKey(): string {
    return getBogotaDayKey(new Date());
  }

  private collectorLoanScope(
    actor?: { id?: string; rol?: RolUsuario | string } | null,
  ): Prisma.PrestamoWhereInput {
    if (!this.isCollector(actor) || !actor?.id) return {};
    return {
      cliente: {
        asignacionesRuta: {
          some: {
            activa: true,
            OR: [
              { cobradorId: actor.id } as any,
              { ruta: { cobradorId: actor.id } } as any,
            ],
          },
        },
      },
    };
  }

  private trunc2(n: number): number {
    if (!Number.isFinite(n)) return 0;
    return Math.trunc(n * 100) / 100;
  }

  async descontarStockSiDisponible(productoId: string, tx?: any) {
    const prisma = tx || this.prisma;
    const result = await prisma.producto.updateMany({
      where: {
        id: productoId,
        stock: { gt: 0 },
      },
      data: { stock: { decrement: 1 } },
    });

    if (result.count !== 1) {
      throw new BadRequestException('Producto sin stock disponible');
    }
  }

  async generarNumeroPrestamo(tipoPrestamo: string) {
    const prefix =
      String(tipoPrestamo || '').toUpperCase() === 'ARTICULO' ? 'ART' : 'PRES';
    const lastLoan = await this.prisma.prestamo.findFirst({
      where: { numeroPrestamo: { startsWith: `${prefix}-` } },
      orderBy: { numeroPrestamo: 'desc' },
    });

    let currentNumber = 1;
    if (lastLoan) {
      const parts = lastLoan.numeroPrestamo.split('-');
      if (parts.length === 2 && !isNaN(Number(parts[1]))) {
        currentNumber = parseInt(parts[1], 10) + 1;
      }
    }
    return `${prefix}-${String(currentNumber).padStart(6, '0')}`;
  }

  constructor(
    private prisma: PrismaService,
    private notificacionesService: NotificacionesService,
    private auditService: AuditService,
    private pushService: PushService,
    private notificacionesGateway: NotificacionesGateway,
    private configuracionService: ConfiguracionService,
    private ledgerService: LedgerService,
  ) {}

  private normalizeIdempotencyKey(value?: string | null) {
    const key = value?.toString().trim();
    if (!key) return undefined;
    if (key.length <= 100) return key;

    return `sha256:${createHash('sha256').update(key).digest('hex')}`;
  }

  private async runCreateLoanSideEffect(
    label: string,
    action: () => Promise<unknown> | unknown,
  ) {
    try {
      await action();
    } catch (error) {
      this.logger.error(
        `[CREATE LOAN] Falló efecto secundario: ${label}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private parseFechaOperativaReprogramacionKey(value?: string | null) {
    if (!value) return undefined;

    const raw = String(value).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      throw new BadRequestException(
        'fechaOperativaRuta inválida. Debe usar formato YYYY-MM-DD.',
      );
    }

    const date = new Date(`${raw}T12:00:00-05:00`);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(
        'fechaOperativaRuta inválida. Debe usar formato YYYY-MM-DD.',
      );
    }

    return getBogotaDayKey(date);
  }

  private generarNumeroTransaccion(prefix = 'TRX') {
    return `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}`;
  }

  async onModuleInit() {
    this.logger.log(
      '🔄 [AUTO-FIX] Verificando e iniciando corrección de intereses al arranque...',
    );
    try {
      const result = await this.fixInterestCalculations();
      this.logger.log(
        `✅ [AUTO-FIX] Proceso completado. ${result.corrected} préstamos corregidos de ${result.processed} verificados.`,
      );
    } catch (error) {
      this.logger.error(
        `❌ [AUTO-FIX] Error durante la corrección automática: ${error}`,
      );
    }
  }

  /**
   * Construye el objeto metadata estándar para notificaciones de préstamo.
   * Centraliza el bloque de campos repetido en notifyApprovers + notificacionesService.create
   * dentro de createLoan.
   */
  private buildPrestamoNotifMetadata(params: {
    prestamo: {
      id: string;
      numeroPrestamo: string;
      monto: any;
      fechaInicio?: Date | null;
    };
    data: {
      frecuenciaPago: any;
      cuotaInicial?: number;
      notas?: string;
      esContado?: boolean;
      tipoPrestamo: string;
    };
    cliente: {
      id: string;
      nombres?: string | null;
      apellidos?: string | null;
      dni?: string | null;
      telefono?: string | null;
    };
    cantidadCuotas: number;
    numPlazoMeses: number;
    articuloNombre: string;
    isFinanciamientoArticulo: boolean;
    precioArticuloTotal: number;
    safeNumber: (v: any) => number;
    interesTotal?: number;
    tasaInteres?: number;
  }) {
    const {
      prestamo,
      data,
      cliente,
      cantidadCuotas,
      numPlazoMeses,
      articuloNombre,
      isFinanciamientoArticulo,
      precioArticuloTotal,
      safeNumber,
      interesTotal,
      tasaInteres,
    } = params;
    return {
      tipoAprobacion: 'NUEVO_PRESTAMO',
      prestamoId: prestamo.id,
      clienteId: cliente.id,

      cliente: `${cliente.nombres || ''} ${cliente.apellidos || ''}`.trim(),
      cedula: String(cliente.dni || ''),
      telefono: String(cliente.telefono || ''),

      numeroPrestamo: prestamo.numeroPrestamo,
      monto: safeNumber(prestamo.monto),
      tipoPrestamo: data.tipoPrestamo,
      esContado: !!data.esContado,
      articulo: String(articuloNombre).replace(/&amp;/gi, '&'),
      valorArticulo: isFinanciamientoArticulo
        ? safeNumber(precioArticuloTotal)
        : safeNumber(prestamo.monto),
      cuotas: safeNumber(cantidadCuotas),
      cantidadCuotas: safeNumber(cantidadCuotas),
      plazoMeses: numPlazoMeses,
      frecuenciaPago: String(data.frecuenciaPago),
      cuotaInicial: safeNumber(data.cuotaInicial),
      notas: String(data.notas || ''),
      fechaInicio: prestamo.fechaInicio
        ? formatBogotaOffsetIso(prestamo.fechaInicio)
        : undefined,
      fecha: prestamo.fechaInicio
        ? formatBogotaOffsetIso(prestamo.fechaInicio)
        : undefined,
      // Agregar campos para cálculo de proyección de recaudo en frontend
      montoTotal: safeNumber(prestamo.monto) + safeNumber(interesTotal),
      interesTotal: safeNumber(interesTotal),
      tasaInteres: safeNumber(tasaInteres),
    };
  }

  async registrarImpactoContablePrestamoAprobado(prestamo: {
    id: string;
    numeroPrestamo: string;
    clienteId: string;
    tipoPrestamo: string;
    monto: any;
    cuotaInicial?: any;
    precioVentaArticulo?: any;
    costoArticulo?: any;
    creadoPorId: string;
  }) {
    const tipoPrestamo = String(prestamo.tipoPrestamo || '').toUpperCase();
    const isArticulo = tipoPrestamo === 'ARTICULO';
    const referenceType = isArticulo ? 'VENTA_ARTICULO' : 'DESEMBOLSO';
    const existingEntry = await (this.prisma as any).journalEntry?.findFirst?.({
      where: { referenceType, referenceId: prestamo.id },
      select: { id: true },
    });
    if (existingEntry?.id) return;

    if (isArticulo) {
      const cajaDestino = await this.prisma.caja.findFirst({
        where: {
          activa: true,
          OR: [
            { codigo: 'CAJA-OFICINA' },
            { codigo: 'CAJA-PRINCIPAL' },
            { tipo: 'PRINCIPAL' as any },
          ],
        },
        orderBy: [{ codigo: 'asc' as any }],
        select: { id: true, codigo: true, tipo: true },
      });

      const cuotaInicial = Number(prestamo.cuotaInicial || 0);
      if (cuotaInicial > 0 && cajaDestino?.id) {
        const yaExiste = await this.prisma.transaccion.findFirst({
          where: {
            cajaId: cajaDestino.id,
            tipo: TipoTransaccion.INGRESO,
            tipoReferencia: 'CUOTA_INICIAL',
            referenciaId: prestamo.id,
          },
          select: { id: true },
        });

        if (!yaExiste?.id) {
          await this.prisma.transaccion.create({
            data: {
              numeroTransaccion: this.generarNumeroTransaccion(),
              cajaId: cajaDestino.id,
              tipo: TipoTransaccion.INGRESO,
              monto: cuotaInicial,
              descripcion: `Cuota inicial crédito artículo #${prestamo.numeroPrestamo}`,
              creadoPorId: prestamo.creadoPorId,
              tipoReferencia: 'CUOTA_INICIAL',
              referenciaId: prestamo.id,
            },
          });
        }
      }

      await this.ledgerService.registrarVentaArticulo({
        prestamoId: prestamo.id,
        precioVenta: Number(prestamo.precioVentaArticulo || 0),
        costoArticulo: Number(prestamo.costoArticulo || 0),
        montoFinanciado: Number(prestamo.monto || 0),
        cuotaInicial,
        cajaId: cajaDestino?.id,
        accountCodeCaja:
          cajaDestino?.codigo === 'CAJA-BANCO' ? '1.1.2' : '1.1.1',
        createdBy: prestamo.creadoPorId,
      });
      return;
    }

    const creador = await this.prisma.usuario.findUnique({
      where: { id: prestamo.creadoPorId },
      select: { rol: true },
    });
    const cajaOrigen = await this.resolveCajaOperacionPrestamo(
      this.prisma as any,
      {
        data: {} as any,
        creador: { id: prestamo.creadoPorId, rol: creador?.rol },
        cliente: { asignacionesRuta: [] },
        requiereCajaRuta: this.isOperatorWithBase(creador),
      },
    );

    if (!cajaOrigen?.id) {
      throw new BadRequestException(
        'No existe una caja activa para desembolsar el préstamo autoaprobado.',
      );
    }

    const monto = Number(prestamo.monto || 0);
    const yaExiste = await this.prisma.transaccion.findFirst({
      where: {
        cajaId: cajaOrigen.id,
        tipo: TipoTransaccion.EGRESO,
        tipoReferencia: 'PRESTAMO',
        referenciaId: prestamo.id,
      },
      select: { id: true },
    });

    if (!yaExiste?.id) {
      await this.prisma.transaccion.create({
        data: {
          numeroTransaccion: this.generarNumeroTransaccion(),
          cajaId: cajaOrigen.id,
          tipo: TipoTransaccion.EGRESO,
          monto,
          descripcion: `Desembolso de préstamo #${prestamo.numeroPrestamo}`,
          creadoPorId: prestamo.creadoPorId,
          tipoReferencia: 'PRESTAMO',
          referenciaId: prestamo.id,
        },
      });
    }

    await this.ledgerService.registrarDesembolso({
      prestamoId: prestamo.id,
      monto,
      cajaOrigenId: cajaOrigen.id,
      accountCodeOrigen: this.getAccountCodeCaja(cajaOrigen),
      createdBy: prestamo.creadoPorId,
    });
  }

  private async resolveCajaOperacionPrestamo(
    tx: any,
    params: {
      data: CreateLoanDto;
      creador: any;
      cliente: any;
      requiereCajaRuta?: boolean;
    },
  ) {
    const dataAny = params.data as any;
    const rolCreador = String(params.creador?.rol || '').toUpperCase();
    const esCobrador = rolCreador === RolUsuario.COBRADOR;
    const esSupervisor = rolCreador === RolUsuario.SUPERVISOR;
    const esOperadorConBase = esCobrador || esSupervisor;
    const rolesAdminConCajaRutaExplicita = [
      RolUsuario.ADMIN,
      RolUsuario.SUPER_ADMINISTRADOR,
      RolUsuario.COORDINADOR,
    ].map(String);

    const findCajaOficina = async () =>
      (await tx.caja.findFirst({
        where: { activa: true, codigo: 'CAJA-OFICINA' },
        select: {
          id: true,
          codigo: true,
          tipo: true,
          nombre: true,
          saldoActual: true,
          rutaId: true,
          responsableId: true,
        },
      })) ||
      (await tx.caja.findFirst({
        where: {
          activa: true,
          OR: [{ codigo: 'CAJA-PRINCIPAL' }, { tipo: 'PRINCIPAL' as any }],
        },
        orderBy: { creadoEn: 'asc' as any },
        select: {
          id: true,
          codigo: true,
          tipo: true,
          nombre: true,
          saldoActual: true,
          rutaId: true,
          responsableId: true,
        },
      }));

    const selectCajaOperacion = {
      id: true,
      codigo: true,
      tipo: true,
      nombre: true,
      saldoActual: true,
      rutaId: true,
      responsableId: true,
    };

    const findCajaBaseOperador = async () => {
      const operadorId = String(params.creador?.id || '').trim();
      if (!operadorId || !esOperadorConBase) return null;

      const cajaResponsable = await tx.caja.findFirst({
        where: {
          activa: true,
          responsableId: operadorId,
          tipo: 'RUTA' as any,
        },
        select: selectCajaOperacion,
      });
      if (cajaResponsable?.id) return cajaResponsable;

      const ruta = await tx.ruta.findFirst({
        where: {
          eliminadoEn: null,
          activa: true,
          ...(esSupervisor
            ? { supervisorId: operadorId }
            : { cobradorId: operadorId }),
        },
        select: { id: true, cobradorId: true, supervisorId: true },
      });

      if (!ruta?.id) return null;

      const cajaRuta = await tx.caja.findFirst({
        where: {
          activa: true,
          tipo: 'RUTA' as any,
          rutaId: ruta.id,
          ...(esSupervisor ? { responsableId: operadorId } : {}),
        },
        select: selectCajaOperacion,
      });

      return cajaRuta?.id ? cajaRuta : null;
    };

    const getMensajeCajaBaseNoExiste = () =>
      esSupervisor
        ? 'No existe una caja/base activa para el supervisor.'
        : 'No existe una caja de ruta activa para desembolsar este crédito.';

    // ADMIN/SUPER_ADMIN/COORDINADOR siempre usan Caja Oficina
    // Ignoran cualquier cajaId explícito del payload
    if (!esOperadorConBase) {
      return findCajaOficina();
    }

    const cajaId = String(dataAny.cajaId || '').trim();
    if (cajaId) {
      const caja = await tx.caja.findFirst({
        where: { id: cajaId, activa: true },
        select: selectCajaOperacion,
      });
      if (caja?.id) {
        const esCajaRuta = String(caja.tipo || '').toUpperCase() === 'RUTA';

        // COBRADOR/SUPERVISOR solo pueden usar su caja/base asignada
        if (caja.responsableId !== params.creador?.id) {
          throw new BadRequestException(
            esSupervisor
              ? 'No puedes desembolsar desde una caja/base de supervisor que no tienes asignada.'
              : 'No puedes desembolsar desde una caja de ruta que no tienes asignada.',
          );
        }
        return caja;
      }
    }

    const cajaBaseOperador = await findCajaBaseOperador();
    if (cajaBaseOperador?.id) return cajaBaseOperador;

    const rutaIdPayload = String(dataAny.rutaId || '').trim();
    const cobradorIdPayload = String(dataAny.cobradorId || '').trim();
    const rutaPreferida =
      rutaIdPayload ||
      params.cliente?.asignacionesRuta?.[0]?.rutaId ||
      params.cliente?.asignacionesRuta?.[0]?.ruta?.id ||
      '';
    const cobradorPreferido =
      cobradorIdPayload ||
      params.cliente?.asignacionesRuta?.[0]?.cobradorId ||
      params.cliente?.asignacionesRuta?.[0]?.ruta?.cobradorId ||
      (params.creador?.rol === RolUsuario.COBRADOR ? params.creador.id : '');

    const ruta =
      rutaPreferida || cobradorPreferido
        ? await tx.ruta.findFirst({
            where: {
              eliminadoEn: null,
              activa: true,
              ...(rutaPreferida
                ? { id: rutaPreferida }
                : { cobradorId: cobradorPreferido }),
            },
            select: { id: true, cobradorId: true },
          })
        : null;

    if (ruta?.id) {
      const cajaRuta = await tx.caja.findFirst({
        where: { activa: true, tipo: 'RUTA' as any, rutaId: ruta.id },
        select: selectCajaOperacion,
      });
      if (cajaRuta?.id && !esSupervisor) return cajaRuta;
    }

    if (params.requiereCajaRuta && esOperadorConBase) {
      throw new BadRequestException(getMensajeCajaBaseNoExiste());
    }

    return findCajaOficina();
  }

  private getAccountCodeCaja(caja: any) {
    if (caja?.codigo === 'CAJA-BANCO') return '1.1.2';
    if (String(caja?.tipo || '').toUpperCase() === 'RUTA') return '1.2.1';
    return '1.1.1';
  }

  private async aplicarImpactoProvisionalPrestamo(
    tx: any,
    params: {
      prestamo: any;
      data: CreateLoanDto;
      creador: any;
      cliente: any;
    },
  ) {
    const { prestamo, data, creador, cliente } = params;
    const transaccionIds: string[] = [];
    const journalEntryIds: string[] = [];
    let cajaOrigenId: string | null = null;
    let montoDesembolsado = 0;
    let stockDescontado = false;
    let referenciaDesembolso: string | null = null;
    let referenciaCuotaInicial: string | null = null;

    const isArticulo =
      String(prestamo.tipoPrestamo || data.tipoPrestamo || '').toUpperCase() ===
      'ARTICULO';

    if (isArticulo) {
      if (
        prestamo.productoId &&
        prestamo.producto?.stock !== undefined &&
        prestamo.producto?.stock !== null
      ) {
        await this.descontarStockSiDisponible(prestamo.productoId, tx);
        stockDescontado = true;
      }

      const cuotaInicial = Number(prestamo.cuotaInicial || data.cuotaInicial || 0);
      const cajaDestino =
        cuotaInicial > 0
          ? await this.resolveCajaOperacionPrestamo(tx, {
              data,
              creador,
              cliente,
              requiereCajaRuta: false,
            })
          : null;

      if (cuotaInicial > 0 && !cajaDestino?.id) {
        throw new BadRequestException(
          'No se encontró una caja activa para registrar la cuota inicial del artículo.',
        );
      }

      if (cuotaInicial > 0 && cajaDestino?.id) {
        const transaccion = await tx.transaccion.create({
          data: {
            numeroTransaccion: this.generarNumeroTransaccion('CI'),
            cajaId: cajaDestino.id,
            tipo: TipoTransaccion.INGRESO,
            monto: cuotaInicial,
            descripcion: `Cuota inicial crédito artículo #${prestamo.numeroPrestamo}`,
            creadoPorId: data.creadoPorId,
            tipoReferencia: 'CUOTA_INICIAL',
            referenciaId: prestamo.id,
          },
          select: { id: true, numeroTransaccion: true },
        });
        transaccionIds.push(transaccion.id);
        referenciaCuotaInicial = transaccion.numeroTransaccion;
      }

      const journalEntry = await this.ledgerService.registrarVentaArticulo(
        {
          prestamoId: prestamo.id,
          precioVenta: Number(
            prestamo.precioVentaArticulo ||
              (data as any).valorArticulo ||
              Number(prestamo.monto || 0) + cuotaInicial,
          ),
          costoArticulo: Number(prestamo.costoArticulo || 0),
          montoFinanciado: Number(prestamo.monto || 0),
          cuotaInicial,
          cajaId: cajaDestino?.id,
          accountCodeCaja: cajaDestino?.id
            ? this.getAccountCodeCaja(cajaDestino)
            : undefined,
          createdBy: data.creadoPorId,
        },
        tx,
      );
      if (journalEntry?.id) journalEntryIds.push(journalEntry.id);
      cajaOrigenId = cajaDestino?.id || null;
    } else {
      const cajaOrigen = await this.resolveCajaOperacionPrestamo(tx, {
        data,
        creador,
        cliente,
        requiereCajaRuta: this.isOperatorWithBase(creador),
      });
      if (!cajaOrigen?.id) {
        throw new BadRequestException(
          'No existe una caja activa para desembolsar el préstamo.',
        );
      }

      montoDesembolsado = Number(prestamo.monto || 0);
      const saldoCaja = Number(cajaOrigen.saldoActual || 0);
      if (montoDesembolsado > 0 && saldoCaja < montoDesembolsado) {
        throw new BadRequestException(
          `Saldo insuficiente en la caja para desembolsar el préstamo. Caja: ${cajaOrigen.nombre}. Saldo: ${saldoCaja.toLocaleString('es-CO')}. Monto desembolso: ${montoDesembolsado.toLocaleString('es-CO')}`,
        );
      }

      const transaccion = await tx.transaccion.create({
        data: {
          numeroTransaccion: this.generarNumeroTransaccion('T'),
          cajaId: cajaOrigen.id,
          tipo: TipoTransaccion.EGRESO,
          monto: montoDesembolsado,
          descripcion: `Desembolso provisional de préstamo #${prestamo.numeroPrestamo}`,
          creadoPorId: data.creadoPorId,
          tipoReferencia: 'PRESTAMO',
          referenciaId: prestamo.id,
        },
        select: { id: true, numeroTransaccion: true },
      });
      transaccionIds.push(transaccion.id);
      referenciaDesembolso = transaccion.numeroTransaccion;

      const journalEntry = await this.ledgerService.registrarDesembolso(
        {
          prestamoId: prestamo.id,
          monto: montoDesembolsado,
          cajaOrigenId: cajaOrigen.id,
          accountCodeOrigen: this.getAccountCodeCaja(cajaOrigen),
          createdBy: data.creadoPorId,
        },
        tx,
      );
      if (journalEntry?.id) journalEntryIds.push(journalEntry.id);
      cajaOrigenId = cajaOrigen.id;
    }

    return {
      transaccionIds,
      journalEntryIds,
      cajaOrigenId,
      montoDesembolsado,
      stockDescontado,
      referenciaDesembolso,
      referenciaCuotaInicial,
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
      throw new BadRequestException(
        'Este préstamo no corresponde a un crédito de artículo',
      );
    }

    const fechaParsed = prestamo.fechaInicio ?? prestamo.creadoEn;
    const fmtFechaFormatoLargo = (d: Date) => {
      const meses = [
        'enero',
        'febrero',
        'marzo',
        'abril',
        'mayo',
        'junio',
        'julio',
        'agosto',
        'septiembre',
        'octubre',
        'noviembre',
        'diciembre',
      ];
      return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
    };

    const fmtFecha = (d?: Date | null) =>
      d ? new Date(d).toLocaleDateString('es-CO') : '';

    const clienteNombre =
      `${prestamo.cliente?.nombres || ''} ${prestamo.cliente?.apellidos || ''}`.trim();
    const vendedorNombre =
      `${prestamo.creadoPor?.nombres || ''} ${prestamo.creadoPor?.apellidos || ''}`.trim();

    const ref1 = [
      prestamo.cliente?.referencia1Nombre,
      prestamo.cliente?.referencia1Telefono,
    ]
      .filter(Boolean)
      .join(' - ');
    const ref2 = [
      prestamo.cliente?.referencia2Nombre,
      prestamo.cliente?.referencia2Telefono,
    ]
      .filter(Boolean)
      .join(' - ');

    const abonoInicial = prestamo.cuotaInicial
      ? Number(prestamo.cuotaInicial)
      : 0;
    const montoFinanciado = prestamo.monto ? Number(prestamo.monto) : 0;
    const precioContado = prestamo.precioProducto?.precio
      ? Number(prestamo.precioProducto.precio)
      : montoFinanciado + abonoInicial;
    const interesTotal = prestamo.interesTotal
      ? Number(prestamo.interesTotal)
      : 0;
    const totalAPagar = montoFinanciado + interesTotal;

    const cuotaPromedio = prestamo.cuotas?.length
      ? Number(prestamo.cuotas[0].monto)
      : 0;

    const frecuencia = (() => {
      switch (prestamo.frecuenciaPago) {
        case 'DIARIO':
          return 'DIARIO' as any;
        case 'SEMANAL':
          return 'SEMANAL' as any;
        case 'QUINCENAL':
          return 'QUINCENAL' as any;
        case 'MENSUAL':
          return 'MENSUAL' as any;
        default:
          return undefined;
      }
    })();

    let saldo = totalAPagar;
    const cuotas = (prestamo.cuotas || []).map((c) => {
      const valorCuota = Number(c.monto);
      saldo = Math.max(0, saldo - valorCuota);
      return {
        numero: Number(c.numeroCuota),
        fechaVenc: fmtFecha(c.fechaVencimiento),
        capital: Number(c.montoCapital ?? 0),
        interes: Number(c.montoInteres ?? 0),
        valorCuota,
        saldo,
      };
    });

    const data: ContratoData = {
      numeroPrestamo: prestamo.numeroPrestamo,
      tipo: 'CREDITO',
      fechaContrato: fmtFechaFormatoLargo(new Date(fechaParsed)),

      clienteNombre,
      clienteCedula: String(prestamo.cliente?.dni ?? ''),
      clienteTelefono: prestamo.cliente?.telefono
        ? String(prestamo.cliente?.telefono)
        : undefined,
      clienteDireccion: prestamo.cliente?.direccion
        ? String(prestamo.cliente?.direccion)
        : undefined,
      referencia1: ref1 || undefined,
      referencia2: ref2 || undefined,

      articulo: prestamo.producto?.nombre || 'Artículo',
      marca: prestamo.producto?.marca
        ? String(prestamo.producto?.marca)
        : undefined,
      modelo: prestamo.producto?.modelo
        ? String(prestamo.producto?.modelo)
        : undefined,

      precioContado,
      abonoInicial,
      montoFinanciado,
      tasaInteres: prestamo.tasaInteres ? Number(prestamo.tasaInteres) : 0,
      interesTotal,
      totalAPagar,

      numeroCuotas: prestamo.cantidadCuotas
        ? Number(prestamo.cantidadCuotas)
        : undefined,
      frecuencia,
      valorCuota: cuotaPromedio,
      fechaPrimerPago: prestamo.cuotas?.length
        ? fmtFecha(prestamo.cuotas[0].fechaVencimiento)
        : undefined,
      fechaUltimoPago: prestamo.cuotas?.length
        ? fmtFecha(prestamo.cuotas[prestamo.cuotas.length - 1].fechaVencimiento)
        : undefined,
      cuotas,

      vendedorNombre: vendedorNombre || undefined,
    };

    return generarContratoPDF(data);
  }


  /**
   * Genera tabla de amortización (cuota fija).
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

    const tasaPeriodo = tasaTotal / 100;

    if (tasaPeriodo === 0) {
      const cuotaFija = Math.round(capital / numCuotas);
      let saldo = capital;
      const tabla = Array.from({ length: numCuotas }, (_, i) => {
        const esUltima = i === numCuotas - 1;
        const montoCapital = esUltima ? saldo : Math.floor(capital / numCuotas);
        saldo = Math.max(0, saldo - montoCapital);
        return {
          numeroCuota: i + 1,
          montoCapital,
          montoInteres: 0,
          monto: montoCapital,
          saldoRestante: saldo,
        };
      });

      return {
        cuotaFija,
        interesTotal: 0,
        tabla,
      };
    }

    const cuotaFijaDecimal =
      (capital * tasaPeriodo) / (1 - Math.pow(1 + tasaPeriodo, -numCuotas));
    const cuotaFija = Math.round(cuotaFijaDecimal);

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
      const esUltima = i === numCuotas - 1;
      const interesPeriodo = Math.round(saldo * tasaPeriodo);

      let capitalPeriodo = esUltima ? saldo : cuotaFija - interesPeriodo;
      capitalPeriodo = Math.min(saldo, Math.max(0, capitalPeriodo));

      saldo = Math.max(0, saldo - capitalPeriodo);
      interesTotalAcumulado += interesPeriodo;

      tabla.push({
        numeroCuota: i + 1,
        montoCapital: capitalPeriodo,
        montoInteres: interesPeriodo,
        monto: capitalPeriodo + interesPeriodo,
        saldoRestante: saldo,
      });
    }

    return {
      cuotaFija,
      interesTotal: interesTotalAcumulado,
      tabla,
    };
  }

  private calcularInteresPlano(
    capital: number,
    tasaTotal: number,
    numCuotas: number,
  ) {
    if (numCuotas <= 0 || capital <= 0) {
      return { cuotaFija: 0, interesTotal: 0, tabla: [] };
    }

    const interesTotal = Math.round(capital * (tasaTotal / 100));
    const totalFinanciado = capital + interesTotal;
    const cuotaBase = Math.floor(totalFinanciado / numCuotas);

    let capitalRestante = capital;
    let interesRestante = interesTotal;
    const interesBase = Math.floor(interesTotal / numCuotas);

    const tabla: Array<{
      numeroCuota: number;
      montoCapital: number;
      montoInteres: number;
      monto: number;
      saldoRestante: number;
    }> = [];

    for (let i = 0; i < numCuotas; i++) {
      const esUltima = i === numCuotas - 1;

      const monto = esUltima
        ? capitalRestante + interesRestante
        : cuotaBase;

      const montoInteres = esUltima
        ? interesRestante
        : Math.min(interesBase, interesRestante);

      const montoCapital = Math.max(0, monto - montoInteres);

      capitalRestante = Math.max(0, capitalRestante - montoCapital);
      interesRestante = Math.max(0, interesRestante - montoInteres);

      tabla.push({
        numeroCuota: i + 1,
        montoCapital,
        montoInteres,
        monto,
        saldoRestante: capitalRestante + interesRestante,
      });
    }

    return {
      cuotaFija: cuotaBase,
      interesTotal,
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

    const shiftDays = (days: number) =>
      new Date(`${key}T12:00:00-05:00`).getTime() + days * 86_400_000;

    // Para diario/mensual: mover al lunes (siguiente día hábil)
    if (
      frecuencia === FrecuenciaPago.DIARIO ||
      frecuencia === FrecuenciaPago.MENSUAL
    ) {
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

    const addDaysSkippingSunday = (
      startKey: string,
      daysToAdd: number,
    ): string => {
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
      const next = new Date(
        toNoonBogota(startKey).getTime() + daysToAdd * 86_400_000,
      );
      return getBogotaDayKey(next);
    };

    const addMonths = (startKey: string, monthsToAdd: number): string => {
      const [yStr, mStr, dStr] = startKey.split('-');
      const y = Number(yStr);
      const m = Number(mStr);
      const d = Number(dStr);
      if (!y || !m || !d) return startKey;

      const totalMonths = m - 1 + monthsToAdd;
      const newY = y + Math.floor(totalMonths / 12);
      const newM0 = ((totalMonths % 12) + 12) % 12;
      const newM = newM0 + 1;

      // Clamp del día al último del mes
      const firstNextMonth =
        newM === 12
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
    const raw = String(dateStr || '').trim();
    if (raw.includes('T')) {
      const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw);
      const normalized = hasTimezone
        ? raw
        : `${raw.length === 16 ? `${raw}:00` : raw}-05:00`;
      const parsed = new Date(normalized);
      if (!isNaN(parsed.getTime())) return parsed;
    }

    const key = raw;
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
      const totalMonths = m - 1 + monthsToAdd;
      const newY = y + Math.floor(totalMonths / 12);
      const newM0 = ((totalMonths % 12) + 12) % 12;
      const newM = newM0 + 1;
      const pad2 = (n: number) => String(n).padStart(2, '0');
      const firstNext =
        newM === 12
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
      const shifted = new Date(
        base.getTime() + Math.round(decimales * 30) * 86_400_000,
      );
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

    switch (tipoAmortizacion) {
      case TipoAmortizacion.INTERES_PLANO: {
        const amortizacion = this.calcularInteresPlano(
          monto,
          tasaInteres,
          cantidadCuotas,
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
        break;
      }
      case TipoAmortizacion.FRANCESA: {
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
        break;
      }
      case TipoAmortizacion.INTERES_SIMPLE:
      default: {
        const mesesInteres = Math.max(1, plazoMeses);
        interesTotal = Math.round((monto * tasaInteres * mesesInteres) / 100);

        const baseCapital = Math.floor(monto / cantidadCuotas);
        const baseInteres = Math.floor(interesTotal / cantidadCuotas);

        let capitalRestante = monto;
        let interesRestante = interesTotal;

        cuotas = Array.from({ length: cantidadCuotas }, (_, i) => {
          const esUltima = i === cantidadCuotas - 1;

          const capitalCuota = esUltima ? capitalRestante : baseCapital;
          const interesCuota = esUltima ? interesRestante : baseInteres;

          capitalRestante = Math.max(0, capitalRestante - capitalCuota);
          interesRestante = Math.max(0, interesRestante - interesCuota);

          const montoCuota = capitalCuota + interesCuota;

          return {
            numeroCuota: i + 1,
            fechaVencimiento: this.calcularFechaVencimiento(
              fechaBase,
              fechaPrimerCobro ? i + 1 : i + 2,
              frecuenciaPago,
            ),
            monto: montoCuota,
            montoCapital: capitalCuota,
            montoInteres: interesCuota,
            estado: esContado ? EstadoCuota.PAGADA : EstadoCuota.PENDIENTE,
            montoPagado: esContado ? montoCuota : 0,
          };
        });
        break;
      }
    }

    return { interesTotal: Math.round(interesTotal), cuotas };
  }

  async getAllLoans(
    filters: {
      estado?: string;
      ruta?: string;
      search?: string;
      tipo?: string;
      page?: number;
      limit?: number;
    },
    actor?: { id?: string; rol?: RolUsuario | string } | null,
  ) {
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
        ...this.collectorLoanScope(actor),
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
          ...((where.cliente as any) || {}),
          asignacionesRuta: {
            some: {
              ...((where.cliente as any)?.asignacionesRuta?.some || {}),
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
                fechaVencimientoProrroga: true,
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
      const whereStats = {
        eliminadoEn: null,
        ...this.collectorLoanScope(actor),
        estado: {
          notIn: [EstadoPrestamo.BORRADOR, EstadoPrestamo.PENDIENTE_APROBACION],
        },
      };
      const { startDate: hoyInicioBogota } = getBogotaStartEndOfDay(new Date());
      const overdueCuotaScope: Prisma.PrestamoWhereInput = {
        cuotas: {
          some: {
            estado: {
              in: [
                EstadoCuota.PENDIENTE,
                EstadoCuota.PARCIAL,
                EstadoCuota.VENCIDA,
              ],
            },
            OR: [
              {
                fechaVencimientoProrroga: null,
                fechaVencimiento: { lt: hoyInicioBogota },
              },
              {
                fechaVencimientoProrroga: { lt: hoyInicioBogota },
              },
            ],
          },
        },
      };
      const moraStatsWhere: Prisma.PrestamoWhereInput = {
        ...whereStats,
        saldoPendiente: { gt: 0 },
        OR: [{ estado: EstadoPrestamo.EN_MORA }, overdueCuotaScope],
      };
      const activosStatsWhere: Prisma.PrestamoWhereInput = {
        ...whereStats,
        estado: EstadoPrestamo.ACTIVO,
        saldoPendiente: { gt: 0 },
        NOT: overdueCuotaScope,
      };

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
        this.prisma.prestamo.count({ where: activosStatsWhere }),
        this.prisma.prestamo.count({ where: moraStatsWhere }),
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
            interesTotal: true,
            saldoPendiente: true,
          },
        }),
        this.prisma.prestamo.aggregate({
          where: moraStatsWhere,
          _sum: {
            saldoPendiente: true,
          },
        }),
      ]);

      // Transformar datos para el frontend de forma segura
      const hoyKeyBogota = getBogotaDayKey(new Date());
      const utcDateKey = (d: Date): string => {
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      const prestamosTransformados = prestamos.map((prestamo) => {
        try {
          // Calcular campos adicionales
          const cuotas = prestamo.cuotas || [];
          const cuotasPagadas = cuotas.filter(
            (c) => c.estado === EstadoCuota.PAGADA,
          ).length;
          const cuotasTotales = cuotas.length;

          const cuotasVencidasReal = cuotas.filter((c: any) => {
            if (
              ![
                EstadoCuota.PENDIENTE,
                EstadoCuota.PARCIAL,
                EstadoCuota.VENCIDA,
              ].includes(c.estado)
            ) {
              return false;
            }
            const eff = c?.fechaVencimientoProrroga
              ? new Date(c.fechaVencimientoProrroga)
              : new Date(c.fechaVencimiento);
            if (!eff || isNaN(eff.getTime())) return false;
            const key = utcDateKey(eff);
            return !!key && key < hoyKeyBogota;
          });

          const cuotasVencidas = cuotasVencidasReal.length;

          // Manejar valores numéricos de forma segura
          const monto = Number(prestamo.monto) || 0;
          const interesTotal = Number(prestamo.interesTotal) || 0;
          const saldoPendiente = Number(prestamo.saldoPendiente) || 0;
          const totalPagado = Number(prestamo.totalPagado) || 0;

          const montoTotal = monto + interesTotal;
          // Si todas las cuotas están pagadas, el monto pendiente es 0 (fix bug redondeo)
          // Truncar a entero (0 decimales) para COP que no usa centavos
          const montoPendiente =
            cuotasPagadas === cuotasTotales ? 0 : Math.trunc(saldoPendiente);
          const montoPagado = totalPagado;

          // Calcular mora acumulada de forma segura
          const moraAcumulada = cuotasVencidasReal.reduce(
            (sum: number, cuota: any) =>
              sum + (Number(cuota.montoInteresMora) || 0),
            0,
          );

          const estado =
            cuotasVencidas > 0
              ? EstadoPrestamo.EN_MORA
              : prestamo.estado === EstadoPrestamo.EN_MORA
              ? EstadoPrestamo.ACTIVO
              : prestamo.estado || EstadoPrestamo.BORRADOR;

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
            montoPrestado: monto,
            interesTotal,
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
            estado,
            riesgo: prestamo.cliente.nivelRiesgo || NivelRiesgo.VERDE,
            ruta: rutaAsignada,
            rutaNombre,
            vendedor: prestamo.creadoPor?.nombres || 'Sin asignar',
            vendedorRol: prestamo.creadoPor?.rol || '',
            creadoPorRol: prestamo.creadoPor?.rol || '',
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
            montoPrestado: 0,
            interesTotal: 0,
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
          montoTotal:
            Number(totales._sum?.monto || 0) +
            Number(totales._sum?.interesTotal || 0),
          montoPrestado: Number(totales._sum?.monto || 0),
          interesTotal: Number(totales._sum?.interesTotal || 0),
          montoPendiente: Math.trunc(Number(totales._sum?.saldoPendiente || 0)),
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
          montoPrestado: 0,
          interesTotal: 0,
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

  async getLoanById(
    id: string,
    actor?: { id?: string; rol?: RolUsuario | string } | null,
  ) {
    try {
      const prestamo = await this.prisma.prestamo.findFirst({
        where: {
          id,
          eliminadoEn: null, // Solo si no está eliminado
          ...this.collectorLoanScope(actor),
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

      // Obtener registros de visita del cliente para mostrar estado de ausencia en plan de pagos
      const resolveFechaGestionCuota = (cuota: any) => {
        return (
          cuota.fechaVencimientoProrroga ||
          cuota.fechaVencimiento ||
          cuota.fecha ||
          null
        );
      };

      const fechasCuotas = Array.from(
        new Set(
          (prestamo.cuotas || [])
            .map((cuota: any) => {
              const fechaGestion = resolveFechaGestionCuota(cuota);
              return fechaGestion ? getBogotaDayKey(fechaGestion) : null;
            })
            .filter(Boolean),
        ),
      );

      type VisitaConRelaciones = {
        fechaVisita: string;
        estadoVisita: string;
        notas: string | null;
        creadoEn: Date;
        ruta: {
          id: string;
          nombre: string;
          codigo: string;
        } | null;
        cobrador: {
          id: string;
          nombres: string;
          apellidos: string;
        } | null;
      };

      const registrosVisitas =
        fechasCuotas.length > 0
          ? await this.prisma.registroVisita.findMany({
              where: {
                clienteId: prestamo.clienteId,
                fechaVisita: { in: fechasCuotas },
              },
              select: {
                fechaVisita: true,
                estadoVisita: true,
                notas: true,
                creadoEn: true,
                ruta: {
                  select: {
                    id: true,
                    nombre: true,
                    codigo: true,
                  },
                },
                cobrador: {
                  select: {
                    id: true,
                    nombres: true,
                    apellidos: true,
                  },
                },
              },
            })
          : [];

      const visitasMap = new Map(
        registrosVisitas.map((r: VisitaConRelaciones) => [r.fechaVisita, r]),
      );

      // Agregar estadoVisita a cada cuota
      prestamo.cuotas = prestamo.cuotas.map((cuota: any) => {
        const fechaGestion = resolveFechaGestionCuota(cuota);
        const fechaKey = fechaGestion ? getBogotaDayKey(fechaGestion) : null;
        const gestion = fechaKey
          ? (visitasMap.get(fechaKey) as VisitaConRelaciones | undefined)
          : undefined;

        return {
          ...cuota,
          estadoVisita: gestion?.estadoVisita || null,
          notasVisita: gestion?.notas || null,
          fechaVisita: gestion?.fechaVisita || null,
          rutaVisita: gestion?.ruta
            ? {
                id: gestion.ruta.id,
                nombre: gestion.ruta.nombre,
                codigo: gestion.ruta.codigo,
              }
            : null,
          cobradorVisita: gestion?.cobrador
            ? `${gestion.cobrador.nombres || ''} ${gestion.cobrador.apellidos || ''}`.trim()
            : null,
        };
      });

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
      const prestamo = await this.prisma.prestamo.findFirst({
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
          numeroPrestamo: prestamo.numeroPrestamo,
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

  private async reversarImpactoContableArticuloArchivado(
    tx: any,
    prestamo: any,
    userId: string,
  ) {
    if (String(prestamo.tipoPrestamo || '').toUpperCase() !== 'ARTICULO')
      return;

    const asientoVenta = await tx.journalEntry.findFirst({
      where: {
        referenceType: 'VENTA_ARTICULO',
        referenceId: prestamo.id,
      },
      include: { lines: true },
    });

    if (!asientoVenta?.id) return;

    const asientoReverso = await tx.journalEntry.findFirst({
      where: {
        referenceType: 'AJUSTE',
        referenceId: `ARCHIVO:${prestamo.id}`,
      },
      select: { id: true },
    });

    if (asientoReverso?.id) return;

    const linesOriginales = asientoVenta.lines || [];
    const cajaLine = linesOriginales.find((line: any) => line.cajaId);
    const cuotaInicial = linesOriginales
      .filter((line: any) => line.cajaId)
      .reduce((sum: number, line: any) => {
        return (
          sum + Number(line.debitAmount || 0) - Number(line.creditAmount || 0)
        );
      }, 0);
    const precioVenta = linesOriginales
      .filter((line: any) => String(line.accountCode || '').startsWith('3.'))
      .reduce((sum: number, line: any) => {
        return (
          sum + Number(line.creditAmount || 0) - Number(line.debitAmount || 0)
        );
      }, 0);
    const montoFinanciado = linesOriginales
      .filter((line: any) => String(line.accountCode || '') === '1.3.1')
      .reduce((sum: number, line: any) => {
        return (
          sum + Number(line.debitAmount || 0) - Number(line.creditAmount || 0)
        );
      }, 0);
    const costoArticulo = linesOriginales
      .filter((line: any) => String(line.accountCode || '') === '5.1')
      .reduce((sum: number, line: any) => {
        return (
          sum + Number(line.debitAmount || 0) - Number(line.creditAmount || 0)
        );
      }, 0);

    const trxCuotaInicial =
      cuotaInicial > 0
        ? await tx.transaccion.findFirst({
            where: {
              tipo: TipoTransaccion.INGRESO,
              tipoReferencia: 'CUOTA_INICIAL',
              referenciaId: prestamo.id,
            },
            select: { id: true, cajaId: true },
          })
        : null;
    const cajaId = cajaLine?.cajaId || trxCuotaInicial?.cajaId;

    if (cuotaInicial > 0 && cajaId) {
      await tx.transaccion.create({
        data: {
          numeroTransaccion: this.generarNumeroTransaccion('REV'),
          cajaId,
          tipo: TipoTransaccion.EGRESO,
          monto: cuotaInicial,
          descripcion: `Reverso cuota inicial por archivo crédito artículo #${prestamo.numeroPrestamo}`,
          creadoPorId: userId,
          tipoReferencia: 'REVERSO_CUOTA_INICIAL',
          referenciaId: prestamo.id,
        },
      });
    }

    const lines: any[] = [];
    if (precioVenta > 0) {
      lines.push({ accountCode: '3.4', debitAmount: precioVenta });
    }
    if (cuotaInicial > 0 && cajaId) {
      lines.push({
        accountCode: cajaLine?.accountCode || '1.1.1',
        creditAmount: cuotaInicial,
        cajaId,
        cajaDelta: -cuotaInicial,
      });
    }
    if (montoFinanciado > 0) {
      lines.push({ accountCode: '1.3.1', creditAmount: montoFinanciado });
    }
    if (costoArticulo > 0) {
      lines.push(
        { accountCode: '1.5', debitAmount: costoArticulo },
        { accountCode: '5.1', creditAmount: costoArticulo },
      );
    }

    if (lines.length >= 2) {
      await this.ledgerService.registrarAsiento(
        {
          referenceType: 'AJUSTE',
          referenceId: `ARCHIVO:${prestamo.id}`,
          description: `Reverso venta de artículo por archivo de crédito #${prestamo.numeroPrestamo}`,
          createdBy: userId,
          lines,
        },
        tx,
      );
    }
  }

  private async restaurarImpactoContableArticuloArchivado(
    tx: any,
    prestamo: any,
    userId: string,
  ) {
    if (String(prestamo.tipoPrestamo || '').toUpperCase() !== 'ARTICULO')
      return;

    const asientoArchivo = await tx.journalEntry.findFirst({
      where: {
        referenceType: 'AJUSTE',
        referenceId: `ARCHIVO:${prestamo.id}`,
      },
      include: { lines: true },
    });

    if (!asientoArchivo?.id) return;

    const asientoRestauracion = await tx.journalEntry.findFirst({
      where: {
        referenceType: 'AJUSTE',
        referenceId: `RESTAURACION_ARCHIVO:${prestamo.id}`,
      },
      select: { id: true },
    });

    if (asientoRestauracion?.id) return;

    const cajaLine = (asientoArchivo.lines || []).find(
      (line: any) => line.cajaId,
    );
    const cuotaInicial = cajaLine
      ? Math.abs(
          Number(cajaLine.creditAmount || 0) -
            Number(cajaLine.debitAmount || 0),
        )
      : 0;

    if (cuotaInicial > 0 && cajaLine?.cajaId) {
      const yaExiste = await tx.transaccion.findFirst({
        where: {
          tipo: TipoTransaccion.INGRESO,
          tipoReferencia: 'RESTAURACION_CUOTA_INICIAL',
          referenciaId: prestamo.id,
        },
        select: { id: true },
      });

      if (!yaExiste?.id) {
        await tx.transaccion.create({
          data: {
            numeroTransaccion: this.generarNumeroTransaccion('RES'),
            cajaId: cajaLine.cajaId,
            tipo: TipoTransaccion.INGRESO,
            monto: cuotaInicial,
            descripcion: `Restauración cuota inicial crédito artículo #${prestamo.numeroPrestamo}`,
            creadoPorId: userId,
            tipoReferencia: 'RESTAURACION_CUOTA_INICIAL',
            referenciaId: prestamo.id,
          },
        });
      }
    }

    const lines = (asientoArchivo.lines || [])
      .map((line: any) => {
        const debitAmount = Number(line.debitAmount || 0);
        const creditAmount = Number(line.creditAmount || 0);
        const restoredLine: any = {
          accountCode: line.accountCode,
        };

        if (creditAmount > 0) restoredLine.debitAmount = creditAmount;
        if (debitAmount > 0) restoredLine.creditAmount = debitAmount;
        if (line.cajaId) {
          restoredLine.cajaId = line.cajaId;
          restoredLine.cajaDelta = -Number(line.cajaDelta || 0);
        }

        return restoredLine;
      })
      .filter(
        (line: any) =>
          Number(line.debitAmount || 0) > 0 ||
          Number(line.creditAmount || 0) > 0,
      );

    if (lines.length >= 2) {
      await this.ledgerService.registrarAsiento(
        {
          referenceType: 'AJUSTE',
          referenceId: `RESTAURACION_ARCHIVO:${prestamo.id}`,
          description: `Restauración venta de artículo por crédito #${prestamo.numeroPrestamo}`,
          createdBy: userId,
          lines,
        },
        tx,
      );
    }
  }

  async updateLoan(id: string, updateData: UpdateLoanData, userId: string) {
    try {
      const prestamo = await this.prisma.prestamo.findFirst({
        where: { id, eliminadoEn: null },
      });

      if (!prestamo) {
        throw new NotFoundException('Préstamo no encontrado');
      }

      if (
        (updateData as any)?.version != null &&
        Number((updateData as any).version) !== Number(prestamo.version || 1)
      ) {
        throw new ConflictException(
          'El préstamo fue actualizado por otro usuario. Recarga la información antes de guardar.',
        );
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
      const data: Record<string, unknown> = {
        estadoSincronizacion: 'PENDIENTE',
        version: { increment: 1 },
      };

      if (updateData.monto !== undefined) data.monto = updateData.monto;
      if (updateData.tasaInteres !== undefined)
        data.tasaInteres = updateData.tasaInteres;
      if (updateData.plazoMeses !== undefined)
        data.plazoMeses = updateData.plazoMeses;
      if (updateData.cantidadCuotas !== undefined)
        data.cantidadCuotas = updateData.cantidadCuotas;
      if (updateData.frecuenciaPago !== undefined)
        data.frecuenciaPago = updateData.frecuenciaPago;
      if (updateData.estado !== undefined) {
        const estadosValidos = Object.values(EstadoPrestamo);
        if (estadosValidos.includes(updateData.estado)) {
          data.estado = updateData.estado;
        }
      }
      if (updateData.notas !== undefined) data.notas = updateData.notas;
      if (updateData.garantia !== undefined)
        data.garantia = updateData.garantia;
      if (updateData.tasaInteresMora !== undefined)
        data.tasaInteresMora = updateData.tasaInteresMora;
      if (updateData.cuotaInicial !== undefined)
        data.cuotaInicial = updateData.cuotaInicial;
      if (updateData.tipoAmortizacion !== undefined)
        data.tipoAmortizacion = updateData.tipoAmortizacion;
      if (updateData.fechaInicio !== undefined)
        data.fechaInicio = new Date(updateData.fechaInicio);

      const newMonto =
        data.monto === undefined ? Number(prestamo.monto) : Number(data.monto);
      const newTasa =
        data.tasaInteres === undefined
          ? Number(prestamo.tasaInteres)
          : Number(data.tasaInteres);
      const newPlazo =
        data.plazoMeses === undefined
          ? Number(prestamo.plazoMeses)
          : Number(data.plazoMeses);
      const newFechaInicio =
        data.fechaInicio === undefined
          ? prestamo.fechaInicio
          : (data.fechaInicio as Date);
      const newInteresTotal = (newMonto * newTasa * newPlazo) / 100;

      // Regenerate cuotas if cantidadCuotas, monto, tasaInteres, frecuenciaPago, tipoAmortizacion, plazoMeses or fechaInicio changed
      const shouldRegenerateCuotas =
        data.cantidadCuotas !== undefined ||
        data.monto !== undefined ||
        data.tasaInteres !== undefined ||
        data.frecuenciaPago !== undefined ||
        data.tipoAmortizacion !== undefined ||
        data.plazoMeses !== undefined ||
        data.fechaInicio !== undefined;

      if (shouldRegenerateCuotas) {
        const cantidadCuotas =
          data.cantidadCuotas !== undefined
            ? Number(data.cantidadCuotas)
            : (prestamo.cantidadCuotas ?? 0);
        const frecuenciaPago = (
          data.frecuenciaPago !== undefined
            ? data.frecuenciaPago
            : prestamo.frecuenciaPago
        ) as FrecuenciaPago;
        const tipoAmortizacion = (
          data.tipoAmortizacion !== undefined
            ? data.tipoAmortizacion
            : prestamo.tipoAmortizacion || TipoAmortizacion.INTERES_PLANO
        ) as TipoAmortizacion;

        // Delete existing cuotas
        await this.prisma.cuota.deleteMany({
          where: { prestamoId: id },
        });

        // Generate new cuotas using helper
        const { cuotas: planCuotas, interesTotal: planInteresTotal } =
          this.calculateInterestAndCuotas(
            tipoAmortizacion,
            newMonto,
            newTasa,
            cantidadCuotas,
            newPlazo,
            frecuenciaPago,
            newFechaInicio,
            prestamo.fechaPrimerCobro,
            false, // esContado
          );

        // Homogeneizar vencimiento del préstamo con el cronograma real
        if (planCuotas.length > 0) {
          data.fechaFin = new Date(
            planCuotas[planCuotas.length - 1].fechaVencimiento,
          );
        }

        const cuotasData = planCuotas.map((c) => ({
          numeroCuota: c.numeroCuota,
          fechaVencimiento: c.fechaVencimiento,
          monto: c.monto,
          montoCapital: c.montoCapital,
          montoInteres: c.montoInteres,
          estado: c.estado,
          montoPagado: c.montoPagado,
          prestamoId: id,
        }));

        // Create new cuotas
        await this.prisma.cuota.createMany({
          data: cuotasData,
        });

        data.cantidadCuotas = cantidadCuotas;
        data.interesTotal = planInteresTotal;
        data.saldoPendiente =
          newMonto + planInteresTotal - Number(prestamo.totalPagado || 0);
      } else {
        const shouldRecalculateFinancing =
          data.monto !== undefined ||
          data.tasaInteres !== undefined ||
          data.plazoMeses !== undefined ||
          data.fechaInicio !== undefined;

        if (shouldRecalculateFinancing) {
          const roundedInteres = Math.round(newInteresTotal);
          data.interesTotal = roundedInteres;
          data.saldoPendiente =
            newMonto + roundedInteres - Number(prestamo.totalPagado || 0);
        }
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
        this.logger.log(
          `[DEBUG] Actualizando archivos para préstamo ${id}. Archivos recibidos: ${Array.isArray(archivos) ? archivos.length : 'N/A'}`,
        );

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
            const urlFinal =
              typeof url === 'string' && url.startsWith('http')
                ? url
                : undefined;

            const rutaValue = String(
              archivo.ruta ||
                archivo.path ||
                archivo.nombreAlmacenamiento ||
                '',
            ).trim();
            const tipoArchivoValue = String(
              archivo.tipoArchivo || '',
            ).toLowerCase();
            const isVideo = tipoArchivoValue.startsWith('video/');

            const urlDerivada =
              !urlFinal && cloudName && rutaValue
                ? `https://res.cloudinary.com/${cloudName}/${isVideo ? 'video' : 'image'}/upload/${rutaValue}`
                : undefined;

            return {
              prestamoId: id,
              tipoContenido: archivo.tipoContenido,
              tipoArchivo: archivo.tipoArchivo,
              formato:
                archivo.formato || archivo.tipoArchivo?.split('/')[1] || 'jpg',
              nombreOriginal: archivo.nombreOriginal,
              nombreAlmacenamiento:
                archivo.nombreAlmacenamiento || archivo.nombreOriginal,
              ruta: archivo.ruta || archivo.path,
              url: urlFinal || urlDerivada,
              tamanoBytes: archivo.tamanoBytes || 0,
              subidoPorId:
                archivo.subidoPorId ||
                userId ||
                prestamoActualizado.creadoPorId,
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
        const cambioEstado =
          data.estado !== undefined && estadoAnterior !== estadoNuevo;
        if (cambioEstado) {
          const clienteNombre =
            `${prestamoActualizado.cliente?.nombres || ''} ${prestamoActualizado.cliente?.apellidos || ''}`.trim();
          const tituloBase = `Crédito ${prestamoActualizado.numeroPrestamo || ''} actualizado`;
          const msgBase = `El crédito ${prestamoActualizado.numeroPrestamo || ''} del cliente ${clienteNombre || ''} cambió de ${estadoAnterior} a ${estadoNuevo}.`;

          let actorNombre = '';
          try {
            const usuario = await this.prisma.usuario.findUnique({
              where: { id: userId },
              select: { nombres: true, apellidos: true },
            });
            if (usuario) {
              actorNombre =
                `${usuario.nombres || ''} ${usuario.apellidos || ''}`.trim();
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
        this.logger.error(
          'Error enviando notificaciones de cambio de estado:',
          e,
        );
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

      const prestamoRestaurado = await this.prisma.$transaction(async (tx) => {
        const restaurado = await tx.prestamo.update({
          where: { id },
          data: {
            estado: EstadoPrestamo.ACTIVO,
            eliminadoEn: null,
            estadoSincronizacion: 'PENDIENTE',
          },
        });

        await this.restaurarImpactoContableArticuloArchivado(
          tx,
          prestamo,
          userId,
        );

        return restaurado;
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

      this.notificacionesGateway.broadcastPrestamosActualizados({
        accion: 'RESTAURAR',
        prestamoId: prestamo.id,
      });
      this.notificacionesGateway.broadcastDashboardsActualizados({});

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
      const numeroPrestamo = await this.generarNumeroPrestamo(
        createLoanDto.tipoPrestamo,
      );

      // Calcular fecha fin
      const fechaInicio = this.parseBogotaDayKey(createLoanDto.fechaInicio);
      const fechaFin = new Date(fechaInicio);
      fechaFin.setMonth(fechaFin.getMonth() + createLoanDto.plazoMeses);

      const fechaPrimerCobroParsed = createLoanDto.fechaPrimerCobro
        ? this.parseBogotaDayKey(createLoanDto.fechaPrimerCobro)
        : undefined;
      if (fechaPrimerCobroParsed) {
        const hoyKey = getBogotaDayKey(new Date());
        const { startDate: hoyStart } = getBogotaStartEndOfDayFromKey(hoyKey);
        if (fechaPrimerCobroParsed.getTime() < hoyStart.getTime()) {
          throw new BadRequestException(
            'La fecha de primer cobro no puede ser un día pasado.',
          );
        }
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
      this.logger.log(`[createLoan] DTO recibido: tipoAmortizacion=${createLoanDto.tipoAmortizacion}, monto=${createLoanDto.monto}, cuotas=${cantidadCuotas}`);
      const tipoAmort =
        createLoanDto.tipoAmortizacion || TipoAmortizacion.INTERES_PLANO;
      const tasaInteres = createLoanDto.tasaInteres || 0;
      this.logger.log(`[createLoan] tipoAmort resuelto: ${tipoAmort}`);

      const calculation = this.calculateInterestAndCuotas(
        tipoAmort,
        createLoanDto.monto,
        tasaInteres,
        cantidadCuotas,
        createLoanDto.plazoMeses,
        createLoanDto.frecuenciaPago,
        fechaInicio,
        fechaPrimerCobroParsed,
        false,
      );
      const interesTotal = calculation.interesTotal;
      const cuotasData = calculation.cuotas.map((cuota) => ({
        numeroCuota: cuota.numeroCuota,
        fechaVencimiento: cuota.fechaVencimiento,
        monto: cuota.monto,
        montoCapital: cuota.montoCapital,
        montoInteres: cuota.montoInteres,
        estado: EstadoCuota.PENDIENTE as typeof EstadoCuota.PENDIENTE,
      }));

      // Homogeneizar vencimiento del préstamo con el cronograma real
      const fechaFinReal =
        cuotasData.length > 0
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
          interesTotal: Math.round(interesTotal),
          saldoPendiente: Math.round(
            createLoanDto.monto +
              interesTotal -
              (createLoanDto.cuotaInicial || 0),
          ),
          notas: createLoanDto.notas ? String(createLoanDto.notas) : undefined,
          garantia: createLoanDto.garantia
            ? String(createLoanDto.garantia)
            : undefined,
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
      // Se registra como transacción de INGRESO y reduce la cartera por cobrar.
      const isArticulo =
        String(createLoanDto.tipoPrestamo || '').toUpperCase() === 'ARTICULO';
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
          select: { id: true, codigo: true },
        });

        const cajaPrincipal = await this.prisma.caja.findFirst({
          where: {
            activa: true,
            OR: [{ codigo: 'CAJA-PRINCIPAL' }, { tipo: 'PRINCIPAL' }],
          },
          orderBy: [{ codigo: 'asc' as any }],
          select: { id: true, codigo: true },
        });

        // Determinar caja destino: Cuota Inicial debe registrarse en Caja Oficina.
        // Si no existe, usar Caja Principal; si no existe, la caja de ruta.
        const cajaDestino = cajaOficina || cajaPrincipal || cajaRuta;
        const cajaIdDestino = cajaDestino?.id;

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
            const numeroTransaccion = this.generarNumeroTransaccion();
            await this.prisma.$transaction(async (tx) => {
              await tx.transaccion.create({
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
              });

              await this.ledgerService.registrarAsiento(
                {
                  referenceType: 'PAGO',
                  referenceId: prestamo.id,
                  description: `Cuota inicial crédito artículo #${prestamo.numeroPrestamo}`,
                  createdBy: createLoanDto.creadoPorId,
                  lines: [
                    {
                      accountCode:
                        cajaDestino?.codigo === 'CAJA-BANCO'
                          ? '1.1.2'
                          : '1.1.1',
                      debitAmount: cuotaInicial,
                      cajaId: cajaIdDestino,
                      cajaDelta: +cuotaInicial,
                    },
                    {
                      accountCode: '1.3.1',
                      creditAmount: cuotaInicial,
                    },
                  ],
                },
                tx,
              );
            });
          }
        }
      }

      this.logger.log(
        `Loan created successfully: ${prestamo.id} (${tipoAmort})`,
      );

      // Crear solicitud de aprobación automáticamente
      const aprobacion = await this.prisma.aprobacion.create({
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
            tipoAmortizacion: prestamo.tipoAmortizacion,
            saldoPendiente: prestamo.saldoPendiente,
            valorArticulo:
              Number(prestamo.saldoPendiente || 0) +
              Number(prestamo.cuotaInicial || 0),
            cuotaInicial: prestamo.cuotaInicial,
            plazoMeses: prestamo.plazoMeses,
            cantidadCuotas: prestamo.cantidadCuotas,
            cuotas: prestamo.cantidadCuotas,
            tasaInteres: prestamo.tasaInteres,
            porcentaje: prestamo.tasaInteres,
            frecuenciaPago: prestamo.frecuenciaPago,
            fechaInicio: prestamo.fechaInicio,
            fechaFin: prestamo.fechaFin,
            interesTotal: prestamo.interesTotal,
            montoTotal: Number(prestamo.monto) + Number(prestamo.interesTotal || 0),
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
        datosNuevos: {
          id: prestamo.id,
          monto: Number(prestamo.monto),
          clienteId: prestamo.clienteId,
        },
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

      const { startDate: aprobacionInicio } = getBogotaStartEndOfDay(
        new Date(),
      );

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
      const inicioOriginalKey = fechaInicioOriginal
        ? getBogotaDayKey(fechaInicioOriginal)
        : null;
      const aprobacionKey = getBogotaDayKey(aprobacionInicio);

      if (
        inicioOriginalKey &&
        inicioOriginalKey < aprobacionKey &&
        prestamoConCuotas?.cuotas?.length
      ) {
        // Reagendar: calcular nuevo cronograma desde hoy
        const cuotasPendientes = prestamoConCuotas.cuotas.filter(
          (c) =>
            c.estado === EstadoCuota.PENDIENTE ||
            c.estado === EstadoCuota.VENCIDA,
        );

        if (cuotasPendientes.length > 0) {
          const nuevaFechaBase = new Date(aprobacionInicio);

          const frecuencia = prestamoConCuotas.frecuenciaPago;

          for (let i = 0; i < cuotasPendientes.length; i++) {
            const nuevaFechaVenc = this.calcularFechaVencimiento(
              nuevaFechaBase,
              i + 1,
              frecuencia,
            );
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

      // Descontar stock si es un préstamo de artículo (y maneja stock)
      if (
        prestamoActualizado.tipoPrestamo === 'ARTICULO' &&
        prestamoActualizado.productoId
      ) {
        if (
          prestamoActualizado.producto?.stock !== undefined &&
          prestamoActualizado.producto?.stock !== null
        ) {
          await this.descontarStockSiDisponible(prestamoActualizado.productoId);
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
          estado: 'ACTIVO',
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

  async getLoanCuotas(
    prestamoId: string,
    actor?: { id?: string; rol?: RolUsuario | string } | null,
  ) {
    try {
      if (this.isCollector(actor)) {
        const prestamo = await this.prisma.prestamo.findFirst({
          where: {
            id: prestamoId,
            eliminadoEn: null,
            ...this.collectorLoanScope(actor),
          },
          select: { id: true },
        });
        if (!prestamo?.id)
          throw new NotFoundException('Préstamo no encontrado');
      }

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
    let prestamoCreado: any = null;
    let aprobacionCreada: any = null;
    let efectoProvisionalCreado: any = null;
    let asignacionRutaCreadaId: string | null = null;
    let esAutoAprobadoFinal = false;
    let impactoProvisionalPrestamo: any = null;

    try {
      this.logger.log(
        `Creating loan for client ${data.clienteId}, type: ${data.tipoPrestamo}. Data: ${JSON.stringify(data)}`,
      );
      const idempotencyKey =
        (data as any).idempotencyKey?.toString().trim() || undefined;

      if (idempotencyKey) {
        const prestamoExistente = await this.prisma.prestamo.findFirst({
          where: { idempotencyKey },
          select: { id: true, numeroPrestamo: true },
        });

        if (prestamoExistente) {
          const aprobacionExistente = await this.prisma.aprobacion.findFirst({
            where: { idempotencyKey },
            select: { id: true, referenciaId: true },
          });

          return {
            mensaje: 'Préstamo ya registrado previamente.',
            prestamoId: prestamoExistente.id,
            numeroPrestamo: prestamoExistente.numeroPrestamo,
            aprobacionId: aprobacionExistente?.id || null,
            idempotentReplay: true,
          };
        }
      }

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

      const isArticulo =
        String(data.tipoPrestamo || '').toUpperCase() === 'ARTICULO';

      // Validar capital en la caja que realmente responderá por el desembolso.
      if (!isArticulo) {
        const montoDesembolso = Number(data.monto || 0);
        const cajaOperacion = this.isOperatorWithBase(creador)
          ? await this.resolveCajaOperacionPrestamo(this.prisma as any, {
              data,
              creador,
              cliente,
              requiereCajaRuta: true,
            })
          : await this.prisma.caja.findFirst({
              where: { codigo: 'CAJA-OFICINA', activa: true },
              select: {
                id: true,
                codigo: true,
                tipo: true,
                nombre: true,
                saldoActual: true,
                rutaId: true,
                responsableId: true,
              },
            });

        if (!cajaOperacion?.id) {
          throw new BadRequestException(
            this.isOperatorWithBase(creador)
              ? 'No existe una caja/base activa para el operador.'
              : 'No hay capital en la caja de oficina. No se puede realizar ningún crédito.',
          );
        }

        const saldoCaja = Number(cajaOperacion.saldoActual || 0);
        if (montoDesembolso > 0) {
          if (saldoCaja < montoDesembolso) {
            throw new BadRequestException(
              `Saldo insuficiente en la caja para solicitar este crédito. Caja: ${cajaOperacion.nombre}. Saldo: ${saldoCaja.toLocaleString('es-CO')}. Monto solicitado: ${montoDesembolso.toLocaleString('es-CO')}.`,
            );
          }
        } else if (saldoCaja <= 0 && !this.isOperatorWithBase(creador)) {
          throw new BadRequestException(
            'No hay capital en la caja de oficina. No se puede realizar ningún crédito.',
          );
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
      const rolesAutoAprobacion: RolUsuario[] = [
        RolUsuario.ADMIN,
        RolUsuario.SUPER_ADMINISTRADOR,
      ];
      const requiereAprobacion = !rolesAutoAprobacion.includes(creador.rol);
      const estadoInicial = requiereAprobacion
        ? EstadoPrestamo.PENDIENTE_APROBACION
        : EstadoPrestamo.ACTIVO;
      const estadoAprobacionInicial = requiereAprobacion
        ? EstadoAprobacion.PENDIENTE
        : EstadoAprobacion.APROBADO;

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
          throw new BadRequestException(
            'Para crédito por artículo se requiere productoId',
          );
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
        const precioTotal =
          data.esContado || !precioProducto
            ? data.monto
            : precioProducto.precio
              ? Number(precioProducto.precio)
              : 0;
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
      }

      // Generar número de préstamo/crédito
      const numeroPrestamo = await this.generarNumeroPrestamo(
        data.tipoPrestamo,
      );

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

      let numPlazoMeses = Number(
        data.plazoMeses || (data as any).plazo || (data as any).numPlazo || 0,
      );

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

      const fechaInicio = data.fechaInicio
        ? this.parseBogotaDayKey(data.fechaInicio)
        : fechaActual;

      const puedeUsarFechaAntigua =
        this.puedeCrearCreditoConFechaAntigua(creador.rol);
      const hoyCreacionKey = this.hoyBogotaKey();
      const fechaInicioKey = this.toBogotaDateKey(fechaInicio);

      if (!puedeUsarFechaAntigua && fechaInicioKey < hoyCreacionKey) {
        throw new BadRequestException(
          'No tienes permiso para crear créditos con fecha antigua.',
        );
      }

      // La fecha de vencimiento del préstamo (fechaFin) se basa estrictamente en el plazoMeses usando helper
      let fechaFin = this.calculateLoanEndDate(fechaInicio, numPlazoMeses);

      const fechaPrimerCobroParsed = data.fechaPrimerCobro
        ? this.parseBogotaDayKey(data.fechaPrimerCobro)
        : undefined;
      if (fechaPrimerCobroParsed) {
        const fechaPrimerCobroKey = this.toBogotaDateKey(
          fechaPrimerCobroParsed,
        );

        if (fechaPrimerCobroKey < fechaInicioKey) {
          throw new BadRequestException(
            'La fecha del primer cobro no puede ser anterior a la fecha del crédito.',
          );
        }

        if (!puedeUsarFechaAntigua && fechaPrimerCobroKey < hoyCreacionKey) {
          throw new BadRequestException(
            'No tienes permiso para crear créditos con fecha de primer cobro antigua.',
          );
        }

        const { startDate } =
          getBogotaStartEndOfDayFromKey(fechaPrimerCobroKey);
        fechaPrimerCobroParsed.setTime(startDate.getTime());
      }

      // Calcular cantidad de cuotas: Prioridad TOTAL al valor enviado por el usuario
      let cantidadCuotas = numCantidadCuotas;

      if (cantidadCuotas > 0) {
        this.logger.log(
          `[CUOTAS CALCULATION] Priorizando cuotas del usuario: ${cantidadCuotas}`,
        );
      } else {
        this.logger.log(
          `[CUOTAS CALCULATION] Calculando cuotas desde plazoMeses=${numPlazoMeses} y frecu=${data.frecuenciaPago}`,
        );
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

      this.logger.log(
        `[CUOTAS CALCULATION] Cantidad final de cuotas a crear: ${cantidadCuotas}`,
      );

      const tipoAmort =
        data.tipoAmortizacion || TipoAmortizacion.INTERES_PLANO;
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

      const autoAprobarCreditos =
        await this.configuracionService.shouldAutoApproveCredits();
      const esAutoAprobado = autoAprobarCreditos;
      esAutoAprobadoFinal = esAutoAprobado;
      this.logger.log(
        `[CREATE LOAN] Usuario: ${creador.nombres}, Rol: ${creador.rol}, Auto-aprobado por configuración global: ${esAutoAprobado}`,
      );

      const articuloNombre =
        (data as any).productoNombre || producto?.nombre || 'Artículo';
      const totalCuotasPrometidas = cantidadCuotas;
      const isFinanciamientoArticulo = data.tipoPrestamo === 'ARTICULO';
      const safeNumber = (val: any) => {
        const n = Number(val);
        return isNaN(n) ? 0 : n;
      };
      const hoyKey = getBogotaDayKey(new Date());
      const { startDate: today } = getBogotaStartEndOfDayFromKey(hoyKey);
      const startKey = getBogotaDayKey(new Date(fechaInicio));
      const { startDate: startDate } = getBogotaStartEndOfDayFromKey(startKey);
      let rutaIdAsignadaBroadcast: string | null = null;

      const {
        prestamo,
        aprobacion,
        efectoProvisional,
        impactoProvisional,
      } = await this.prisma.$transaction(async (tx) => {
        const prestamoTx = await tx.prestamo.create({
          data: {
            numeroPrestamo,
            idempotencyKey,
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
            estado: data.esContado
              ? EstadoPrestamo.PAGADO
              : esAutoAprobado
                ? EstadoPrestamo.ACTIVO
                : EstadoPrestamo.PENDIENTE_APROBACION,
            estadoAprobacion: data.esContado
              ? EstadoAprobacion.APROBADO
              : esAutoAprobado
                ? EstadoAprobacion.APROBADO
                : EstadoAprobacion.PENDIENTE,
            aprobadoPorId:
              data.esContado || esAutoAprobado ? data.creadoPorId : undefined,
            creadoPorId: data.creadoPorId,
            interesTotal,
            saldoPendiente: data.esContado ? 0 : montoTotal,
            totalPagado: data.esContado ? montoTotal : 0,
            notas:
              data.notas ||
              (data as any).observaciones ||
              (data as any).comentarios ||
              (data as any).detalle ||
              undefined
                ? String(
                    data.notas ||
                      (data as any).observaciones ||
                      (data as any).comentarios ||
                      (data as any).detalle,
                  )
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

        const impactoTx = await this.aplicarImpactoProvisionalPrestamo(tx, {
          prestamo: prestamoTx,
          data,
          creador,
          cliente,
        });

        let asignacionRutaTxId: string | null = null;
        if (!data.esContado && startDate.getTime() === today.getTime()) {
          const rutaPreferida = cliente.asignacionesRuta?.find(
            (a: any) => a?.activa && a?.ruta?.activa && !a?.ruta?.eliminadoEn,
          );

          const rutaCobrador =
            !rutaPreferida && creador.rol === RolUsuario.COBRADOR
              ? await tx.ruta.findFirst({
                  where: {
                    eliminadoEn: null,
                    activa: true,
                    cobradorId: creador.id,
                  },
                  select: { id: true, cobradorId: true },
                })
              : null;

          const rutaIdAsignar =
            rutaPreferida?.rutaId || rutaPreferida?.ruta?.id || rutaCobrador?.id;
          const cobradorIdAsignar =
            rutaPreferida?.cobradorId ||
            rutaPreferida?.ruta?.cobradorId ||
            rutaCobrador?.cobradorId;

          if (rutaIdAsignar && cobradorIdAsignar) {
            const asignacionExistente = await tx.asignacionRuta.findFirst({
              where: {
                rutaId: rutaIdAsignar,
                clienteId: cliente.id,
                activa: true,
              },
              select: { id: true },
            });

            if (asignacionExistente?.id) {
              this.logger.log(
                `[CREATE LOAN] Cliente ${cliente.id} ya tiene asignación activa en ruta ${rutaIdAsignar}. Se omite creación automática.`,
              );
            } else {
              const maxOrden = await tx.asignacionRuta.aggregate({
                where: { rutaId: rutaIdAsignar, activa: true },
                _max: { ordenVisita: true },
              });

              try {
                const asignacionCreada = await tx.asignacionRuta.create({
                  data: {
                    rutaId: rutaIdAsignar,
                    clienteId: cliente.id,
                    cobradorId: cobradorIdAsignar,
                    fechaEspecifica: today,
                    ordenVisita: (maxOrden._max.ordenVisita || 0) + 1,
                    activa: true,
                  },
                });
                asignacionRutaTxId = asignacionCreada?.id || null;
                asignacionRutaCreadaId = asignacionRutaTxId;
                rutaIdAsignadaBroadcast = rutaIdAsignar;
              } catch (error: any) {
                if (error?.code === 'P2002') {
                  this.logger.warn(
                    `[CREATE LOAN] Asignación de ruta omitida por duplicado rutaId=${rutaIdAsignar}, clienteId=${cliente.id}`,
                  );
                } else {
                  throw error;
                }
              }
            }
          }
        }

        const aprobacionTx = await tx.aprobacion.create({
          data: {
            tipoAprobacion: TipoAprobacion.NUEVO_PRESTAMO,
            idempotencyKey,
            referenciaId: prestamoTx.id,
            tablaReferencia: 'Prestamo',
            solicitadoPorId: data.creadoPorId,
            datosSolicitud: {
              numeroPrestamo: prestamoTx.numeroPrestamo,
              cliente: `${cliente.nombres} ${cliente.apellidos}`,
              cedula: String(cliente.dni),
              telefono: String(cliente.telefono),
              monto: safeNumber(prestamoTx.monto),
              montoTotal:
                safeNumber(prestamoTx.monto) +
                safeNumber(prestamoTx.interesTotal),
              interesTotal: safeNumber(prestamoTx.interesTotal),
              tipoAmortizacion: prestamoTx.tipoAmortizacion,
              cantidadCuotas: safeNumber(prestamoTx.cantidadCuotas),
              tasaInteres: safeNumber(prestamoTx.tasaInteres),
              tipo: String(data.tipoPrestamo),
              articulo: String(articuloNombre)
                .replace(/&amp;/gi, '&')
                .replace(/&lt;/gi, '<')
                .replace(/&gt;/gi, '>'),
              valorArticulo: isFinanciamientoArticulo
                ? safeNumber((data as any).valorArticulo || precioArticuloTotal)
                : safeNumber(prestamoTx.monto),
              cuotas: safeNumber(totalCuotasPrometidas),
              plazoMeses: numPlazoMeses,
              porcentaje: safeNumber(
                isFinanciamientoArticulo ? 0 : tasaInteres,
              ),
              frecuenciaPago: String(data.frecuenciaPago),
              cuotaInicial: safeNumber(data.cuotaInicial),
              notas:
                data.notas ||
                (data as any).observaciones ||
                (data as any).comentarios ||
                (data as any).detalle ||
                undefined
                  ? String(
                      data.notas ||
                        (data as any).observaciones ||
                        (data as any).comentarios ||
                        (data as any).detalle,
                    )
                  : undefined,
              garantia: data.garantia ? String(data.garantia) : undefined,
              fechaInicio: prestamoTx.fechaInicio
                ? formatBogotaOffsetIso(prestamoTx.fechaInicio)
                : undefined,
              fechaPrimerCobro: (data as any).fechaPrimerCobro
                ? String((data as any).fechaPrimerCobro)
                : undefined,
              esContado: !!data.esContado,
              idempotencyKey: idempotencyKey || null,
            },
            montoSolicitud: isFinanciamientoArticulo
              ? precioArticuloTotal
              : safeNumber(prestamoTx.monto),
            estado:
              data.esContado || esAutoAprobado
                ? EstadoAprobacion.APROBADO
                : EstadoAprobacion.PENDIENTE,
            aprobadoPorId:
              data.esContado || esAutoAprobado ? data.creadoPorId : undefined,
          },
        });

        const efectoTx =
          !esAutoAprobado && !data.esContado
            ? await tx.efectoProvisional.create({
                data: {
                  aprobacionId: aprobacionTx.id,
                  tipoAccion: 'NUEVO_PRESTAMO',
                  tipoEntidad: 'Prestamo',
                  entidadId: prestamoTx.id,
                  estado: 'PENDIENTE_REVISION',
                  snapshotAntes: null,
                  snapshotDespues: {
                    prestamo: {
                      id: prestamoTx.id,
                      estado: prestamoTx.estado,
                      estadoAprobacion: prestamoTx.estadoAprobacion,
                      saldoPendiente: prestamoTx.saldoPendiente,
                    },
                    cuotas: (prestamoTx.cuotas || []).map((cuota: any) => ({
                      id: cuota.id,
                      estado: cuota.estado,
                      monto: cuota.monto,
                      fechaVencimiento: cuota.fechaVencimiento,
                    })),
                  },
                  rollbackData: {
                    prestamoId: prestamoTx.id,
                    cuotaIds: (prestamoTx.cuotas || []).map(
                      (cuota: any) => cuota.id,
                    ),
                    productoId: prestamoTx.productoId || null,
                    stockDescontado: !!impactoTx?.stockDescontado,
                    journalReferenceIds: impactoTx?.journalEntryIds || [],
                    journalEntryIds: impactoTx?.journalEntryIds || [],
                    transaccionIds: impactoTx?.transaccionIds || [],
                    cajaOrigenId: impactoTx?.cajaOrigenId || null,
                    montoDesembolsado: impactoTx?.montoDesembolsado || 0,
                    tipoPrestamo: prestamoTx.tipoPrestamo,
                    asignacionRutaId: asignacionRutaTxId,
                    estadoPrestamoInicial: prestamoTx.estado,
                    estadoAprobacionInicial: prestamoTx.estadoAprobacion,
                    estadoInicialPrestamo: prestamoTx.estado,
                    estadoInicialCuotas: (prestamoTx.cuotas || []).map(
                      (cuota: any) => ({
                        id: cuota.id,
                        estado: cuota.estado,
                        montoPagado: cuota.montoPagado || 0,
                        fechaPago: cuota.fechaPago || null,
                      }),
                    ),
                    usuarioSolicitanteId: data.creadoPorId,
                    rutaId:
                      (data as any).rutaId ||
                      cliente.asignacionesRuta?.[0]?.rutaId ||
                      cliente.asignacionesRuta?.[0]?.ruta?.id ||
                      null,
                    cobradorId:
                      (data as any).cobradorId ||
                      cliente.asignacionesRuta?.[0]?.cobradorId ||
                      cliente.asignacionesRuta?.[0]?.ruta?.cobradorId ||
                      null,
                    referenciaDesembolso:
                      impactoTx?.referenciaDesembolso || null,
                    referenciaCuotaInicial:
                      impactoTx?.referenciaCuotaInicial || null,
                  },
                  entidadesAfectadas: {
                    prestamoId: prestamoTx.id,
                    cuotaIds: (prestamoTx.cuotas || []).map(
                      (cuota: any) => cuota.id,
                    ),
                    aprobacionId: aprobacionTx.id,
                    asignacionRutaId: asignacionRutaTxId,
                  },
                  aplicadoPorId: data.creadoPorId,
                },
              })
            : null;

        return {
          prestamo: prestamoTx,
          aprobacion: aprobacionTx,
          efectoProvisional: efectoTx,
          impactoProvisional: impactoTx,
        };
      });

      prestamoCreado = prestamo;
      aprobacionCreada = aprobacion;
      efectoProvisionalCreado = efectoProvisional;
      impactoProvisionalPrestamo = impactoProvisional;

      if (asignacionRutaCreadaId && rutaIdAsignadaBroadcast) {
        await this.runCreateLoanSideEffect('broadcast asignación de ruta', () => {
          this.notificacionesGateway.broadcastRutasActualizadas({
            accion: 'ACTUALIZAR',
            rutaId: rutaIdAsignadaBroadcast,
            clienteId: cliente.id,
          });
        });
      }

      this.logger.log(
        `Loan created successfully: ${prestamo.id}, requiereAprobacion: ${esAutoAprobado}`,
      );

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
              })),
            },
          },
        });
      }

      if (!esAutoAprobado && !data.esContado) {
        try {
          await this.notificacionesService.notifyApprovers({
            titulo: 'Nuevo crédito requiere aprobación',
            mensaje: `${creador.nombres} ${creador.apellidos} solicitó un ${data.tipoPrestamo === 'EFECTIVO' ? 'préstamo' : 'crédito por un artículo'} para ${cliente.nombres} ${cliente.apellidos} por ${montoFinanciar.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}.`,
            tipo: 'PRESTAMO',
            entidad: 'Aprobacion',
            entidadId: aprobacion.id,
            metadata: this.buildPrestamoNotifMetadata({
              prestamo,
              data,
              cliente,
              cantidadCuotas,
              numPlazoMeses,
              articuloNombre,
              isFinanciamientoArticulo,
              precioArticuloTotal,
              safeNumber,
              interesTotal,
              tasaInteres,
            }),
          });
        } catch {}

        try {
          await this.notificacionesService.create({
            usuarioId: data.creadoPorId,
            titulo: 'Solicitud enviada',
            mensaje:
              'Tu solicitud fue enviada con éxito y quedó pendiente de aprobación.',
            tipo: 'INFORMATIVO',
            entidad: 'Aprobacion',
            entidadId: aprobacion.id,
            metadata: this.buildPrestamoNotifMetadata({
              prestamo,
              data,
              cliente,
              cantidadCuotas,
              numPlazoMeses,
              articuloNombre,
              isFinanciamientoArticulo,
              precioArticuloTotal,
              safeNumber,
              interesTotal,
              tasaInteres,
            }),
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
          await this.runCreateLoanSideEffect(
            `notificar administrador ${admin.id}`,
            () =>
              this.notificacionesService.create({
                usuarioId: admin.id,
                titulo: data.esContado
                  ? 'Nueva Venta de Contado'
                  : 'Préstamo Aprobado Automáticamente',
                mensaje: data.esContado
                  ? `${creador.nombres} realizó una venta de contado para ${cliente.nombres} ${cliente.apellidos} por ${montoFinanciar.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}`
                  : `${creador.nombres} ${creador.apellidos} creó y aprobó automáticamente un préstamo para ${cliente.nombres} ${cliente.apellidos} por ${montoFinanciar.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}`,
                tipo: 'SISTEMA',
                entidad: 'PRESTAMO',
                entidadId: prestamo.id,
                metadata: {
                  esContado: !!data.esContado,
                  articulo: String(articuloNombre).replace(/&amp;/gi, '&'),
                  valorArticulo: isFinanciamientoArticulo
                    ? safeNumber(precioArticuloTotal)
                    : safeNumber(prestamo.monto),
                  monto: safeNumber(prestamo.monto),
                  clienteId: cliente.id,
                  cliente:
                    `${cliente.nombres || ''} ${cliente.apellidos || ''}`.trim(),
                  nombreCliente:
                    `${cliente.nombres || ''} ${cliente.apellidos || ''}`.trim(),
                  clienteNombre:
                    `${cliente.nombres || ''} ${cliente.apellidos || ''}`.trim(),
                  cedula: String(cliente.dni || ''),
                  dni: String(cliente.dni || ''),
                  telefono: String(cliente.telefono || ''),
                  numeroPrestamo: prestamo.numeroPrestamo,
                  cuotas: safeNumber(totalCuotasPrometidas),
                  plazoMeses: numPlazoMeses,
                  frecuenciaPago: String(data.frecuenciaPago),
                  cuotaInicial: safeNumber(data.cuotaInicial),
                  notas: String(data.notas || ''),
                  fechaInicio: prestamo.fechaInicio
                    ? formatBogotaOffsetIso(prestamo.fechaInicio)
                    : undefined,
                  fecha: prestamo.fechaInicio
                    ? formatBogotaOffsetIso(prestamo.fechaInicio)
                    : undefined, // Duplicado para compatibilidad
                  montoTotal: montoFinanciar + interesTotal,
                  interesTotal: safeNumber(interesTotal),
                  tasaInteres: safeNumber(tasaInteres),
                  totalAPagar: montoFinanciar + interesTotal,
                  totalPagar: montoFinanciar + interesTotal,
                },
              }),
          );
        }

        // Enviar notificaciones push a administradores
        await this.runCreateLoanSideEffect('push administradores', () =>
          this.pushService.sendPushNotification({
            title: 'Préstamo Aprobado Automáticamente',
            body: `${creador.nombres} ${creador.apellidos} creó y aprobó un préstamo por ${montoFinanciar.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}`,
            roleFilter: ['ADMIN', 'SUPER_ADMINISTRADOR'],
            data: {
              type: 'PRESTAMO_APROBADO',
              prestamoId: prestamo.id,
              numeroPrestamo: prestamo.numeroPrestamo,
            },
          }),
        );

        // Notificar al creador
        await this.runCreateLoanSideEffect('notificar creador aprobado', () =>
          this.notificacionesService.create({
            usuarioId: data.creadoPorId,
            titulo: 'Préstamo Creado y Aprobado',
            mensaje: `El préstamo ${prestamo.numeroPrestamo} ha sido creado y aprobado automáticamente.`,
            tipo: 'EXITO',
            entidad: 'PRESTAMO',
            entidadId: prestamo.id,
          }),
        );

        // Enviar notificación push al creador
        await this.runCreateLoanSideEffect('push creador aprobado', () =>
          this.pushService.sendPushNotification({
            title: 'Préstamo Creado y Aprobado',
            body: `Tu préstamo ${prestamo.numeroPrestamo} ha sido creado y aprobado automáticamente.`,
            userId: data.creadoPorId,
            data: {
              type: 'PRESTAMO_CREADO',
              prestamoId: prestamo.id,
              numeroPrestamo: prestamo.numeroPrestamo,
            },
          }),
        );
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

        // Enviar notificaciones push a aprobadores principales.
        await this.runCreateLoanSideEffect('push aprobadores aprobación', () =>
          this.pushService.sendPushNotification({
            title: 'Nuevo Préstamo Requiere Aprobación',
            body: `${creador.nombres} ${creador.apellidos} ha solicitado un ${data.tipoPrestamo === 'EFECTIVO' ? 'préstamo' : 'crédito de artículo'} por ${montoFinanciar.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}`,
            roleFilter: ['COORDINADOR', 'ADMIN', 'SUPER_ADMINISTRADOR'],
            data: {
              type: 'PRESTAMO_PENDIENTE',
              prestamoId: prestamo.id,
              numeroPrestamo: prestamo.numeroPrestamo,
            },
          }),
        );

        // Notificar al creador
        await this.runCreateLoanSideEffect('notificar creador pendiente', () =>
          this.notificacionesService.create({
            usuarioId: data.creadoPorId,
            titulo: 'Préstamo Solicitado Exitosamente',
            mensaje: `Tu solicitud de préstamo ${prestamo.numeroPrestamo} ha sido creada exitosamente y está pendiente de aprobación.`,
            tipo: 'EXITO',
            entidad: 'PRESTAMO',
            entidadId: prestamo.id,
          }),
        );
      }

      // Auditoría
      await this.runCreateLoanSideEffect('auditoría creación préstamo', () =>
        this.auditService.create({
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
        }),
      );

      await this.runCreateLoanSideEffect('broadcast préstamos', () => {
        this.notificacionesGateway.broadcastPrestamosActualizados({
          accion: 'CREAR',
          prestamoId: prestamo.id,
        });
        this.notificacionesGateway.broadcastDashboardsActualizados({});
      });

      return {
        ...prestamo,
        mensaje: esAutoAprobado
          ? 'Préstamo creado y aprobado automáticamente.'
          : 'Préstamo creado exitosamente. Pendiente de aprobación.',
        requiereAprobacion: !esAutoAprobado,
      };
    } catch (error) {
      this.logger.error('Error creating loan:', error);
      if (prestamoCreado?.id && aprobacionCreada?.id) {
        this.logger.error(
          `[CREATE LOAN] Recuperando respuesta exitosa: préstamo ${prestamoCreado.id} y aprobación ${aprobacionCreada.id} ya fueron creados antes del error.`,
          error instanceof Error ? error.stack : String(error),
        );

        return {
          ...prestamoCreado,
          mensaje: esAutoAprobadoFinal
            ? 'Préstamo creado y aprobado automáticamente.'
            : 'Préstamo creado exitosamente. Pendiente de aprobación.',
          requiereAprobacion: !esAutoAprobadoFinal,
          aprobacionId: aprobacionCreada.id,
          efectoProvisionalId: efectoProvisionalCreado?.id || null,
          warning:
            'La operación principal fue creada, pero falló una tarea secundaria posterior.',
        };
      }
      throw error;
    }
  }

  /**
   * Archivar préstamo como pérdida y agregar cliente a blacklist
   */
  async archiveLoan(
    prestamoId: string,
    data: { motivo: string; notas?: string; archivarPorId: string },
  ) {
    const prestamo = await this.prisma.prestamo.findUnique({
      where: { id: prestamoId },
      include: { cliente: true },
    });

    if (!prestamo) {
      throw new NotFoundException('Préstamo no encontrado');
    }

    if (prestamo.estado === 'PERDIDA') {
      if (String(prestamo.tipoPrestamo || '').toUpperCase() !== 'ARTICULO') {
        throw new BadRequestException(
          'Este préstamo ya está archivado como pérdida',
        );
      }

      await this.prisma.$transaction(async (tx) => {
        await this.reversarImpactoContableArticuloArchivado(
          tx,
          prestamo,
          data.archivarPorId,
        );
      });

      return {
        message: 'Préstamo ya archivado; reversa contable verificada',
        prestamoId,
        clienteId: prestamo.clienteId,
        montoPerdida: Number(prestamo.saldoPendiente),
      };
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

      await this.reversarImpactoContableArticuloArchivado(
        tx,
        prestamo,
        data.archivarPorId,
      );

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
          apellidos: prestamo.cliente.apellidos,
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
    },
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
    const cuota = prestamo.cuotas.find((c) => c.numeroCuota === numeroCuota);
    if (!cuota) {
      throw new NotFoundException(`Cuota #${numeroCuota} no encontrada`);
    }

    // Validar que la cuota esté pendiente
    if (cuota.estado !== 'PENDIENTE') {
      throw new BadRequestException(
        'Solo se pueden reprogramar cuotas pendientes',
      );
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

    this.logger.log(
      `Cuota #${numeroCuota} del préstamo ${prestamoId} reprogramada a ${data.nuevaFecha}`,
    );

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
      details: [] as string[],
    };

    // 1. Obtener préstamos activos con interés SIMPLE
    const loans = await this.prisma.prestamo.findMany({
      where: {
        tipoAmortizacion: TipoAmortizacion.INTERES_SIMPLE,
        estado: { in: [EstadoPrestamo.ACTIVO, EstadoPrestamo.EN_MORA] },
      },
      include: {
        cuotas: true,
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
          const factor =
            loan.frecuenciaPago === 'MENSUAL'
              ? 1
              : loan.frecuenciaPago === 'QUINCENAL'
                ? 2
                : loan.frecuenciaPago === 'SEMANAL'
                  ? 4
                  : 30;
          plazoMeses = Math.ceil(loan.cantidadCuotas / factor);
        }

        // INTERES SIMPLE: I = C * i * t
        const interesCorrecto = this.trunc2(
          capital * (tasaMensual / 100) * plazoMeses,
        );
        const interesActual = Number(loan.interesTotal);

        // Verificar discrepancia significativa (> $100 pesos)
        if (
          interesCorrecto > interesActual &&
          interesCorrecto - interesActual > 100
        ) {
          const diferenciaInteres = interesCorrecto - interesActual;

          this.logger.log(
            `Corrigiendo Préstamo ${loan.numeroPrestamo}: Interés Actual ${interesActual} -> Nuevo ${interesCorrecto} (Dif: ${diferenciaInteres})`,
          );

          // Calcular deuda total previa y pagado
          const deudaTotalVieja =
            Number(loan.monto) + Number(loan.interesTotal);
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
            },
          });

          // Ajustar cuotas NO pagadas totalmente (PENDIENTE, PARCIAL, VENCIDA)
          const cuotasAjustables = loan.cuotas.filter(
            (c) =>
              c.estado === 'PENDIENTE' ||
              c.estado === 'PARCIAL' ||
              c.estado === 'VENCIDA',
          );

          if (cuotasAjustables.length > 0) {
            const ajustePorCuota = this.trunc2(
              diferenciaInteres / cuotasAjustables.length,
            );

            // Aplicar ajuste
            for (const cuota of cuotasAjustables) {
              await this.prisma.cuota.update({
                where: { id: cuota.id },
                data: {
                  montoInteres: { increment: ajustePorCuota },
                  monto: { increment: ajustePorCuota },
                },
              });
            }
          }

          results.corrected++;
          results.details.push(
            `Préstamo ${loan.numeroPrestamo}: Ajuste de +${diferenciaInteres}`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Error corrigiendo préstamo ${loan.numeroPrestamo}: ${error}`,
        );
      }
    }

    return results;
  }

  // ── FLUJO DE APROBACIÓN DE REPROGRAMACIONES ─────────────────────────────────

  /**
   * El COBRADOR solicita reprogramar una cuota. Se aplica inmediatamente,
   * se registra como Aprobacion en estado PENDIENTE y se notifica a los aprobadores.
   * Valida los límites de días: semanal ≤6 días, quincenal ≤14 días.
   */
  async solicitarReprogramacion(data: {
    prestamoId: string;
    cuotaId?: string;
    nuevaFecha: string;
    motivo: string;
    fechaOperativaRuta?: string;
    origenGestion?: 'CIERRE_PENDIENTE';
    idempotencyKey?: string;
    solicitadoPorId: string;
  }) {
    const idempotencyKey = this.normalizeIdempotencyKey(data.idempotencyKey);
    if (idempotencyKey) {
      const aprobacionExistente = await this.prisma.aprobacion.findUnique({
        where: { idempotencyKey },
      });

      if (aprobacionExistente) {
        return {
          ...aprobacionExistente,
          idempotentReplay: true,
        };
      }
    }

    const prestamo = await this.prisma.prestamo.findUnique({
      where: { id: data.prestamoId },
      include: {
        cliente: true,
        cuotas: data.cuotaId
          ? { where: { id: data.cuotaId } }
          : {
              where: { estado: { not: 'PAGADA' } },
              orderBy: { numeroCuota: 'asc' },
              take: 1,
            },
      },
    });
    if (!prestamo) throw new NotFoundException('Préstamo no encontrado');

    const cuota = prestamo.cuotas[0];
    if (!cuota) throw new NotFoundException('Cuota no encontrada');
    if (cuota.estado === 'PAGADA') {
      throw new BadRequestException('La cuota ya fue pagada');
    }

    const { startDate: hoyLocal } = getBogotaStartEndOfDay(new Date());

    // Normalizar y validar la nuevaFecha enviada por el frontend
    let nuevaFechaStr = data.nuevaFecha.includes('T')
      ? data.nuevaFecha.split('T')[0]
      : data.nuevaFecha;

    // Si la fecha viene en formato DD/MM/YYYY, convertirla a YYYY-MM-DD
    const ddmmyyyy = nuevaFechaStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (ddmmyyyy) {
      const [, dd, mm, yyyy] = ddmmyyyy;
      nuevaFechaStr = `${yyyy}-${mm}-${dd}`;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(nuevaFechaStr)) {
      throw new BadRequestException(
        'nuevaFecha inválida. Debe usar formato YYYY-MM-DD o DD/MM/YYYY.',
      );
    }

    const nuevaFechaObj = new Date(`${nuevaFechaStr}T12:00:00-05:00`);
    if (Number.isNaN(nuevaFechaObj.getTime())) {
      throw new BadRequestException(
        'nuevaFecha inválida. Debe usar formato YYYY-MM-DD o DD/MM/YYYY.',
      );
    }

    const diasDesdeHoy = Math.round(
      (nuevaFechaObj.getTime() - hoyLocal.getTime()) / 86_400_000,
    );

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
      throw new BadRequestException(
        'La nueva fecha no puede ser anterior a la fecha actual',
      );
    }

    const fechaOperativaRuta = this.parseFechaOperativaReprogramacionKey(
      data.fechaOperativaRuta,
    );
    if (data.origenGestion === 'CIERRE_PENDIENTE' && !fechaOperativaRuta) {
      throw new BadRequestException(
        'fechaOperativaRuta es requerida para reprogramaciones desde cierre pendiente',
      );
    }
    const fechaGestionOriginal = fechaOperativaRuta || getBogotaDayKey(new Date());

    const contextoRegularizacion =
      data.origenGestion === 'CIERRE_PENDIENTE'
        ? {
            fechaOperativaRuta,
            origenGestion: data.origenGestion,
            contexto: 'REPROGRAMACION_DESDE_CIERRE_PENDIENTE',
          }
        : {};

    // Aplicar reprogramación inmediatamente y crear registros
    const resultado = await this.prisma.$transaction(async (tx) => {
      // 1. Obtener información inicial para rollback
      const asignacionActiva = await tx.asignacionRuta.findFirst({
        where: { clienteId: prestamo.clienteId, activa: true },
        select: { rutaId: true },
      });
      const rutaIdOriginal = asignacionActiva?.rutaId;

      // 2. Obtener estado anterior de RegistroVisita si existe
      let registroVisitaAnterior: any = null;
      if (fechaOperativaRuta && rutaIdOriginal && tx.registroVisita?.findUnique) {
        registroVisitaAnterior = await tx.registroVisita.findUnique({
          where: {
            rutaId_clienteId_fechaVisita: {
              rutaId: rutaIdOriginal,
              clienteId: prestamo.clienteId,
              fechaVisita: fechaOperativaRuta,
            },
          },
        });
      }

      // 2. Actualizar cuota inmediatamente
      const cuotaActualizada = await tx.cuota.update({
        where: { id: cuota.id },
        data: {
          fechaVencimiento: nuevaFechaObj,
        },
      });

      // 2. Manejar registro de visita si es cierre pendiente
      if (data.origenGestion === 'CIERRE_PENDIENTE') {
        if (!fechaOperativaRuta) {
          throw new BadRequestException(
            'fechaOperativaRuta es requerida para reprogramaciones desde cierre pendiente',
          );
        }

        const asignacionActiva = await tx.asignacionRuta.findFirst({
          where: { clienteId: prestamo.clienteId, activa: true },
          select: {
            rutaId: true,
            cobradorId: true,
            ruta: { select: { cobradorId: true } },
          },
        });

        if (!asignacionActiva?.rutaId) {
          throw new BadRequestException(
            'No existe una ruta activa válida para esta regularización',
          );
        }

        const jornadaPendiente = await tx.rutaJornada.findFirst({
          where: {
            rutaId: asignacionActiva.rutaId,
            fechaOperativa: fechaOperativaRuta,
            estado: 'PENDIENTE_CIERRE',
          },
          select: { id: true, rutaId: true, fechaOperativa: true },
        });

        if (!jornadaPendiente) {
          throw new BadRequestException(
            'No existe una jornada pendiente válida para esta regularización',
          );
        }

        const cobradorGestionId =
          asignacionActiva.cobradorId ||
          asignacionActiva.ruta?.cobradorId ||
          data.solicitadoPorId;

        await tx.registroVisita.upsert({
          where: {
            rutaId_clienteId_fechaVisita: {
              rutaId: asignacionActiva.rutaId,
              clienteId: prestamo.clienteId,
              fechaVisita: fechaOperativaRuta,
            },
          },
          create: {
            rutaId: asignacionActiva.rutaId,
            clienteId: prestamo.clienteId,
            prestamoId: prestamo.id,
            cobradorId: cobradorGestionId,
            fechaVisita: fechaOperativaRuta,
            estadoVisita: 'reprogramado',
            notas: `Reprogramación solicitada desde cierre pendiente: ${data.motivo || 'Sin motivo'}`,
          },
          update: {
            prestamoId: prestamo.id,
            cobradorId: cobradorGestionId,
            estadoVisita: 'reprogramado',
            notas: `Reprogramación solicitada desde cierre pendiente: ${data.motivo || 'Sin motivo'}`,
          },
        });
      }

      // 3. Crear solicitud de aprobación
      const aprobacion = await tx.aprobacion.create({
        data: {
          tipoAprobacion: TipoAprobacion.REPROGRAMACION_CUOTA,
          idempotencyKey,
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
            fechaGestionOriginal,
            fechaVencimientoOriginal: formatBogotaOffsetIso(
              cuota.fechaVencimiento,
            ),
            nuevaFecha: data.nuevaFecha,
            motivo: data.motivo,
            montoCuota: Number(cuota.monto),
            ...contextoRegularizacion,
          },
        },
      });

      // 4. Crear EfectoProvisional con datos para reversión
      const efectoProvisional = await tx.efectoProvisional?.create?.({
        data: {
          aprobacionId: aprobacion.id,
          tipoAccion: 'REPROGRAMACION_CUOTA',
          tipoEntidad: 'Cuota',
          entidadId: cuota.id,
          estado: 'PENDIENTE_REVISION',
          snapshotAntes: {
            cuota: {
              id: cuota.id,
              fechaVencimiento: cuota.fechaVencimiento.toISOString(),
            },
            registroVisita: registroVisitaAnterior,
          },
          snapshotDespues: {
            cuota: {
              id: cuotaActualizada.id,
              fechaVencimiento: cuotaActualizada.fechaVencimiento.toISOString(),
            },
          },
          rollbackData: {
            cuotaId: cuota.id,
            clienteId: prestamo.clienteId,
            prestamoId: prestamo.id,
            rutaIdOriginal,
            fechaVencimientoOriginal: cuota.fechaVencimiento.toISOString(),
            fechaVencimientoNueva: nuevaFechaObj.toISOString(),
            fechaOperativaOriginal: fechaGestionOriginal,
            origenGestion: data.origenGestion,
            registroVisitaAnterior,
          },
          aplicadoPorId: data.solicitadoPorId,
        },
      });

      return { aprobacion, efectoProvisional };
    });

    // Validar Auto-Aprobación
    const usuarioSolicitante = await this.prisma.usuario.findUnique({
      where: { id: data.solicitadoPorId },
      select: { rol: true },
    });

    const rolNameText =
      usuarioSolicitante?.rol === 'SUPERVISOR'
        ? 'Supervisor'
        : 'Cobrador Principal';

    // Notificar a aprobadores (ADMIN / COORDINADOR / SUPERVISOR).
    try {
      await this.notificacionesService.notifyApprovers({
        titulo: 'Reprogramaciones',
        mensaje: `Solicitud de reprogramaciones por ${rolNameText}`,
        tipo: 'REPROGRAMACION',
        entidad: 'Aprobacion',
        entidadId: resultado.aprobacion.id,
        metadata: {
          aprobacionId: resultado.aprobacion.id,
          prestamoId: data.prestamoId,
          ...contextoRegularizacion,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Reprogramacion ${resultado.aprobacion.id} creada, pero falló notificación a aprobadores: ${(error as Error)?.message || error}`,
      );
    }

    this.logger.log(
      `Reprogramacion solicitada y aplicada: cuota ${cuota.id} del prestamo ${data.prestamoId} -> ${data.nuevaFecha}`,
    );

    try {
      await this.notificacionesService.create({
        usuarioId: data.solicitadoPorId,
        titulo: 'Solicitud de reprogramación enviada',
        mensaje:
          'Tu solicitud fue enviada con éxito y la reprogramación fue aplicada provisionalmente.',
        tipo: 'INFORMATIVO',
        entidad: 'Aprobacion',
        entidadId: resultado.aprobacion.id,
        metadata: {
          tipoAprobacion: 'REPROGRAMACION_CUOTA',
          tipo: 'REPROGRAMACION_CUOTA',
          prestamoId: data.prestamoId,
          ...contextoRegularizacion,
        },
      });
    } catch {}

    // ⚡ Tiempo real: notificar a todos los clientes conectados.
    try {
      this.notificacionesGateway.broadcastAprobacionesActualizadas({
        tipo: 'REPROGRAMACION_CUOTA',
        prestamoId: data.prestamoId,
        aprobacionId: resultado.aprobacion.id,
        ...contextoRegularizacion,
      });
      this.notificacionesGateway.broadcastJornadasActualizadas({
        accion: 'REPROGRAMACION_SOLICITADA',
        prestamoId: data.prestamoId,
        cuotaId: data.cuotaId || cuota.id,
        fechaOperativaRuta,
        origenGestion: data.origenGestion,
        aprobacionId: resultado.aprobacion.id,
      });
      this.notificacionesGateway.broadcastRutasActualizadas({
        accion: 'REPROGRAMACION_SOLICITADA',
        prestamoId: data.prestamoId,
        cuotaId: data.cuotaId || cuota.id,
        aprobacionId: resultado.aprobacion.id,
      });
      this.notificacionesGateway.broadcastPrestamosActualizados({
        accion: 'REPROGRAMACION_SOLICITADA',
        prestamoId: data.prestamoId,
        cuotaId: data.cuotaId || cuota.id,
        aprobacionId: resultado.aprobacion.id,
      });
    } catch (error) {
      this.logger.warn(
        `Reprogramacion ${resultado.aprobacion.id} creada, pero falló broadcast realtime: ${(error as Error)?.message || error}`,
      );
    }

    return {
      mensaje: 'Solicitud de reprogramacion enviada y aplicada provisionalmente',
      aprobacion: resultado.aprobacion,
      efectoProvisional: resultado.efectoProvisional,
    };
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
        solicitadoPor: {
          select: { id: true, nombres: true, apellidos: true, rol: true },
        },
        aprobadoPor: { select: { id: true, nombres: true, apellidos: true } },
      },
    });

    return solicitudes.map((s) => ({
      ...s,
      datosSolicitud: s.datosSolicitud as Record<string, any>,
    }));
  }

  /**
   * SUPERVISOR/ADMIN aprueba una reprogramación: confirma el efecto provisional.
   */
  async aprobarReprogramacion(aprobacionId: string, aprobadoPorId: string) {
    const aprobacion = await this.prisma.aprobacion.findUnique({
      where: { id: aprobacionId },
      include: { efectosProvisionales: true },
    });
    if (!aprobacion) throw new NotFoundException('Solicitud no encontrada');
    if (aprobacion.estado !== EstadoAprobacion.PENDIENTE) {
      throw new BadRequestException(
        'Solo se pueden aprobar solicitudes pendientes',
      );
    }

    const efectoProvisional = aprobacion.efectosProvisionales?.[0];
    if (!efectoProvisional) {
      throw new BadRequestException('No se encontró efecto provisional');
    }
    if (efectoProvisional.estado !== 'PENDIENTE_REVISION') {
      throw new BadRequestException(
        'El efecto provisional ya fue procesado',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // 1. Actualizar aprobación a APROBADO
      const claimed = await tx.aprobacion.updateMany({
        where: {
          id: aprobacionId,
          estado: EstadoAprobacion.PENDIENTE,
        },
        data: {
          estado: EstadoAprobacion.APROBADO,
          aprobadoPorId,
          revisadoEn: new Date(),
        },
      });

      if (claimed.count !== 1) {
        throw new BadRequestException(
          'Esta solicitud ya fue tomada por otro usuario',
        );
      }

      // 2. Actualizar EfectoProvisional a CONFIRMADO
      await tx.efectoProvisional.update({
        where: { id: efectoProvisional.id },
        data: {
          estado: 'CONFIRMADO',
          confirmadoEn: new Date(),
        },
      });
    });

    const datos = aprobacion.datosSolicitud as Record<string, any>;
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

    return { mensaje: 'Reprogramación aprobada exitosamente' };
  }

  /**
   * SUPERVISOR/ADMIN rechaza una reprogramación: revierte el efecto provisional.
   */
  async rechazarReprogramacion(
    aprobacionId: string,
    rechazadoPorId: string,
    comentarios?: string,
  ) {
    const aprobacion = await this.prisma.aprobacion.findUnique({
      where: { id: aprobacionId },
      include: { efectosProvisionales: true },
    });
    if (!aprobacion) throw new NotFoundException('Solicitud no encontrada');
    if (aprobacion.estado !== EstadoAprobacion.PENDIENTE) {
      throw new BadRequestException(
        'Solo se pueden rechazar solicitudes pendientes',
      );
    }

    const efectoProvisional = aprobacion.efectosProvisionales?.[0];
    if (!efectoProvisional) {
      throw new BadRequestException('No se encontró efecto provisional');
    }
    if (efectoProvisional.estado !== 'PENDIENTE_REVISION') {
      throw new BadRequestException(
        'El efecto provisional ya fue procesado',
      );
    }

    const rollbackData = efectoProvisional.rollbackData as any;
    const fechaVencimientoOriginal = new Date(rollbackData.fechaVencimientoOriginal);
    const fechaOperativaOriginal = typeof rollbackData.fechaOperativaOriginal === 'string' ? rollbackData.fechaOperativaOriginal : null;
    const registroVisitaAnterior = rollbackData.registroVisitaAnterior;
    const debeRevertirRegistroVisita = rollbackData.origenGestion === 'CIERRE_PENDIENTE' && fechaOperativaOriginal;

    await this.prisma.$transaction(async (tx) => {
      // 1. Validar que la cuota no haya sido modificada
      const cuotaActual = await tx.cuota.findUnique({
        where: { id: rollbackData.cuotaId },
        select: {
          id: true,
          fechaVencimiento: true,
          estado: true,
        },
      });

      if (!cuotaActual) {
        throw new BadRequestException('La cuota ya no existe');
      }

      if (cuotaActual.estado === 'PAGADA') {
        throw new BadRequestException(
          'No se puede revertir una reprogramación de una cuota ya pagada',
        );
      }

      const fechaActualIso = cuotaActual.fechaVencimiento.toISOString();
      if (fechaActualIso !== rollbackData.fechaVencimientoNueva) {
        throw new BadRequestException(
          'La cuota fue modificada después de la solicitud. Requiere revisión manual.',
        );
      }

      // 2. Actualizar aprobación a RECHAZADO
      const claimed = await tx.aprobacion.updateMany({
        where: {
          id: aprobacionId,
          estado: EstadoAprobacion.PENDIENTE,
        },
        data: {
          estado: EstadoAprobacion.RECHAZADO,
          aprobadoPorId: rechazadoPorId,
          revisadoEn: new Date(),
          comentarios: comentarios || null,
        },
      });

      if (claimed.count !== 1) {
        throw new BadRequestException(
          'Esta solicitud ya fue tomada por otro usuario',
        );
      }

      // 3. Revertir la cuota a su fecha original
      await tx.cuota.update({
        where: { id: rollbackData.cuotaId },
        data: {
          fechaVencimiento: fechaVencimientoOriginal,
        },
      });

      // 4. Revertir RegistroVisita si aplica
      if (debeRevertirRegistroVisita && rollbackData.rutaIdOriginal) {
        const rutaIdOriginal = rollbackData.rutaIdOriginal;
        if (registroVisitaAnterior) {
          // Restaurar el registro anterior
          await tx.registroVisita.update({
            where: { id: registroVisitaAnterior.id },
            data: {
              estadoVisita: registroVisitaAnterior.estadoVisita,
              notas: registroVisitaAnterior.notas,
              prestamoId: registroVisitaAnterior.prestamoId,
              cobradorId: registroVisitaAnterior.cobradorId,
            },
          });
        } else {
          // Eliminar el registro que creamos
          await tx.registroVisita.deleteMany({
            where: {
              rutaId: rutaIdOriginal,
              clienteId: rollbackData.clienteId,
              fechaVisita: fechaOperativaOriginal,
            },
          });
        }
      }

      // 5. Actualizar EfectoProvisional a REVERTIDO
      await tx.efectoProvisional.update({
        where: { id: efectoProvisional.id },
        data: {
          estado: 'REVERTIDO',
          revertidoEn: new Date(),
          motivoReversion: comentarios,
        },
      });
    });

    const datos = aprobacion.datosSolicitud as Record<string, any>;
    // Notificar al cobrador
    await this.notificacionesService.create({
      usuarioId: aprobacion.solicitadoPorId,
      titulo: 'Reprogramacion rechazada',
      mensaje: `La reprogramacion de la cuota del cliente ${datos.clienteNombre} fue RECHAZADA y revertida.${comentarios ? ` Motivo: ${comentarios}` : ''}`,
      tipo: 'REPROGRAMACION_RECHAZADA',
      entidad: 'Aprobacion',
      entidadId: aprobacionId,
    });

    // Actualizar vistas
    this.notificacionesGateway.broadcastRutasActualizadas();
    this.notificacionesGateway.broadcastDashboardsActualizados();
    this.notificacionesGateway.broadcastPrestamosActualizados();
    this.notificacionesGateway.broadcastAprobacionesActualizadas();

    return { mensaje: 'Reprogramación rechazada y revertida' };
  }

  /**
   * Exportar cartera de préstamos en Excel o PDF.
   * Utiliza la plantilla completa cartera-creditos.template.ts
   */
  async exportLoans(
    format: 'excel' | 'pdf',
    filters: { estado?: string; ruta?: string; search?: string },
  ) {
    const fechaStr = getBogotaDayKey(new Date());

    if (format === 'excel') {
      const and: Prisma.PrestamoWhereInput[] = [{ eliminadoEn: null }];

      if (filters.estado && filters.estado !== 'todos') {
        and.push({ estado: filters.estado as EstadoPrestamo });
      }

      if (filters.ruta && filters.ruta !== 'todas') {
        and.push({
          cliente: {
            asignacionesRuta: {
              some: {
                rutaId: filters.ruta,
                activa: true,
              },
            },
          },
        });
      }

      const search = String(filters.search || '').trim();
      if (search) {
        and.push({
          OR: [
            { numeroPrestamo: { contains: search, mode: 'insensitive' } },
            { cliente: { nombres: { contains: search, mode: 'insensitive' } } },
            { cliente: { apellidos: { contains: search, mode: 'insensitive' } } },
            { cliente: { dni: { contains: search, mode: 'insensitive' } } },
          ],
        });
      }

      const prestamos = await this.prisma.prestamo.findMany({
        where: { AND: and },
        include: {
          cliente: {
            include: {
              asignacionesRuta: {
                where: { activa: true },
                include: {
                  ruta: { select: { codigo: true, nombre: true } },
                },
                take: 1,
              },
            },
          },
          producto: { select: { codigo: true, nombre: true } },
        },
        orderBy: { creadoEn: 'desc' },
      });

      const clientesMap = new Map<string, any>();

      for (const prestamo of prestamos) {
        const cliente = prestamo.cliente;
        if (!cliente?.id || clientesMap.has(cliente.id)) continue;

        const asignacion = cliente.asignacionesRuta?.[0];
        clientesMap.set(cliente.id, {
          codigo: cliente.codigo || cliente.dni,
          dni: cliente.dni,
          nombres: cliente.nombres,
          apellidos: cliente.apellidos,
          telefono: cliente.telefono,
          correo: cliente.correo,
          direccion: cliente.direccion,
          referencia: cliente.referencia,
          referencia1Nombre: cliente.referencia1Nombre,
          referencia1Telefono: cliente.referencia1Telefono,
          referencia2Nombre: cliente.referencia2Nombre,
          referencia2Telefono: cliente.referencia2Telefono,
          nivelRiesgo: cliente.nivelRiesgo,
          rutaCodigo: asignacion?.ruta?.codigo || '',
        });
      }

      const creditos = prestamos.map((prestamo) => ({
        codigo: this.normalizeIdempotencyKey(
          prestamo.idempotencyKey || prestamo.numeroPrestamo || prestamo.id,
        ),
        numeroPrestamo: prestamo.numeroPrestamo,
        ccCliente: prestamo.cliente?.dni || '',
        tipoPrestamo: prestamo.tipoPrestamo,
        productoCodigo: prestamo.producto?.codigo || '',
        monto: Number(prestamo.monto || 0),
        cuotaInicial: Number(prestamo.cuotaInicial || 0),
        tasaInteres: Number(prestamo.tasaInteres || 0),
        tasaInteresMora: Number(prestamo.tasaInteresMora || 0),
        frecuenciaPago: prestamo.frecuenciaPago,
        cantidadCuotas: Number(prestamo.cantidadCuotas || 0),
        plazoMeses: Number(prestamo.plazoMeses || 0),
        tipoAmortizacion: 'Interés simple',
        fechaCredito: prestamo.fechaInicio,
        fechaPrimerCobro: prestamo.fechaPrimerCobro || prestamo.fechaInicio,
        tipoCarga: 'HISTORICA',
        descontarCaja: 'NO',
        garantia: prestamo.garantia,
        notas: prestamo.notas,
      }));

      return generarExcelClientesCreditosImportable(
        Array.from(clientesMap.values()),
        creditos,
        fechaStr,
      );
    }

    const rawLoans = await this.getAllLoans({
      estado: filters.estado || 'todos',
      ruta: filters.ruta || 'todas',
      search: filters.search || '',
      limit: 999999, // Traer todos para exportar
    });

    const prestamos = rawLoans.prestamos;

    // Calcular totales para la plantilla basados exactamente en lo que se va a mostrar
    const totales: CarteraTotales = {
      montoTotal: prestamos.reduce((sum, p) => sum + (p.montoTotal || 0), 0),
      montoPendiente: prestamos.reduce(
        (sum, p) => sum + (p.montoPendiente || 0),
        0,
      ),
      montoPagado: prestamos.reduce((sum, p) => sum + (p.montoPagado || 0), 0),
      totalAdeudado: prestamos.reduce(
        (sum, p) => sum + ((p.montoPendiente || 0) + (p.moraAcumulada || 0)),
        0,
      ),
      interesRecogido: 0, // Se mantiene 0 por ahora según lógica actual
      mora: prestamos.reduce((sum, p) => sum + (p.moraAcumulada || 0), 0),
      recaudo: prestamos.reduce(
        (sum, p) => sum + (p.montoPagado || 0) + (p.moraAcumulada || 0),
        0,
      ),
      totalRegistros: prestamos.length,
    };

    const filas: CarteraRow[] = prestamos.map((p) => ({
      numeroPrestamo: p.numeroPrestamo,
      cliente: p.cliente,
      dni: p.clienteDni,
      producto: p.producto,
      estado: p.estado,
      montoTotal: p.montoTotal,
      montoPendiente: p.montoPendiente,
      montoPagado: p.montoPagado,
      interesRecogido: 0,
      totalAdeudado: p.montoPendiente + p.moraAcumulada,
      mora: p.moraAcumulada,
      recaudo: p.montoPagado + p.moraAcumulada, // Consistente con el recaudo total
      cuotasPagadas: p.cuotasPagadas,
      cuotasTotales: p.cuotasTotales,
      progreso: p.progreso,
      riesgo: p.riesgo,
      ruta: p.rutaNombre,
      cobrador: p.vendedor,
      fechaInicio: p.fechaInicio,
      fechaFin: p.fechaFin,
    }));

    return generarPDFCartera(filas, totales, fechaStr);
  }
}
