import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService, JournalLineDto } from '../accounting/ledger.service';
import { TipoCaja, TipoDiferenciaArqueo, EstadoArqueoCaja, RutaJornadaEstado } from '@prisma/client';
import { getBogotaDayKey } from '../utils/date-utils';
import { randomUUID } from 'crypto';

@Injectable()
export class CajasService {
  constructor(
    private prisma: PrismaService,
    private ledgerService: LedgerService,
  ) {}

  /**
   * Calcula el saldo esperado de una caja desde sus transacciones.
   * Suma INGRESOS y resta EGRESOS para la fecha operativa dada.
   * No incluye transacciones de otras cajas ni ventas contado de CAJA-OFICINA/BANCO.
   */
  private async calcularSaldoEsperadoDesdeTransacciones(
    cajaId: string,
    fechaOperativa: string,
  ): Promise<number> {
    const transacciones = await this.prisma.transaccion.findMany({
      where: {
        cajaId,
        fechaTransaccion: {
          gte: new Date(`${fechaOperativa}T00:00:00.000Z`),
          lt: new Date(`${fechaOperativa}T23:59:59.999Z`),
        },
        tipoReferencia: {
          notIn: ['VENTA_CONTADO'], // Excluir ventas contado que van a CAJA-OFICINA/BANCO
        },
      },
      select: {
        tipo: true,
        monto: true,
      },
    });

    let saldoEsperado = 0;

    for (const tx of transacciones) {
      const monto = Number(tx.monto || 0);
      
      if (tx.tipo === 'INGRESO') {
        saldoEsperado += monto;
      } else if (tx.tipo === 'EGRESO' || tx.tipo === 'TRANSFERENCIA') {
        saldoEsperado -= monto;
      }
      // ACTIVACION_RUTA no afecta saldo esperado (es solo marca de inicio)
    }

    return saldoEsperado;
  }

  async getArqueoPreview(cajaId: string, fechaOperativa?: string, userId?: string) {
    const fecha = fechaOperativa || getBogotaDayKey(new Date());
    const caja = await this.prisma.caja.findUnique({
      where: { id: cajaId },
      include: { ruta: true, responsable: true },
    });

    if (!caja) {
      throw new NotFoundException('Caja no encontrada');
    }

    const cajaPrincipal = await this.prisma.caja.findFirst({
      where: { tipo: TipoCaja.PRINCIPAL, activa: true },
    });

    if (!cajaPrincipal) {
      throw new NotFoundException('Caja principal no encontrada');
    }

    const arqueoExistente = await this.prisma.arqueoCaja.findUnique({
      where: { cajaId_fechaOperativa: { cajaId, fechaOperativa: fecha } },
    });

    const jornada = await this.prisma.rutaJornada.findFirst({
      where: {
        cajaId: cajaId,
        fechaOperativa: fecha,
      },
      include: { activacionTransaccion: true },
    });

    const baseInicial = jornada?.activacionTransaccion
      ? Number(jornada.activacionTransaccion.monto)
      : 0;

    // Calcular saldo esperado desde transacciones
    const saldoEsperadoCalculado = await this.calcularSaldoEsperadoDesdeTransacciones(cajaId, fecha);
    const saldoActualSistema = Number(caja.saldoActual || 0);
    
    // Usar el saldo esperado calculado como fuente primaria
    const saldoEsperado = saldoEsperadoCalculado;
    const diferenciaSistema = saldoActualSistema - saldoEsperadoCalculado;

    return {
      cajaId: caja.id,
      cajaNombre: caja.nombre,
      rutaId: caja.rutaId,
      rutaNombre: caja.ruta?.nombre || null,
      fechaOperativa: fecha,
      responsable: caja.responsable ? {
        id: caja.responsableId,
        nombre: `${caja.responsable.nombres} ${caja.responsable.apellidos}`,
      } : null,
      cajaPrincipal: {
        id: cajaPrincipal.id,
        nombre: cajaPrincipal.nombre,
        saldoActual: Number(cajaPrincipal.saldoActual),
      },
      saldoEsperado,
      desglose: {
        baseInicial,
        saldoActualSistema,
        saldoEsperadoCalculado,
        diferenciaSistema,
      },
      jornada: jornada ? { id: jornada.id, estado: jornada.estado } : null,
      arqueoExistente: Boolean(arqueoExistente),
    };
  }

