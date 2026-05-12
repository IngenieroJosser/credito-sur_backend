import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

// Definición local del enum para desacoplar del re-export del cliente generado
export type ReferenceTypeContable =
  | 'PAGO'
  | 'DESEMBOLSO'
  | 'GASTO'
  | 'VENTA_ARTICULO'
  | 'BASE'
  | 'CONSOLIDACION'
  | 'ARQUEO'
  | 'ABONO_DEUDA'
  | 'APERTURA'
  | 'AJUSTE'
  | 'INGRESO'
  | 'EGRESO'
  | 'CASTIGO_CARTERA';

export interface JournalLineDto {
  accountCode: string;
  debitAmount?:  number;
  creditAmount?: number;
  cajaId?:       string;
  /**
   * Delta EXPLÍCITO sobre `Caja.saldoActual`.
   * - Positivo  → la caja recibe dinero  (ej. cobro de pago)
   * - Negativo  → la caja entrega dinero (ej. desembolso, gasto)
   *
   * Si se omite, se infiere como `(debitAmount ?? 0) - (creditAmount ?? 0)`.
   * Se recomienda siempre declararlo explícitamente para evitar ambigüedad.
   */
  cajaDelta?: number;
}

export interface RegistrarAsientoDto {
  referenceType: ReferenceTypeContable;
  referenceId:   string;
  description?:  string;
  isOpening?:    boolean;
  createdBy:     string;
  lines:         JournalLineDto[];
}

// ─── Parámetros de métodos de alto nivel ────────────────────────────────────

export interface RegistrarPagoParams {
  pagoId:      string;
  cajaRutaId:  string;
  montoCapital: number;
  montoInteres: number;
  montoMora:    number;
  metodoPago:   string; // 'EFECTIVO' | 'TRANSFERENCIA'
  createdBy:   string;
}

export interface RegistrarDesembolsoParams {
  prestamoId:   string;
  monto:        number;
  cajaOrigenId: string;
  accountCodeOrigen: string; // '1.1.1' | '1.1.2' | '1.2.1'
  createdBy:    string;
}

export interface RegistrarGastoParams {
  gastoId:     string;
  monto:       number;
  cajaId:      string;
  cuentaGasto: string; // ej. '4.1' Gastos de Ruta, '4.2' Gastos Administrativos
  createdBy:   string;
}

export interface RegistrarConsolidacionParams {
  referenceId:  string;
  monto:        number;
  cajaOrigenId: string; // caja de ruta que entrega
  cajaDestinoId: string; // caja principal que recibe
  accountCodeDestino?: string; // '1.1.1' | '1.1.2' (opcional, default 1.1.1)
  createdBy:    string;
}

export interface RegistrarArqueoDescuadreParams {
  arqueoId:  string;
  diferencia: number; // positivo = sobrante, negativo = faltante
  cajaId:    string;
  createdBy: string;
}

export interface RegistrarAbonoDeudaParams {
  cobradorId:  string;
  monto:       number;
  cajaId:      string;
  accountCode: string; // 1.1.1 para Principal, 1.2.1 para Ruta
  createdBy:   string;
}

export interface RegistrarBajaCarteraParams {
  prestamoId:   string;
  monto:        number; // Saldo capital pendiente a castigar
  createdBy:    string;
}

export interface RegistrarAjusteCarteraParams {
  prestamoId:   string;
  montoDiferencia: number; // Positivo = aumenta cartera, Negativo = disminuye
  createdBy:    string;
}

export interface RegistrarVentaArticuloParams {
  prestamoId: string;
  precioVenta: number;
  costoArticulo: number;
  montoFinanciado: number;
  cuotaInicial?: number;
  cajaId?: string;
  accountCodeCaja?: string;
  createdBy: string;
}

// ─── Servicio ────────────────────────────────────────────────────────────────

