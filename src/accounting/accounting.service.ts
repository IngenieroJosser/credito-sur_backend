import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { TipoCaja, TipoTransaccion } from '@prisma/client';

@Injectable()
export class AccountingService {
  private readonly logger = new Logger(AccountingService.name);

  constructor(private readonly prisma: PrismaService) {}

  // =====================
  // CAJAS
  // =====================

  async getCajas() {
    const cajas = await this.prisma.caja.findMany({
      where: { activa: true },
      include: {
        responsable: {
          select: { id: true, nombres: true, apellidos: true },
        },
        ruta: {
          select: { id: true, nombre: true, codigo: true },
        },
        _count: {
          select: { transacciones: true },
        },
      },
      orderBy: { creadoEn: 'desc' },
    });

    return cajas.map((caja) => ({
      id: caja.id,
      codigo: caja.codigo,
      nombre: caja.nombre,
      tipo: caja.tipo,
      rutaId: caja.rutaId,
      rutaNombre: caja.ruta?.nombre || null,
      responsable: caja.responsable
        ? `${caja.responsable.nombres} ${caja.responsable.apellidos}`
        : 'Sin asignar',
      responsableId: caja.responsableId,
      saldo: Number(caja.saldoActual),
      saldoMinimo: Number(caja.saldoMinimo),
      saldoMaximo: Number(caja.saldoMaximo),
      estado: caja.activa ? 'ABIERTA' : 'CERRADA',
      transacciones: caja._count.transacciones,
      ultimaActualizacion: caja.actualizadoEn.toISOString(),
    }));
  }

  async getCajaById(id: string) {
    const caja = await this.prisma.caja.findUnique({
      where: { id },
      include: {
        responsable: {
          select: { id: true, nombres: true, apellidos: true },
        },
        ruta: true,
        transacciones: {
          take: 20,
          orderBy: { fechaTransaccion: 'desc' },
          include: {
            creadoPor: { select: { nombres: true, apellidos: true } },
          },
        },
      },
    });

    if (!caja) {
      throw new NotFoundException('Caja no encontrada');
    }

    return caja;
  }

  async createCaja(
    data: {
      nombre: string;
      tipo: TipoCaja;
      rutaId?: string;
      responsableId: string;
      saldoInicial?: number;
    },
    userId: string,
  ) {
    try {
      // 1. Validar Usuario actual y Permisos
      const currentUser = await this.prisma.usuario.findUnique({
        where: { id: userId },
        select: { id: true, rol: true },
      });

      if (!currentUser) {
        throw new UnauthorizedException(
          'Usuario no válido para realizar esta acción',
        );
      }

      // Regla: Solo Admin, SuperAdmin, Contador y Coordinador pueden crear Cajas Principales
      if (data.tipo === 'PRINCIPAL') {
        const rolesPermitidos = [
          'ADMIN',
          'SUPER_ADMINISTRADOR',
          'CONTADOR',
          'COORDINADOR',
        ];
        if (!rolesPermitidos.includes(currentUser.rol)) {
          throw new ForbiddenException(
            'No tienes permisos para crear una Caja Principal',
          );
        }
      }

      // 2. Validar que el responsable exista
      const responsable = await this.prisma.usuario.findUnique({
        where: { id: data.responsableId },
      });

      if (!responsable) {
        throw new BadRequestException(
          'El responsable asignado no es un usuario válido',
        );
      }

      // 3. Si es tipo RUTA, validar que la ruta exista (si se envió rutaId)
      // Se usa 'undefined' para asegurar que rutaId vacío sea ignorado en la consulta
      const rutaIdSanitizado = data.rutaId ? data.rutaId : undefined;

      if (data.tipo === 'RUTA' && rutaIdSanitizado) {
        const ruta = await this.prisma.ruta.findUnique({
          where: { id: rutaIdSanitizado },
        });
        if (!ruta) {
          throw new BadRequestException('La ruta especificada no existe');
        }
      }

      // Generar código único basándose en el último creado
      const lastCaja = await this.prisma.caja.findFirst({
        orderBy: { creadoEn: 'desc' },
      });

      let nextNum = 1;
      if (lastCaja && lastCaja.codigo.startsWith('CAJA-')) {
        const lastNum = parseInt(lastCaja.codigo.split('-')[1]);
        if (!isNaN(lastNum)) {
          nextNum = lastNum + 1;
        }
      }

      const codigo = `CAJA-${nextNum.toString().padStart(4, '0')}`;

      return await this.prisma.$transaction(async (tx) => {
        // 1. Crear la Caja
        const nuevaCaja = await tx.caja.create({
          data: {
            codigo,
            nombre: data.nombre,
            tipo: data.tipo,
            rutaId: rutaIdSanitizado,
            responsableId: data.responsableId,
            saldoActual: data.saldoInicial || 0,
          },
          include: {
            responsable: { select: { nombres: true, apellidos: true } },
          },
        });

        // 2. Si hay saldo inicial > 0, registrar el movimiento de apertura
        if (data.saldoInicial && data.saldoInicial > 0) {
          const count = await tx.transaccion.count();
          const numeroTransaccion = `TRX-${Date.now().toString().slice(-8)}-${(count + 1).toString().padStart(4, '0')}`;

          await tx.transaccion.create({
            data: {
              numeroTransaccion,
              cajaId: nuevaCaja.id,
              tipo: TipoTransaccion.INGRESO,
              monto: data.saldoInicial,
              descripcion: 'Saldo Inicial de Apertura de Caja',
              creadoPorId: userId, // El usuario que crea la caja es quien registra el saldo inicial
              tipoReferencia: 'APERTURA_CAJA',
              referenciaId: nuevaCaja.codigo,
            },
          });
        }

        return nuevaCaja;
      });
    } catch (error) {
      this.logger.error(`Error creando caja: ${error.message}`, error.stack);
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      // Si es un error de base de datos específico (ej: input syntax for uuid), devolvemos BadRequest
      if (error.code === 'P2023' || error.message.includes('uuid')) {
        throw new BadRequestException(
          'Formato de ID inválido (UUID requerido). Verifique responsableId o rutaId.',
        );
      }

      throw new BadRequestException(
        `No se pudo crear la caja: ${error.message || 'Error desconocido'}`,
      );
    }
  }

