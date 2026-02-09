import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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
          select: { id: true, nombres: true, apellidos: true }
        },
        ruta: {
          select: { id: true, nombre: true, codigo: true }
        },
        _count: {
          select: { transacciones: true }
        }
      },
      orderBy: { creadoEn: 'desc' }
    });

    return cajas.map(caja => ({
      id: caja.id,
      codigo: caja.codigo,
      nombre: caja.nombre,
      tipo: caja.tipo,
      rutaId: caja.rutaId,
      rutaNombre: caja.ruta?.nombre || null,
      responsable: caja.responsable ? `${caja.responsable.nombres} ${caja.responsable.apellidos}` : 'Sin asignar',
      responsableId: caja.responsableId,
      saldo: Number(caja.saldoActual),
      saldoMinimo: Number(caja.saldoMinimo),
      saldoMaximo: Number(caja.saldoMaximo),
      estado: caja.activa ? 'ABIERTA' : 'CERRADA',
      transacciones: caja._count.transacciones,
      ultimaActualizacion: caja.actualizadoEn.toISOString()
    }));
  }

  async getCajaById(id: string) {
    const caja = await this.prisma.caja.findUnique({
      where: { id },
      include: {
        responsable: {
          select: { id: true, nombres: true, apellidos: true }
        },
        ruta: true,
        transacciones: {
          take: 20,
          orderBy: { fechaTransaccion: 'desc' },
          include: {
            creadoPor: { select: { nombres: true, apellidos: true } }
          }
        }
      }
    });

    if (!caja) {
      throw new NotFoundException('Caja no encontrada');
    }

    return caja;
  }

  async createCaja(data: {
    nombre: string;
    tipo: TipoCaja;
    rutaId?: string;
    responsableId: string;
    saldoInicial?: number;
  }) {
    const count = await this.prisma.caja.count();
    const codigo = `CAJA-${(count + 1).toString().padStart(4, '0')}`;

    return this.prisma.caja.create({
      data: {
        codigo,
        nombre: data.nombre,
        tipo: data.tipo,
        rutaId: data.rutaId,
        responsableId: data.responsableId,
        saldoActual: data.saldoInicial || 0,
      },
      include: {
        responsable: { select: { nombres: true, apellidos: true } }
      }
    });
  }

  async updateCaja(id: string, data: {
    nombre?: string;
    responsableId?: string;
    activa?: boolean;
    saldoActual?: number;
  }) {
    return this.prisma.caja.update({
      where: { id },
      data
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
    const { cajaId, tipo, fechaInicio, fechaFin, page = 1, limit = 50 } = filtros;
    const skip = (page - 1) * limit;

    const where: any = {};

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
          caja: { select: { nombre: true, codigo: true } },
          creadoPor: { select: { nombres: true, apellidos: true } }
        },
        orderBy: { fechaTransaccion: 'desc' }
      }),
      this.prisma.transaccion.count({ where })
    ]);

    return {
      data: transacciones.map(t => ({
        id: t.id,
        numero: t.numeroTransaccion,
        fecha: t.fechaTransaccion.toISOString(),
        tipo: t.tipo,
        monto: Number(t.monto),
        descripcion: t.descripcion,
        caja: t.caja.nombre,
        cajaId: t.cajaId,
        responsable: `${t.creadoPor.nombres} ${t.creadoPor.apellidos}`,
        estado: t.estadoSincronizacion
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
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
  }) {
    const count = await this.prisma.transaccion.count();
    const numeroTransaccion = `TRX-${Date.now().toString().slice(-8)}-${(count + 1).toString().padStart(4, '0')}`;

    // Actualizar saldo de la caja
    const caja = await this.prisma.caja.findUnique({ where: { id: data.cajaId } });
    if (!caja) throw new NotFoundException('Caja no encontrada');

    const nuevoSaldo = data.tipo === 'INGRESO' 
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
        }
      }),
      this.prisma.caja.update({
        where: { id: data.cajaId },
        data: { saldoActual: nuevoSaldo }
      })
    ]);

    return transaccion;
  }

  // =====================
  // RESUMEN FINANCIERO
  // =====================

  async getResumenFinanciero(fechaInicio?: string, fechaFin?: string) {
    const hoy = new Date();
    const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const finHoy = new Date(inicioHoy.getTime() + 24 * 60 * 60 * 1000);

    const whereHoy = {
      fechaTransaccion: {
        gte: inicioHoy,
        lt: finHoy
      }
    };

    // Ingresos y egresos del día
    const [ingresosHoy, egresosHoy, totalCajas, prestamosActivos] = await Promise.all([
      this.prisma.transaccion.aggregate({
        where: { ...whereHoy, tipo: 'INGRESO' },
        _sum: { monto: true }
      }),
      this.prisma.transaccion.aggregate({
        where: { ...whereHoy, tipo: 'EGRESO' },
        _sum: { monto: true }
      }),
      this.prisma.caja.aggregate({
        where: { activa: true },
        _sum: { saldoActual: true }
      }),
      this.prisma.prestamo.aggregate({
        where: { estado: 'ACTIVO' },
        _sum: { saldoPendiente: true }
      })
    ]);

    const ingresos = Number(ingresosHoy._sum.monto || 0);
    const egresos = Number(egresosHoy._sum.monto || 0);

    return {
      ingresosHoy: ingresos,
      egresosHoy: egresos,
      gananciaNeta: ingresos - egresos,
      capitalEnCalle: Number(prestamosActivos._sum.saldoPendiente || 0),
      saldoCajas: Number(totalCajas._sum.saldoActual || 0),
      cajasAbiertas: await this.prisma.caja.count({ where: { activa: true } }),
      fecha: hoy.toISOString()
    };
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
          caja: { select: { nombre: true } }
        },
        orderBy: { fechaGasto: 'desc' }
      }),
      this.prisma.gasto.count({ where })
    ]);

    return {
      data: gastos.map(g => ({
        id: g.id,
        numero: g.numeroGasto,
        fecha: g.fechaGasto.toISOString(),
        tipo: g.tipoGasto,
        monto: Number(g.monto),
        descripcion: g.descripcion,
        cobrador: `${g.cobrador.nombres} ${g.cobrador.apellidos}`,
        ruta: g.ruta?.nombre || 'Sin ruta',
        caja: g.caja.nombre,
        estado: g.estadoAprobacion
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
    };
  }

  // Métodos legacy para compatibilidad
  create(createAccountingDto: any) {
    return this.createCaja(createAccountingDto);
  }

  findAll() {
    return this.getCajas();
  }

  findOne(id: number) {
    return this.getCajaById(id.toString());
  }

  update(id: number, updateAccountingDto: any) {
    return this.updateCaja(id.toString(), updateAccountingDto);
  }

  remove(id: number) {
    return this.updateCaja(id.toString(), { activa: false });
  }
}
