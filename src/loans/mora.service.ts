import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { NotificacionesGateway } from '../notificaciones/notificaciones.gateway';

/**
 * Umbrales de días en mora para cada nivel de riesgo del cliente.
 *
 * Mínimo    → 0 días (por defecto, sin retraso) → VERDE
 * Leve      → 1 a 2 días                        → VERDE
 * Precaución→ 3 a 5 días                        → AMARILLO
 * Moderado  → 5 a 8 días                        → AMARILLO
 * Crítico   → 8 o más días                      → ROJO
 */
export const MORA_THRESHOLDS = {
  LEVE: 1,         // 1 día → Leve, sigue en VERDE
  PRECAUCION: 3,   // 3 días → Precaución, cambia a AMARILLO
  MODERADO: 5,     // 5 días → Moderado, sigue en AMARILLO
  CRITICO: 8,      // 8+ días → Crítico, sube a ROJO
};

/**
 * Etiqueta legible del nivel de mora según días en mora.
 * Mínimo es el estado por defecto (0 días = sin retraso).
 */
export function etiquetaMora(dias: number): string {
  if (dias >= MORA_THRESHOLDS.CRITICO)   return 'Crítico';    // 8+
  if (dias >= MORA_THRESHOLDS.MODERADO)  return 'Moderado';   // 5-7
  if (dias >= MORA_THRESHOLDS.PRECAUCION) return 'Precaución'; // 3-4
  if (dias >= MORA_THRESHOLDS.LEVE)      return 'Leve';       // 1-2
  return 'Mínimo'; // 0 días → siempre verde, estado base
}

/** Nivel de riesgo del schema Prisma (VERDE / AMARILLO / ROJO) según días en mora */
function nivelRiesgoPorDias(dias: number): 'VERDE' | 'AMARILLO' | 'ROJO' {
  if (dias >= MORA_THRESHOLDS.CRITICO)    return 'ROJO';     // 8+
  if (dias >= MORA_THRESHOLDS.PRECAUCION) return 'AMARILLO'; // 3-7
  return 'VERDE'; // 0-2 → Mínimo / Leve siguen en verde
}

export interface ResultadoProcesarMora {
  cuotasVencidas: number;
  prestamosEnMoraActualizados: number;
  prestamosActivosRecuperados: number;
  clientesRiesgoActualizado: number;
  errores: string[];
  procesadoEn: string;
}

@Injectable()
export class MoraService implements OnModuleInit {
  private readonly logger = new Logger(MoraService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacionesService: NotificacionesService,
    private readonly notificacionesGateway: NotificacionesGateway,
  ) {}

  async onModuleInit() {
    // Ejecutar automáticamente al arrancar el servidor
    this.logger.log('⏰ [MORA] Procesando mora automática al arranque...');
    try {
      const result = await this.procesarMoraAutomatica();
      this.logger.log(
        `✅ [MORA] Completado: ${result.cuotasVencidas} cuotas vencidas, ` +
        `${result.prestamosEnMoraActualizados} préstamos → EN_MORA, ` +
        `${result.prestamosActivosRecuperados} préstamos → ACTIVO (pagados hoy)`,
      );
    } catch (err) {
      this.logger.error(`❌ [MORA] Error al arranque: ${err.message}`);
    }
  }