  async updateCaja(
    id: string,
    data: {
      nombre?: string;
      responsableId?: string;
      activa?: boolean;
      saldoActual?: number;
    },
  ) {
    return this.prisma.caja.update({
      where: { id },
      data,
    });
  }

  // =====================
  // TRANSACCIONES / MOVIMIENTOS
  // =====================

  async getTransacciones(filtros: {
    cajaId?: string;
    tipo?: TipoTransaccion;
    fechaInicio?: string;
    fechaFin?: string;
    page?: number;
    limit?: number;
  }) {
    const {
      cajaId,
      tipo,
      fechaInicio,
      fechaFin,
      page = 1,
      limit = 50,
    } = filtros;
    const skip = (page - 1) * limit;

    const where: any = {};

    // Se eliminó el filtro que excluía consolidaciones para mostrarlas en movimientos recientes

    if (cajaId) where.cajaId = cajaId;
    if (tipo) where.tipo = tipo;
    if (fechaInicio || fechaFin) {
      where.fechaTransaccion = {};
      if (fechaInicio) where.fechaTransaccion.gte = new Date(fechaInicio);
      if (fechaFin) where.fechaTransaccion.lte = new Date(fechaFin);
    }

    const [transacciones, total] = await Promise.all([
      this.prisma.transaccion.findMany({
        where,
        skip,
        take: limit,
        include: {
          caja: {
            select: {
              nombre: true,
              codigo: true,
              tipo: true,
              rutaId: true,
              saldoActual: true,
            },
          },
          creadoPor: { select: { nombres: true, apellidos: true } },
        },
        orderBy: { fechaTransaccion: 'desc' },
      }),
      this.prisma.transaccion.count({ where }),
    ]);

    return {
      data: transacciones.map((t) => ({
        id: t.id,
        numero: t.numeroTransaccion,
        fecha: t.fechaTransaccion.toISOString(),
        tipo: t.tipo,
        monto: Number(t.monto),
        descripcion: t.descripcion,
        caja: t.caja.nombre,
        cajaId: t.cajaId,
        responsable: `${t.creadoPor.nombres} ${t.creadoPor.apellidos}`,
        estado: 'APROBADO', // Todas las trx en DB están aprobadas
        origen: t.caja.tipo === 'RUTA' ? 'COBRADOR' : 'EMPRESA',
        categoria: t.tipoReferencia || 'GENERAL',
        rutaId: t.caja.rutaId,
        cajaSaldo: Number(t.caja.saldoActual),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createTransaccion(data: {
    cajaId: string;
    tipo: TipoTransaccion;
    monto: number;
    descripcion: string;
    creadoPorId: string;
    tipoReferencia?: string;
    referenciaId?: string;
    cajaOrigenId?: string;
  }) {
    const count = await this.prisma.transaccion.count();
    const numeroTransaccion = `TRX-${Date.now().toString().slice(-8)}-${(count + 1).toString().padStart(4, '0')}`;

    // Actualizar saldo de la caja (Destino)
    const caja = await this.prisma.caja.findUnique({
      where: { id: data.cajaId },
    });
    if (!caja) throw new NotFoundException('Caja no encontrada');

    // Caso Especial: Si hay caja origen, es una transferencia/consolidación
    if (data.cajaOrigenId) {
      const cajaOrigen = await this.prisma.caja.findUnique({
        where: { id: data.cajaOrigenId },
      });
      if (!cajaOrigen) throw new NotFoundException('Caja origen no encontrada');

      const numeroReferencia = `CONS-${Date.now().toString().slice(-6)}`;
      const cajaOrigenId = data.cajaOrigenId; // Capturar para TS

      return this.prisma.$transaction(async (tx) => {
        // 1. Salida de la caja origen
        await tx.transaccion.create({
          data: {
            numeroTransaccion: `TRX-OUT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            cajaId: cajaOrigenId,
            tipo: TipoTransaccion.TRANSFERENCIA,
            monto: data.monto,
            descripcion: `Transferencia enviada a ${caja.nombre}`,
            creadoPorId: data.creadoPorId,
            tipoReferencia: 'TRANSFERENCIA_INTERNA',
            referenciaId: numeroReferencia,
          },
        });

        // 2. Entrada a la caja destino
        const transaccion = await tx.transaccion.create({
          data: {
            numeroTransaccion: `TRX-IN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            cajaId: data.cajaId,
            tipo: TipoTransaccion.TRANSFERENCIA,
            monto: data.monto,
            descripcion: `Transferencia recibida de ${cajaOrigen.nombre}`,
            creadoPorId: data.creadoPorId,
            tipoReferencia: 'TRANSFERENCIA_INTERNA',
            referenciaId: numeroReferencia,
          },
        });

        // 3. Actualizar Saldos
        await tx.caja.update({
          where: { id: data.cajaOrigenId },
          data: { saldoActual: { decrement: data.monto } },
        });

        await tx.caja.update({
          where: { id: data.cajaId },
          data: { saldoActual: { increment: data.monto } },
        });

        return transaccion;
      });
    }

    const nuevoSaldo =
      data.tipo === 'INGRESO'
        ? Number(caja.saldoActual) + data.monto
        : Number(caja.saldoActual) - data.monto;

    const [transaccion] = await this.prisma.$transaction([
      this.prisma.transaccion.create({
        data: {
          numeroTransaccion,
          cajaId: data.cajaId,
          tipo: data.tipo,
          monto: data.monto,
          descripcion: data.descripcion,
          creadoPorId: data.creadoPorId,
          tipoReferencia: data.tipoReferencia,
          referenciaId: data.referenciaId,
        },
      }),
      this.prisma.caja.update({
        where: { id: data.cajaId },
        data: { saldoActual: nuevoSaldo },
      }),
    ]);

    return transaccion;
  }

  async consolidarCaja(cajaOrigenId: string, administradorId: string) {
    // 1. Validar Caja Origen
    const cajaOrigen = await this.prisma.caja.findUnique({
      where: { id: cajaOrigenId },
    });
    if (!cajaOrigen) throw new NotFoundException('Caja origen no encontrada');

    const saldo = Number(cajaOrigen.saldoActual);
    if (saldo <= 0) {
      throw new Error('La caja no tiene fondos para consolidar');
    }

    // 2. Buscar Caja Principal
    const cajaPrincipal = await this.prisma.caja.findFirst({
      where: { tipo: TipoCaja.PRINCIPAL, activa: true },
    });

    if (!cajaPrincipal) throw new Error('No existe una Caja Principal activa');
    if (cajaPrincipal.id === cajaOrigen.id)
      throw new Error(
        'No se puede consolidar la caja principal sobre sí misma',
      );

    const fecha = new Date();
    const numeroRef = `CONS-${Date.now().toString().slice(-6)}`;

    // 3. Ejecutar Transacción Atómica
    return this.prisma.$transaction(async (tx) => {
      // Registrar salida en caja origen
      const egreso = await tx.transaccion.create({
        data: {
          numeroTransaccion: `TRX-OUT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          cajaId: cajaOrigen.id,
          tipo: TipoTransaccion.TRANSFERENCIA,
          monto: saldo,
          descripcion: `Consolidación enviada a Caja Principal (${cajaPrincipal.nombre})`,
          creadoPorId: administradorId,
          tipoReferencia: 'CONSOLIDACION',
          referenciaId: numeroRef,
        },
      });

      // Registrar entrada en caja principal
      const ingreso = await tx.transaccion.create({
        data: {
          numeroTransaccion: `TRX-IN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          cajaId: cajaPrincipal.id,
          tipo: TipoTransaccion.TRANSFERENCIA,
          monto: saldo,
          descripcion: `Consolidación recibida de ${cajaOrigen.nombre}`,
          creadoPorId: administradorId,
          tipoReferencia: 'CONSOLIDACION',
          referenciaId: numeroRef,
        },
      });

      // Actualizar saldo origen a 0
      await tx.caja.update({
        where: { id: cajaOrigen.id },
        data: { saldoActual: 0 },
      });

      // Actualizar saldo principal
      await tx.caja.update({
        where: { id: cajaPrincipal.id },
        data: {
          saldoActual: { increment: saldo },
        },
      });

      return {
        origen: cajaOrigen.nombre,
        destino: cajaPrincipal.nombre,
        monto: saldo,
        transacciones: [egreso.id, ingreso.id],
      };
    });
  }

  // =====================
  // RESUMEN FINANCIERO
  // =====================

  async getResumenFinanciero(fechaInicio?: string, fechaFin?: string) {
    const hoy = new Date();
    const inicioHoy = new Date(
      hoy.getFullYear(),
      hoy.getMonth(),
      hoy.getDate(),
    );
    const finHoy = new Date(inicioHoy.getTime() + 24 * 60 * 60 * 1000);

    const inicioAyer = new Date(inicioHoy.getTime() - 24 * 60 * 60 * 1000);
    const finAyer = inicioHoy;

    const whereHoy = {
      fechaTransaccion: { gte: inicioHoy, lt: finHoy },
    };

    const whereAyer = {
      fechaTransaccion: { gte: inicioAyer, lt: finAyer },
    };

    // Ingresos y egresos del día y de ayer (Incluyendo transferencias/consolidaciones)
    const [
      ingresosHoy,
      egresosHoy,
      ingresosAyer,
      egresosAyer,
      totalCajas,
      prestamosActivos,
      totalRutasCount,
      rutasAbiertasCount,
      rutasPendientesConsolidacion,
      consolidacionesHoy,
    ] = await Promise.all([
      this.prisma.transaccion.aggregate({
        where: {
          ...whereHoy,
          OR: [
            { tipo: 'INGRESO' },
            {
              tipo: 'TRANSFERENCIA',
              numeroTransaccion: { startsWith: 'TRX-IN' },
            },
          ],
        },
        _sum: { monto: true },
      }),
      this.prisma.transaccion.aggregate({
        where: {
          ...whereHoy,
          OR: [
            { tipo: 'EGRESO' },
            {
              tipo: 'TRANSFERENCIA',
              numeroTransaccion: { startsWith: 'TRX-OUT' },
            },
          ],
        },
        _sum: { monto: true },
      }),
      this.prisma.transaccion.aggregate({
        where: {
          ...whereAyer,
          OR: [
            { tipo: 'INGRESO' },
            {
              tipo: 'TRANSFERENCIA',
              numeroTransaccion: { startsWith: 'TRX-IN' },
            },
          ],
        },
        _sum: { monto: true },
      }),
      this.prisma.transaccion.aggregate({
        where: {
          ...whereAyer,
          OR: [
            { tipo: 'EGRESO' },
            {
              tipo: 'TRANSFERENCIA',
              numeroTransaccion: { startsWith: 'TRX-OUT' },
            },
          ],
        },
        _sum: { monto: true },
      }),
      this.prisma.caja.aggregate({
        where: { activa: true },
        _sum: { saldoActual: true },
      }),
      this.prisma.prestamo.aggregate({
        where: { estado: 'ACTIVO' },
        _sum: { saldoPendiente: true },
      }),
      this.prisma.caja.count({ where: { tipo: 'RUTA' } }),
      this.prisma.caja.count({ where: { tipo: 'RUTA', activa: true } }),
      this.prisma.caja.count({
        where: { tipo: 'RUTA', saldoActual: { gt: 0 } },
      }),
      this.prisma.transaccion.count({
        where: {
          ...whereHoy,
          tipoReferencia: 'CONSOLIDACION',
          tipo: 'TRANSFERENCIA',
          caja: { tipo: 'RUTA' },
        },
      }),
    ]);

    const ingresos = Number(ingresosHoy._sum.monto || 0);
    const egresos = Number(egresosHoy._sum.monto || 0);
    const ingresosAyerVal = Number(ingresosAyer._sum.monto || 0);
    const egresosAyerVal = Number(egresosAyer._sum.monto || 0);

    const calcularDiferencia = (actual: number, anterior: number) => {
      if (anterior === 0) return actual > 0 ? 100 : 0;
      return Number((((actual - anterior) / anterior) * 100).toFixed(2));
    };

    const porcentajeCierres =
      totalRutasCount > 0
        ? Math.round(
            ((totalRutasCount - rutasAbiertasCount) / totalRutasCount) * 100,
          )
        : 0;

    return {
      ingresosHoy: ingresos,
      egresosHoy: egresos,
      gananciaNeta: ingresos - egresos,
      capitalEnCalle: Number(prestamosActivos._sum.saldoPendiente || 0),
      saldoCajas: Number(totalCajas._sum.saldoActual || 0),
      cajasAbiertasCount: await this.prisma.caja.count({
        where: { activa: true },
      }),
      rutasTotales: totalRutasCount,
      rutasAbiertas: rutasAbiertasCount,
      rutasPendientesConsolidacion: rutasPendientesConsolidacion,
      consolidacionesHoy: consolidacionesHoy,
      porcentajeCierre: porcentajeCierres,
      fecha: hoy.toISOString(),
      porcentajeIngresosVsAyer: calcularDiferencia(ingresos, ingresosAyerVal),
      porcentajeEgresosVsAyer: calcularDiferencia(egresos, egresosAyerVal),
      esIngresoPositivo: ingresos >= ingresosAyerVal,
      esEgresoPositivo: egresos <= egresosAyerVal,
    };
  }

  // =====================
  // CIERRES
  // =====================

  async getHistorialCierres(filtros?: {
    tipo?: 'ARQUEO' | 'CONSOLIDACION';
    cajaId?: string;
    soloRutas?: boolean;
    estado?: 'CUADRADA' | 'DESCUADRADA';
    fechaInicio?: string;
    fechaFin?: string;
  }) {
    const where: any = {};
    const or: any[] = [];
    const tipo = filtros?.tipo;
    if (!tipo || tipo === undefined) {
      or.push({ tipoReferencia: 'CONSOLIDACION', tipo: 'TRANSFERENCIA' });
      or.push({ tipoReferencia: 'ARQUEO' });
    } else if (tipo === 'CONSOLIDACION') {
      or.push({ tipoReferencia: 'CONSOLIDACION', tipo: 'TRANSFERENCIA' });
    } else if (tipo === 'ARQUEO') {
      or.push({ tipoReferencia: 'ARQUEO' });
    }
    where.OR = or;
    if (filtros?.cajaId) where.cajaId = filtros.cajaId;
    if (filtros?.fechaInicio || filtros?.fechaFin) {
      where.fechaTransaccion = {};
      if (filtros.fechaInicio)
        where.fechaTransaccion.gte = new Date(filtros.fechaInicio);
      if (filtros.fechaFin)
        where.fechaTransaccion.lte = new Date(filtros.fechaFin);
    }
    const transacciones = await this.prisma.transaccion.findMany({
      where,
      include: {
        caja: { select: { nombre: true, tipo: true } },
        creadoPor: { select: { nombres: true, apellidos: true } },
      },
      orderBy: { fechaTransaccion: 'desc' },
      take: 200,
    });

    let mapped = transacciones.map((t) => {
      if (t.tipoReferencia === 'ARQUEO') {
        // referenciaId formateado como "SS:<saldoSistema>|ER:<efectivoReal>|DF:<diferencia>"
        let saldoSistema = 0;
        let efectivoReal = 0;
        let diferencia = Number(t.monto);
        try {
          const parts = (t.referenciaId || '').split('|');
          for (const p of parts) {
            const [k, v] = p.split(':');
            if (k === 'SS') saldoSistema = Number(v);
            if (k === 'ER') efectivoReal = Number(v);
            if (k === 'DF') diferencia = Number(v);
          }
        } catch (_) {}
        return {
          id: t.id,
          fecha: t.fechaTransaccion.toISOString(),
          caja: t.caja.nombre,
          responsable: `${t.creadoPor.nombres} ${t.creadoPor.apellidos}`,
          saldoSistema,
          saldoReal: efectivoReal,
          diferencia,
          estado: diferencia === 0 ? 'CUADRADA' : 'DESCUADRADA',
          descripcion: t.descripcion,
          tipo: 'ARQUEO',
          referenciaId: t.referenciaId,
          cajaId: t.cajaId,
        };
      }
      return {
        id: t.id,
        fecha: t.fechaTransaccion.toISOString(),
        caja: t.caja.nombre,
        responsable: `${t.creadoPor.nombres} ${t.creadoPor.apellidos}`,
        saldoSistema: Number(t.monto),
        saldoReal: Number(t.monto),
        diferencia: 0,
        estado: 'CUADRADA',
        cajaTipo: t.caja.tipo,
        descripcion: t.descripcion,
        tipo: 'CONSOLIDACION',
        referenciaId: t.referenciaId,
        cajaId: t.cajaId,
      };
    });
    // Filtro opcional por estado (solo aplicable para ARQUEO)
    if (filtros?.estado) {
      if (filtros.estado === 'DESCUADRADA') {
        mapped = mapped.filter((m) => m.estado === 'DESCUADRADA');
      } else if (filtros.estado === 'CUADRADA') {
        mapped = mapped.filter((m) => m.estado === 'CUADRADA');
      }
    }
    // Filtro opcional: solo cajas de rutas (cobradores)
    if (filtros?.soloRutas) {
      mapped = mapped.filter((m: any) => m.cajaTipo === 'RUTA');
    }
    return mapped;
  }

  async registrarArqueo(
    cajaId: string,
    data: {
      efectivoReal: number;
      saldoSistema: number;
      diferencia: number;
      observaciones?: string;
    },
    userId: string,
  ) {
    const caja = await this.prisma.caja.findUnique({ where: { id: cajaId } });
    if (!caja) throw new NotFoundException('Caja no encontrada');

    const montoAjuste = Math.abs(Number(data.diferencia || 0));
    const referenciaId = `SS:${Number(data.saldoSistema)}|ER:${Number(data.efectivoReal)}|DF:${Number(data.diferencia)}`;
    const descripcionBase = 'Arqueo de Caja';
    const descripcion = data.observaciones
      ? `${descripcionBase}: ${data.observaciones}`
      : descripcionBase;

    // Si no hay diferencia, registramos evento neutro para historial (monto 0)
    if (montoAjuste === 0) {
      return this.prisma.transaccion.create({
        data: {
          numeroTransaccion: `ARQ-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          cajaId,
          tipo: TipoTransaccion.TRANSFERENCIA,
          monto: 0,
          descripcion,
          creadoPorId: userId,
          tipoReferencia: 'ARQUEO',
          referenciaId,
        },
      });
    }

    // Con diferencia: registrar ajuste como ingreso/egreso para cuadrar
    const tipoAjuste =
      Number(data.diferencia) > 0
        ? TipoTransaccion.INGRESO
        : TipoTransaccion.EGRESO;

    return this.createTransaccion({
      cajaId,
      tipo: tipoAjuste,
      monto: montoAjuste,
      descripcion,
      creadoPorId: userId,
      tipoReferencia: 'ARQUEO',
      referenciaId,
    });
  }

  // =====================
  // GASTOS
  // =====================

  async getGastos(filtros: {
    rutaId?: string;
    estado?: string;
    page?: number;
    limit?: number;
  }) {
    const { rutaId, estado, page = 1, limit = 50 } = filtros;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (rutaId) where.rutaId = rutaId;
    if (estado) where.estadoAprobacion = estado;

    const [gastos, total] = await Promise.all([
      this.prisma.gasto.findMany({
        where,
        skip,
        take: limit,
        include: {
          cobrador: { select: { nombres: true, apellidos: true } },
          ruta: { select: { nombre: true } },
          caja: { select: { nombre: true } },
        },
        orderBy: { fechaGasto: 'desc' },
      }),
      this.prisma.gasto.count({ where }),
    ]);

    return {
      data: gastos.map((g) => ({
        id: g.id,
        numero: g.numeroGasto,
        fecha: g.fechaGasto.toISOString(),
        tipo: g.tipoGasto,
        monto: Number(g.monto),
        descripcion: g.descripcion,
        cobrador: `${g.cobrador.nombres} ${g.cobrador.apellidos}`,
        ruta: g.ruta?.nombre || 'Sin ruta',
        caja: g.caja.nombre,
        estado: g.estadoAprobacion,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