  async getArqueoById(arqueoId: string) {
    const arqueo = await this.prisma.arqueoCaja.findUnique({
      where: { id: arqueoId },
      include: {
        caja: true,
        responsable: true,
        creadoPor: true,
        recibidoPor: true,
      },
    });

    if (!arqueo) {
      throw new NotFoundException('Arqueo no encontrado');
    }

    const cajaPrincipal = await this.prisma.caja.findFirst({
      where: { tipo: TipoCaja.PRINCIPAL, activa: true },
    });

    return {
      id: arqueo.id,
      fechaOperativa: arqueo.fechaOperativa,
      creadoEn: arqueo.creadoEn,
      numeroComprobanteTraslado: arqueo.numeroComprobanteTraslado,
      saldoEsperado: Number(arqueo.saldoEsperado),
      efectivoContado: Number(arqueo.efectivoContado),
      diferencia: Number(arqueo.diferencia),
      tipoDiferencia: arqueo.tipoDiferencia,
      montoTransferido: Number(arqueo.montoTransferido),
      journalEntryId: arqueo.journalEntryId,
      observaciones: arqueo.observaciones,
      cajaOrigen: {
        id: arqueo.cajaId,
        nombre: arqueo.caja.nombre,
        saldoAnterior: Number(arqueo.saldoEsperado),
        salida: Number(arqueo.saldoEsperado),
        saldoNuevo: Number(arqueo.saldoEsperado) - Number(arqueo.montoTransferido || 0),
      },
      cajaDestino: cajaPrincipal ? {
        nombre: cajaPrincipal.nombre,
        ingreso: Number(arqueo.montoTransferido),
        saldoNuevo: null,
      } : null,
      responsable: arqueo.responsable,
      creadoPor: arqueo.creadoPor,
      recibidoPor: arqueo.recibidoPor,
    };
  }