  /**
   * Proceso principal de mora.
   * Puede llamarse manualmente vía endpoint o al arrancar el servidor.
   *
   * Pasos:
   * 1. Marcar cuotas PENDIENTE/PARCIAL cuya fechaVencimiento < hoy como VENCIDA
   * 2. Para préstamos ACTIVOS con al menos 1 cuota VENCIDA → EN_MORA
   * 3. Para préstamos EN_MORA sin cuotas VENCIDAS (alguien pagó hoy) → ACTIVO
   * 4. Actualizar nivelRiesgo de cada cliente según días en mora de su peor cuota
   * 5. Emitir broadcast WebSocket para que el frontend refresque
   */
  async procesarMoraAutomatica(): Promise<ResultadoProcesarMora> {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const resultado: ResultadoProcesarMora = {
      cuotasVencidas: 0,
      prestamosEnMoraActualizados: 0,
      prestamosActivosRecuperados: 0,
      clientesRiesgoActualizado: 0,
      errores: [],
      procesadoEn: new Date().toISOString(),
    };

    // ─── PASO 1: Marcar cuotas vencidas ──────────────────────────────────────
    try {
      const cuotasUpdate = await this.prisma.cuota.updateMany({
        where: {
          estado: { in: ['PENDIENTE', 'PARCIAL'] },
          fechaVencimiento: { lt: hoy },
          prestamo: {
            estado: { in: ['ACTIVO', 'EN_MORA'] },
            eliminadoEn: null,
          },
        },
        data: {
          estado: 'VENCIDA',
        },
      });
      resultado.cuotasVencidas = cuotasUpdate.count;
      this.logger.log(`[MORA] Paso 1: ${cuotasUpdate.count} cuotas marcadas como VENCIDA`);
    } catch (err) {
      resultado.errores.push(`Paso 1 (actualizar cuotas): ${err.message}`);
      this.logger.error('[MORA] Error en Paso 1:', err.message);
    }

    // ─── PASO 2: Préstamos ACTIVOS con cuotas vencidas → EN_MORA ─────────────
    try {
      const prestamosConVencidas = await this.prisma.prestamo.findMany({
        where: {
          estado: 'ACTIVO',
          eliminadoEn: null,
          cuotas: {
            some: { estado: 'VENCIDA' },
          },
        },
        select: {
          id: true,
          numeroPrestamo: true,
          clienteId: true,
          cliente: { select: { nombres: true, apellidos: true } },
        },
      });

      for (const prest of prestamosConVencidas) {
        try {
          await this.prisma.prestamo.update({
            where: { id: prest.id },
            data: { estado: 'EN_MORA' },
          });
          resultado.prestamosEnMoraActualizados++;

          // Notificar a coordinadores/admins
          await this.notificacionesService.notifyApprovers({
            titulo: '⚠️ Préstamo en Mora',
            mensaje: `El crédito ${prest.numeroPrestamo} del cliente ${prest.cliente.nombres} ${prest.cliente.apellidos} tiene cuotas vencidas y ha entrado en mora.`,
            tipo: 'ALERTA',
            entidad: 'Prestamo',
            entidadId: prest.id,
            metadata: { numeroPrestamo: prest.numeroPrestamo, clienteId: prest.clienteId },
          });
        } catch (err) {
          resultado.errores.push(`Préstamo ${prest.numeroPrestamo} → EN_MORA: ${err.message}`);
        }
      }
      this.logger.log(`[MORA] Paso 2: ${resultado.prestamosEnMoraActualizados} préstamos → EN_MORA`);
    } catch (err) {
      resultado.errores.push(`Paso 2 (actualizar préstamos → EN_MORA): ${err.message}`);
      this.logger.error('[MORA] Error en Paso 2:', err.message);
    }

    // ─── PASO 3: Préstamos EN_MORA sin cuotas VENCIDAS → ACTIVO ──────────────
    // (alguien pagó hoy todas las cuotas vencidas, pero el estado no se actualizó)
    try {
      const prestamosRecuperados = await this.prisma.prestamo.findMany({
        where: {
          estado: 'EN_MORA',
          eliminadoEn: null,
          cuotas: {
            none: { estado: 'VENCIDA' },
          },
          saldoPendiente: { gt: 0 },
        },
        select: { id: true, numeroPrestamo: true },
      });

      for (const prest of prestamosRecuperados) {
        try {
          await this.prisma.prestamo.update({
            where: { id: prest.id },
            data: { estado: 'ACTIVO' },
          });
          resultado.prestamosActivosRecuperados++;
        } catch (err) {
          resultado.errores.push(`Préstamo ${prest.numeroPrestamo} → ACTIVO: ${err.message}`);
        }
      }
      this.logger.log(`[MORA] Paso 3: ${resultado.prestamosActivosRecuperados} préstamos recuperados → ACTIVO`);
    } catch (err) {
      resultado.errores.push(`Paso 3 (recuperar préstamos): ${err.message}`);
      this.logger.error('[MORA] Error en Paso 3:', err.message);
    }

    // ─── PASO 4: Actualizar nivelRiesgo de clientes ───────────────────────────
    try {
      // Obtener todos los clientes con préstamos activos o en mora
      const clientesConPrestamos = await this.prisma.cliente.findMany({
        where: {
          enListaNegra: false,
          prestamos: {
            some: {
              estado: { in: ['ACTIVO', 'EN_MORA'] },
              eliminadoEn: null,
            },
          },
        },
        select: {
          id: true,
          nivelRiesgo: true,
          prestamos: {
            where: {
              estado: { in: ['ACTIVO', 'EN_MORA'] },
              eliminadoEn: null,
            },
            select: {
              cuotas: {
                where: { estado: 'VENCIDA' },
                orderBy: { fechaVencimiento: 'asc' },
                take: 1,
                select: { fechaVencimiento: true },
              },
            },
          },
        },
      });

      for (const cliente of clientesConPrestamos) {
        try {
          // Encontrar la cuota vencida más antigua entre todos sus préstamos
          let diasMoraMax = 0;
          for (const prestamo of cliente.prestamos) {
            if (prestamo.cuotas.length > 0) {
              const cuota = prestamo.cuotas[0];
              const fechaVenc = new Date(cuota.fechaVencimiento);
              const dias = Math.floor((hoy.getTime() - fechaVenc.getTime()) / (1000 * 60 * 60 * 24));
              if (dias > diasMoraMax) diasMoraMax = dias;
            }
          }

          const nuevoNivel = diasMoraMax > 0
            ? nivelRiesgoPorDias(diasMoraMax)
            : 'VERDE';

          // Solo actualizar si cambió
          if (cliente.nivelRiesgo !== nuevoNivel) {
            await this.prisma.cliente.update({
              where: { id: cliente.id },
              data: {
                nivelRiesgo: nuevoNivel,
                ultimaActualizacionRiesgo: new Date(),
              },
            });
            resultado.clientesRiesgoActualizado++;
          }
        } catch (err) {
          resultado.errores.push(`Cliente ${cliente.id} riesgo: ${err.message}`);
        }
      }

      // Clientes con todos los préstamos al día → restaurar a VERDE si no es LISTA_NEGRA
      await this.prisma.cliente.updateMany({
        where: {
          nivelRiesgo: { in: ['AMARILLO', 'ROJO'] },
          enListaNegra: false,
          prestamos: {
            none: {
              estado: 'EN_MORA',
              eliminadoEn: null,
            },
          },
        },
        data: {
          nivelRiesgo: 'VERDE',
          ultimaActualizacionRiesgo: new Date(),
        },
      });

      this.logger.log(`[MORA] Paso 4: ${resultado.clientesRiesgoActualizado} clientes → nivel riesgo actualizado`);
    } catch (err) {
      resultado.errores.push(`Paso 4 (nivel riesgo clientes): ${err.message}`);
      this.logger.error('[MORA] Error en Paso 4:', err.message);
    }

    // ─── PASO 5: Broadcast WebSocket ─────────────────────────────────────────
    try {
      this.notificacionesGateway.broadcastPrestamosActualizados({ accion: 'MORA_PROCESADA' });
      this.notificacionesGateway.broadcastDashboardsActualizados({ origen: 'MORA' });
    } catch (err) {
      // No bloquear el proceso por un error de WS
      this.logger.warn('[MORA] Error en broadcast WS:', err.message);
    }

    return resultado;
  }