/**
 * LedgerService — Motor Contable de Partida Doble.
 *
 * Es el ÚNICO punto de escritura autorizado para crear asientos contables.
 * Garantiza:
 *  1. Exactamente uno de (debitAmount | creditAmount) por línea.
 *  2. Suma(Débitos) === Suma(Créditos) antes de persistir (validación hard).
 *  3. Atomicidad: Asiento + Líneas + Saldos de Caja en una sola transacción.
 *  4. Sistema Dual: Mantiene `Caja.saldoActual` sincronizado mediante
 *     `cajaDelta` explícito (nunca inferido de forma ambigua).
 */
@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Método core ──────────────────────────────────────────────────────────

  /**
   * Registra un asiento contable de partida doble.
   *
   * Acepta opcionalmente un `externalTx` cuando se llama desde otro servicio
   * que ya gestiona su propia transacción atómica.  Si no se proporciona,
   * crea su propia transacción interna.
   */
  async registrarAsiento(
    dto: RegistrarAsientoDto,
    externalTx?: Prisma.TransactionClient,
  ) {
    const { referenceType, referenceId, description, isOpening, createdBy, lines } = dto;

    // 1. Validaciones (antes de abrir transacción → falla rápida)
    if (!lines || lines.length < 2) {
      throw new BadRequestException('Un asiento contable debe tener al menos dos líneas.');
    }

    let totalDebitos  = new Prisma.Decimal(0);
    let totalCreditos = new Prisma.Decimal(0);

    for (const line of lines) {
      const debit  = new Prisma.Decimal(line.debitAmount  ?? 0);
      const credit = new Prisma.Decimal(line.creditAmount ?? 0);

      if (debit.greaterThan(0) && credit.greaterThan(0)) {
        throw new BadRequestException(
          `Cuenta ${line.accountCode}: no puede tener débito y crédito simultáneamente.`,
        );
      }
      if (debit.isZero() && credit.isZero()) {
        throw new BadRequestException(
          `Cuenta ${line.accountCode}: debe tener un valor mayor a cero.`,
        );
      }

      totalDebitos  = totalDebitos.add(debit);
      totalCreditos = totalCreditos.add(credit);
    }

    // 2. Validación de Partida Doble (D = C) — con Decimal para exactitud
    if (!totalDebitos.equals(totalCreditos)) {
      throw new BadRequestException(
        `Desbalance contable — Débitos: ${totalDebitos} | Créditos: ${totalCreditos}`,
      );
    }

    // 3. Función de escritura (tipada como any para compatibilidad con el
    //    PrismaClient extendido que usa PrismaService internamente)
    const execute = async (tx: any) => {
      // a. Crear el encabezado del asiento con sus líneas
      const journalEntry = await tx.journalEntry.create({
        data: {
          referenceType,
          referenceId,
          description,
          isOpening: isOpening ?? false,
          createdBy,
          lines: {
            create: lines.map((line) => ({
              accountCode:  line.accountCode,
              debitAmount:  line.debitAmount  ?? null,
              creditAmount: line.creditAmount ?? null,
              cajaId:       line.cajaId       ?? null,
            })),
          },
        },
        include: { lines: true },
      });

      // b. Sistema Dual: actualizar saldoActual de cada Caja afectada.
      //
      // El delta usa `cajaDelta` si está declarado explícitamente.
      // Si no, lo infiere como débito - crédito (solo correcto para activos).
      // Los servicios de alto nivel SIEMPRE deben declarar cajaDelta.
      for (const line of lines) {
        if (!line.cajaId) continue;

        const delta =
          line.cajaDelta !== undefined
            ? line.cajaDelta
            : (line.debitAmount ?? 0) - (line.creditAmount ?? 0);

        if (delta === 0) continue;

        await tx.caja.update({
          where: { id: line.cajaId },
          data:  { saldoActual: { increment: delta } },
        });

        this.logger.debug(
          `[Ledger] Caja ${line.cajaId} Δ${delta > 0 ? '+' : ''}${delta}`,
        );
      }

      return journalEntry;
    };

    // 4. Usar la transacción externa si existe, o crear una nueva
    if (externalTx) {
      return execute(externalTx);
    }

    return this.prisma.$transaction(execute);
  }

  // ─── Métodos de alto nivel por flujo ─────────────────────────────────────
  //
  // Los servicios existentes (loans, payments, accounting) solo deben llamar
  // estos métodos — nunca manipular códigos de cuenta directamente.

  /**
   * Flujo 1 — Recaudo de pago de un cliente.
   * Débito:  1.2.1 Caja Ruta (entrada de efectivo)
   * Crédito: 1.3.1 Cartera Vigente (reduce deuda)
   *          3.1   Ingresos por Intereses
   *          3.2   Ingresos por Mora
   */
  async registrarPago(
    params: RegistrarPagoParams,
    tx?: Prisma.TransactionClient,
  ) {
    const montoTotal = params.montoCapital + params.montoInteres + params.montoMora;
    const accountCodeCaja = params.metodoPago === 'TRANSFERENCIA' ? '1.2.1.T' : '1.2.1.E';

    const lines: JournalLineDto[] = [
      {
        accountCode: accountCodeCaja,
        debitAmount:  montoTotal,
        cajaId:       params.cajaRutaId,
        cajaDelta:    +montoTotal,  // la caja de ruta RECIBE dinero
      },
      {
        accountCode:  '1.3.1',
        creditAmount: params.montoCapital,
        // sin cajaId — Cartera Vigente no es una caja física
      },
    ];

    if (params.montoInteres > 0) {
      lines.push({ accountCode: '3.1', creditAmount: params.montoInteres });
    }
    if (params.montoMora > 0) {
      lines.push({ accountCode: '3.2', creditAmount: params.montoMora });
    }

    return this.registrarAsiento(
      {
        referenceType: 'PAGO',
        referenceId:   params.pagoId,
        description:   `Pago recibido — capital: $${params.montoCapital} | interés: $${params.montoInteres} | mora: $${params.montoMora}`,
        createdBy:     params.createdBy,
        lines,
      },
      tx,
    );
  }

  /**
   * Flujo 2 — Desembolso de préstamo.
   * Débito:  1.3.1 Cartera Vigente (nace un activo: el derecho de cobro)
   * Crédito: 1.1.1 Caja Principal  (sale el efectivo)
   */
  async registrarDesembolso(
    params: RegistrarDesembolsoParams,
    tx?: Prisma.TransactionClient,
  ) {
    return this.registrarAsiento(
      {
        referenceType: 'DESEMBOLSO',
        referenceId:   params.prestamoId,
        description:   `Desembolso de préstamo por $${params.monto}`,
        createdBy:     params.createdBy,
        lines: [
          {
            accountCode: '1.3.1',
            debitAmount:  params.monto,
            // sin cajaId — Cartera Vigente no es caja física
          },
          {
            accountCode:  params.accountCodeOrigen, // Origen dinámico
            creditAmount:  params.monto,
            cajaId:        params.cajaOrigenId,
            cajaDelta:    -params.monto,  // la caja origen ENTREGA dinero
          },
        ],
      },
      tx,
    );
  }

  /**
   * Flujo 3 — Gasto operativo del cobrador.
   * Débito:  4.x.x Cuenta de Gasto (consume patrimonio)
   * Crédito: 1.2.1 Caja Ruta       (sale el efectivo)
   */
  async registrarGasto(
    params: RegistrarGastoParams,
    tx?: Prisma.TransactionClient,
  ) {
    return this.registrarAsiento(
      {
        referenceType: 'GASTO',
        referenceId:   params.gastoId,
        description:   `Gasto operativo — cuenta ${params.cuentaGasto}`,
        createdBy:     params.createdBy,
        lines: [
          {
            accountCode: params.cuentaGasto,
            debitAmount:  params.monto,
            // sin cajaId — las cuentas de gasto no son cajas físicas
          },
          {
            accountCode:  '1.2.1',
            creditAmount:  params.monto,
            cajaId:        params.cajaId,
            cajaDelta:    -params.monto,  // la caja de ruta ENTREGA dinero
          },
        ],
      },
      tx,
    );
  }

  /**
   * Flujo 3B — Venta/crédito de artículo.
   *
   * Débito:  Caja (cuota inicial cobrada, si aplica)
   * Débito:  1.3.1 Cartera Vigente (saldo financiado)
   * Crédito: 3.4 Ingresos por Artículos (precio de venta)
   * Débito:  5.1 Costo de Artículos Vendidos
   * Crédito: 1.5 Inventario de Artículos
   */
  async registrarVentaArticulo(
    params: RegistrarVentaArticuloParams,
    tx?: Prisma.TransactionClient,
  ) {
    const precioVenta = Number(params.precioVenta || 0);
    const costoArticulo = Number(params.costoArticulo || 0);
    const montoFinanciado = Number(params.montoFinanciado || 0);
    const cuotaInicial = Number(params.cuotaInicial || 0);

    if (precioVenta <= 0) {
      throw new BadRequestException('La venta de artículo debe tener precio de venta mayor a cero.');
    }

    const lines: JournalLineDto[] = [];

    if (cuotaInicial > 0) {
      if (!params.cajaId || !params.accountCodeCaja) {
        throw new BadRequestException('La cuota inicial requiere caja y cuenta de caja.');
      }
      lines.push({
        accountCode: params.accountCodeCaja,
        debitAmount: cuotaInicial,
        cajaId: params.cajaId,
        cajaDelta: +cuotaInicial,
      });
    }

    if (montoFinanciado > 0) {
      lines.push({
        accountCode: '1.3.1',
        debitAmount: montoFinanciado,
      });
    }

    lines.push({
      accountCode: '3.4',
      creditAmount: precioVenta,
    });

    if (costoArticulo > 0) {
      lines.push(
        {
          accountCode: '5.1',
          debitAmount: costoArticulo,
        },
        {
          accountCode: '1.5',
          creditAmount: costoArticulo,
        },
      );
    }

    return this.registrarAsiento(
      {
        referenceType: 'VENTA_ARTICULO',
        referenceId: params.prestamoId,
        description: `Venta de artículo — precio: $${precioVenta} | costo: $${costoArticulo}`,
        createdBy: params.createdBy,
        lines,
      },
      tx,
    );
  }

  /**
   * Flujo 4 — Consolidación: cobrador entrega efectivo a oficina.
   * Débito:  1.1.1 Caja Principal (recibe)
   * Crédito: 1.2.1 Caja Ruta     (entrega)
   */
  async registrarConsolidacion(
    params: RegistrarConsolidacionParams,
    tx?: Prisma.TransactionClient,
  ) {
    const cuentaDestino = params.accountCodeDestino ?? '1.1.1';
    return this.registrarAsiento(
      {
        referenceType: 'CONSOLIDACION',
        referenceId:   params.referenceId,
        description:   `Consolidación de $${params.monto} de ruta a oficina`,
        createdBy:     params.createdBy,
        lines: [
          {
            accountCode: cuentaDestino, // Destino dinámico
            debitAmount:  params.monto,
            cajaId:       params.cajaDestinoId,
            cajaDelta:   +params.monto,  // caja principal/banco RECIBE
          },
          {
            accountCode:  '1.2.1',
            creditAmount:  params.monto,
            cajaId:        params.cajaOrigenId,
            cajaDelta:    -params.monto,  // caja de ruta ENTREGA
          },
        ],
      },
      tx,
    );
  }

  /**
   * Flujo 5 — Descuadre de arqueo.
   * Sobrante (diferencia > 0): va a 2.4 Ajustes Pendientes (pasivo)
   * Faltante (diferencia < 0): se debita de 1.4.1 Deuda Cobrador
   */
  async registrarArqueoDescuadre(
    params: RegistrarArqueoDescuadreParams,
    tx?: Prisma.TransactionClient,
  ) {
    const { diferencia } = params;
    const abs = Math.abs(diferencia);

    const lines: JournalLineDto[] = diferencia > 0
      ? [
          // Sobrante: la caja tiene más de lo esperado
          { accountCode: '1.2.1', debitAmount:  abs, cajaId: params.cajaId, cajaDelta: 0 }, // ya está en caja, no mueve
          { accountCode: '2.4',   creditAmount: abs }, // se registra como ajuste pendiente
        ]
      : [
          // Faltante: el cobrador debe reintegrar
          { accountCode: '1.4.1', debitAmount:  abs }, // cuenta por cobrar al cobrador
          { accountCode: '1.2.1', creditAmount: abs, cajaId: params.cajaId, cajaDelta: -abs }, // reduce la caja
        ];

    return this.registrarAsiento(
      {
        referenceType: 'ARQUEO',
        referenceId:   params.arqueoId,
        description:   `Descuadre de arqueo — ${diferencia > 0 ? 'sobrante' : 'faltante'} de $${abs}`,
        createdBy:     params.createdBy,
        lines,
      },
      tx,
    );
  }

  /**
   * Flujo 6 — Abono a deuda de cobrador.
   * Débito:  1.x.x Caja Destino (entrada de efectivo)
   * Crédito: 1.4.1 Deuda Cobrador (reduce el activo por cobrar)
   */
  async registrarAbonoDeuda(
    params: RegistrarAbonoDeudaParams,
    tx?: Prisma.TransactionClient,
  ) {
    return this.registrarAsiento(
      {
        referenceType: 'ABONO_DEUDA',
        referenceId:   params.cobradorId,
        description:   `Abono a deuda de cobrador — monto: $${params.monto}`,
        createdBy:     params.createdBy,
        lines: [
          {
            accountCode: params.accountCode, 
            debitAmount:  params.monto,
            cajaId:       params.cajaId,
            cajaDelta:   +params.monto,
          },
          {
            accountCode:  '1.4.1',
            creditAmount:  params.monto,
          },
        ],
      },
      tx,
    );
  }

  // ─── Métodos de consulta ──────────────────────────────────────────────────

  /**
   * Saldo de una cuenta contable calculado desde el libro mayor.
   * Respeta la naturaleza de la cuenta:
   *   DEBITORA  → saldo = débitos - créditos  (Activos, Gastos)
   *   ACREEDORA → saldo = créditos - débitos  (Pasivos, Patrimonio, Ingresos)
   */
  async getSaldoCuenta(accountCode: string): Promise<{
    debitos:  Prisma.Decimal;
    creditos: Prisma.Decimal;
    saldo:    number;
    nature:   string;
  }> {
    const account = await (this.prisma as any).account.findUniqueOrThrow({
      where:  { code: accountCode },
      select: { nature: true },
    });

    const result = await (this.prisma as any).journalLine.aggregate({
      where: { accountCode },
      _sum:  { debitAmount: true, creditAmount: true },
    });

    const debitos  = result._sum.debitAmount  ?? new Prisma.Decimal(0);
    const creditos = result._sum.creditAmount ?? new Prisma.Decimal(0);

    const saldo =
      account.nature === 'DEBITORA'
        ? Number(debitos)  - Number(creditos)
        : Number(creditos) - Number(debitos);

    return { debitos, creditos, saldo, nature: account.nature };
  }

  /**
   * Verifica integridad global del libro mayor.
   * La suma de TODOS los débitos debe ser exactamente igual a la de todos los créditos.
   * Usa `Decimal.isZero()` — sin tolerancia flotante.
   */
  async verificarIntegridadGlobal(): Promise<{
    balanced:     boolean;
    totalDebitos: number;
    totalCreditos: number;
    diferencia:   number;
  }> {
    const result = await (this.prisma as any).journalLine.aggregate({
      _sum: { debitAmount: true, creditAmount: true },
    });

    const totalDebitos  = result._sum.debitAmount  ?? new Prisma.Decimal(0);
    const totalCreditos = result._sum.creditAmount ?? new Prisma.Decimal(0);
    const diferencia    = (totalDebitos as Prisma.Decimal).sub(totalCreditos as Prisma.Decimal);

    if (!diferencia.isZero()) {
      this.logger.error(
        `[Ledger] ⚠️ DESBALANCE GLOBAL detectado: ${diferencia.toString()}`,
      );
    }

    return {
      balanced:      diferencia.isZero(),
      totalDebitos:  Number(totalDebitos),
      totalCreditos: Number(totalCreditos),
      diferencia:    diferencia.toNumber(),
    };
  }

  /**
   * Verifica que el `saldoActual` de cada Caja coincida con la suma de sus líneas en el Ledger.
   */
  async verificarIntegridadCajas(): Promise<Array<{
    cajaId:     string;
    nombre:     string;
    saldoCaja:  number;
    saldoLibro: number;
    diferencia: number;
    correct:    boolean;
  }>> {
    const cajas = await this.prisma.caja.findMany({
      where: { activa: true },
      select: { id: true, nombre: true, saldoActual: true },
    });

    const report: Array<{
      cajaId:     string;
      nombre:     string;
      saldoCaja:  number;
      saldoLibro: number;
      diferencia: number;
      correct:    boolean;
    }> = [];

    for (const caja of cajas) {
      const linesSum = await (this.prisma as any).journalLine.aggregate({
        where: { cajaId: caja.id },
        _sum: { debitAmount: true, creditAmount: true },
      });

      const debitos  = linesSum._sum.debitAmount  ?? new Prisma.Decimal(0);
      const creditos = linesSum._sum.creditAmount ?? new Prisma.Decimal(0);

      // El saldo del libro para una caja (activo) es Débitos - Créditos
      const saldoLibro = Number(debitos) - Number(creditos);
      const saldoCaja  = Number(caja.saldoActual);
      const diferencia = saldoCaja - saldoLibro;

      const correct = Math.abs(diferencia) < 0.01; // Tolerancia para decimales

      if (!correct) {
        this.logger.error(
          `[Ledger] ❌ DESCUADRE en Caja "${caja.nombre}" (${caja.id}): Caja: ${saldoCaja} | Libro: ${saldoLibro} | Dif: ${diferencia}`,
        );
      }

      report.push({
        cajaId: caja.id,
        nombre: caja.nombre,
        saldoCaja,
        saldoLibro,
        diferencia,
        correct,
      });
    }

    return report;
  }

  /**
   * Flujo 8 — Baja por Pérdida (Castigo de Cartera).
   * Débito:  4.3 Pérdidas Incobrables (Gasto)
   * Crédito: 1.3.1 Cartera Vigente (Activo ↓)
   */
  async registrarBajaCartera(params: RegistrarBajaCarteraParams, tx?: Prisma.TransactionClient) {
    return this.registrarAsiento({
      referenceType: 'CASTIGO_CARTERA',
      referenceId:   params.prestamoId,
      description:   `Castigo de cartera por pérdida incobrable #${params.prestamoId}`,
      createdBy:     params.createdBy,
      lines: [
        {
          accountCode: '4.3', // Pérdidas Incobrables
          debitAmount:  params.monto,
        },
        {
          accountCode:  '1.3.1', // Cartera Vigente
          creditAmount:  params.monto,
        },
      ],
    }, tx);
  }

  /**
   * Flujo 9 — Ajuste de Cartera por Modificación.
   * Débito/Crédito: 1.3.1 Cartera Vigente
   * Contrapartida:  2.3 Ajustes Contables
   */
  async registrarAjusteCartera(params: RegistrarAjusteCarteraParams, tx?: Prisma.TransactionClient) {
    const esIncremento = params.montoDiferencia > 0;
    const montoAbs = Math.abs(params.montoDiferencia);

    return this.registrarAsiento({
      referenceType: 'AJUSTE',
      referenceId:   params.prestamoId,
      description:   `Ajuste de saldo por modificación de préstamo #${params.prestamoId}`,
      createdBy:     params.createdBy,
      lines: [
        {
          accountCode: '1.3.1',
          [esIncremento ? 'debitAmount' : 'creditAmount']: montoAbs,
        },
        {
          accountCode: '2.3', // Ajustes Contables (Patrimonio/Ajuste)
          [esIncremento ? 'creditAmount' : 'debitAmount']: montoAbs,
        },
      ],
    }, tx);
  }
}