  async confirmarArqueo(
    cajaId: string,
    fechaOperativa: string,
    efectivoContado: number,
    userId: string,
    recibidoPorId?: string,
    denominaciones?: any,
    observaciones?: string,
  ) {
    // Validaciones iniciales
    const efectivo = Math.round(Number(efectivoContado || 0));
    if (efectivo < 0) {
      throw new BadRequestException('El efectivo contado no puede ser negativo');
    }

    return await this.prisma.$transaction(async (tx) => {
      const caja = await tx.caja.findUnique({
        where: { id: cajaId },
        include: { ruta: true, responsable: true },
      });
      if (!caja) {
        throw new NotFoundException('Caja no encontrada');
      }

      if (!caja.activa) {
        throw new BadRequestException('La caja no está activa');
      }

      if (caja.tipo !== TipoCaja.RUTA) {
        throw new BadRequestException('Solo se puede arquear una caja de ruta');
      }

      const arqueoExistente = await tx.arqueoCaja.findUnique({
        where: { cajaId_fechaOperativa: { cajaId, fechaOperativa } },
      });
      if (arqueoExistente) {
        throw new BadRequestException('Ya existe un arqueo para esta caja y fecha');
      }

      const jornada = await tx.rutaJornada.findFirst({
        where: { cajaId, fechaOperativa },
      });
      if (!jornada || ![RutaJornadaEstado.ABIERTA, RutaJornadaEstado.PENDIENTE_CIERRE].includes(jornada.estado)) {
        throw new BadRequestException('La jornada no está abierta o pendiente de cierre');
      }

      // Calcular saldo esperado desde transacciones
      const saldoEsperadoCalculado = await this.calcularSaldoEsperadoDesdeTransacciones(cajaId, fechaOperativa);
      const diferencia = efectivo - saldoEsperadoCalculado;

      const tipoDiferencia =
        diferencia === 0
          ? TipoDiferenciaArqueo.SIN_DIFERENCIA
          : diferencia < 0
            ? TipoDiferenciaArqueo.FALTANTE
            : TipoDiferenciaArqueo.SOBRANTE;

      // Si hay diferencia, requiere observación
      if (diferencia !== 0 && !observaciones?.trim()) {
        throw new BadRequestException(
          `El arqueo presenta ${tipoDiferencia === TipoDiferenciaArqueo.FALTANTE ? 'faltante' : 'sobrante'} de $${Math.abs(diferencia)}. Debe proporcionar una observación.`,
        );
      }

      const cajaPrincipal = await tx.caja.findFirst({
        where: { tipo: TipoCaja.PRINCIPAL, activa: true },
      });
      if (!cajaPrincipal) {
        throw new NotFoundException('Caja principal no encontrada');
      }

      const receptorId = recibidoPorId || userId;
      const recibidoPorUser = await tx.usuario.findUnique({
        where: { id: receptorId },
      });
      if (!recibidoPorUser) {
        throw new NotFoundException('Usuario receptor no encontrado');
      }

      // Generar número de comprobante de traslado (evitar concurrencia)
      const numeroComprobante = `TRAS-${fechaOperativa.replace(/-/g, '')}-${randomUUID().slice(0, 8).toUpperCase()}`;

      // 1. Crear arqueo primero con los nuevos campos
      const arqueo = await tx.arqueoCaja.create({
        data: {
          cajaId,
          rutaId: caja.rutaId,
          rutaJornadaId: jornada.id,
          fechaOperativa,
          responsableId: caja.responsableId,
          creadoPorId: userId,
          recibidoPorId: receptorId,
          recibidoEn: new Date(),
          numeroComprobanteTraslado: numeroComprobante,
          montoTransferido: efectivo,
          saldoEsperado: saldoEsperadoCalculado,
          efectivoContado: efectivo,
          diferencia,
          tipoDiferencia,
          estado: EstadoArqueoCaja.CONFIRMADO,
          denominaciones,
          observaciones,
        },
      });

      // 2. Crear asiento contable completo para el arqueo
      const lines: JournalLineDto[] = [];

      // a. Caja principal recibe el efectivo contado
      lines.push({
        accountCode: '1.1.1',
        debitAmount: efectivo,
        cajaId: cajaPrincipal.id,
        cajaDelta: +efectivo,
      });

      // b. Caja ruta entrega el saldo esperado
      lines.push({
        accountCode: '1.2.1',
        creditAmount: saldoEsperadoCalculado,
        cajaId: caja.id,
        cajaDelta: -saldoEsperadoCalculado,
      });

      // c. Ajuste por diferencia
      if (tipoDiferencia === TipoDiferenciaArqueo.FALTANTE) {
        // Faltante: debitamos Deuda Cobrador
        lines.push({
          accountCode: '1.4.1',
          debitAmount: Math.abs(diferencia),
        });
      } else if (tipoDiferencia === TipoDiferenciaArqueo.SOBRANTE) {
        // Sobrante: creditamos Ajustes Pendientes
        lines.push({
          accountCode: '2.4',
          creditAmount: diferencia,
        });
      }

      const journalEntry = await this.ledgerService.registrarAsiento(
        {
          referenceType: 'ARQUEO',
          referenceId: arqueo.id,
          description: `Arqueo de caja ${caja.nombre} - ${fechaOperativa} - ${tipoDiferencia === TipoDiferenciaArqueo.SIN_DIFERENCIA ? 'Sin diferencia' : tipoDiferencia === TipoDiferenciaArqueo.FALTANTE ? 'Faltante' : 'Sobrante'}`,
          createdBy: userId,
          lines,
        },
        tx,
      );

      // 3. Actualizar arqueo con journalEntryId
      await tx.arqueoCaja.update({
        where: { id: arqueo.id },
        data: { journalEntryId: journalEntry.id },
      });

      // 4. Cerrar jornada
      await tx.rutaJornada.update({
        where: { id: jornada.id },
        data: {
          estado: RutaJornadaEstado.CERRADA,
          cerradaEn: new Date(),
        },
      });

      // Recargar el arqueo con relaciones para devolver a frontend
      const arqueoFinal = await tx.arqueoCaja.findUniqueOrThrow({
        where: { id: arqueo.id },
        include: {
          caja: true,
          responsable: true,
          creadoPor: true,
          recibidoPor: true,
        },
      });

      // Recargar caja principal para saldo nuevo
      const cajaPrincipalActualizada = await tx.caja.findUniqueOrThrow({
        where: { id: cajaPrincipal.id },
      });

      // Recargar caja origen para saldo nuevo
      const cajaOrigenActualizada = await tx.caja.findUniqueOrThrow({
        where: { id: cajaId },
      });

      return {
        arqueoId: arqueoFinal.id,
        numeroComprobanteTraslado: arqueoFinal.numeroComprobanteTraslado,
        montoTransferido: Number(arqueoFinal.montoTransferido),
        cajaOrigen: {
          id: caja.id,
          nombre: caja.nombre,
          saldoAnterior: saldoEsperadoCalculado,
          salida: saldoEsperadoCalculado,
          saldoNuevo: Number(cajaOrigenActualizada.saldoActual),
        },
        cajaDestino: {
          id: cajaPrincipal.id,
          nombre: cajaPrincipal.nombre,
          ingreso: efectivo,
          saldoNuevo: Number(cajaPrincipalActualizada.saldoActual),
        },
        saldoEsperado: Number(arqueoFinal.saldoEsperado),
        efectivoContado: Number(arqueoFinal.efectivoContado),
        diferencia: Number(arqueoFinal.diferencia),
        tipoDiferencia: arqueoFinal.tipoDiferencia,
        responsable: arqueoFinal.responsable,
        creadoPor: arqueoFinal.creadoPor,
        recibidoPor: arqueoFinal.recibidoPor,
        recibidoEn: arqueoFinal.recibidoEn,
        creadoEn: arqueoFinal.creadoEn,
        observaciones: arqueoFinal.observaciones,
        journalEntryId: journalEntry.id,
        jornadaEstado: RutaJornadaEstado.CERRADA,
      };
    });
  }
}