  /**
   * Calcula el resumen de mora de un cliente específico
   * (días en mora, nivel, etiqueta) sin modificar nada en DB.
   */
  async getResumenMoraCliente(clienteId: string) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const prestamos = await this.prisma.prestamo.findMany({
      where: {
        clienteId,
        estado: { in: ['ACTIVO', 'EN_MORA'] },
        eliminadoEn: null,
      },
      include: {
        cuotas: {
          where: { estado: 'VENCIDA' },
          orderBy: { fechaVencimiento: 'asc' },
        },
      },
    });

    let diasMoraMax = 0;
    let cuotasVencidasTotal = 0;
    let montoVencidoTotal = 0;

    for (const p of prestamos) {
      cuotasVencidasTotal += p.cuotas.length;
      for (const c of p.cuotas) {
        const fechaVenc = new Date(c.fechaVencimiento);
        const dias = Math.max(
          0,
          Math.floor((hoy.getTime() - fechaVenc.getTime()) / (1000 * 60 * 60 * 24)),
        );
        if (dias > diasMoraMax) diasMoraMax = dias;
        montoVencidoTotal += Number(c.monto) - Number(c.montoPagado);
      }
    }

    return {
      clienteId,
      diasEnMora: diasMoraMax,
      nivelRiesgo: diasMoraMax > 0 ? nivelRiesgoPorDias(diasMoraMax) : 'VERDE',
      etiqueta: etiquetaMora(diasMoraMax),
      cuotasVencidas: cuotasVencidasTotal,
      montoVencido: montoVencidoTotal,
    };
  }
}
