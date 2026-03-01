import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { NotificacionesGateway } from '../notificaciones/notificaciones.gateway';
import { PushService } from '../push/push.service';

/**
 * Umbrales de días en mora para cada nivel de mora.
 *
 * Mínimo    → 0 días (estado por defecto, sin retraso) → VERDE
 * Leve      → 1 a 2 días                              → VERDE
 * Precaución→ 3 a 4 días                              → AMARILLO
 * Moderado  → 5 a 7 días                              → AMARILLO
 * Crítico   → 8 o más días                            → ROJO
 */
export const MORA_THRESHOLDS = {
  LEVE: 1,       // 1 día  → Leve, sigue en VERDE
  PRECAUCION: 3, // 3 días → Precaución, sube a AMARILLO
  MODERADO: 5,   // 5 días → Moderado, sigue en AMARILLO
  CRITICO: 8,    // 8+ días→ Crítico, sube a ROJO
};

/**
 * Etiqueta legible de mora según días vencidos.
 * "Mínimo" es el estado base (0 días = al día, siempre VERDE).
 */
export function etiquetaMora(dias: number): string {
  if (dias >= MORA_THRESHOLDS.CRITICO)    return 'Crítico';    // 8+
  if (dias >= MORA_THRESHOLDS.MODERADO)   return 'Moderado';   // 5-7
  if (dias >= MORA_THRESHOLDS.PRECAUCION) return 'Precaución'; // 3-4
  if (dias >= MORA_THRESHOLDS.LEVE)       return 'Leve';       // 1-2
  return 'Mínimo'; // 0 días → siempre verde, estado base
}

/** Emoji de alerta según etiqueta */
function emojiMora(etiqueta: string): string {
  switch (etiqueta) {
    case 'Crítico':    return '🔴';
    case 'Moderado':   return '🟠';
    case 'Precaución': return '🟡';
    case 'Leve':       return '🟢';
    default:           return '✅';
  }
}

/** Nivel de riesgo del schema Prisma (VERDE / AMARILLO / ROJO) según días en mora */
function nivelRiesgoPorDias(dias: number): 'VERDE' | 'AMARILLO' | 'ROJO' {
  if (dias >= MORA_THRESHOLDS.CRITICO)    return 'ROJO';     // 8+
  if (dias >= MORA_THRESHOLDS.PRECAUCION) return 'AMARILLO'; // 3-7
  return 'VERDE'; // 0-2 → Mínimo / Leve, siguen en verde
}

/**
 * Determina el "nivel mora interno" (1-5) para detectar cambios de sub-nivel
 * aunque el nivelRiesgo del schema sea el mismo (ej: Precaución y Moderado son AMARILLO).
 */
function nivelMoraNumerico(dias: number): number {
  if (dias >= MORA_THRESHOLDS.CRITICO)    return 5; // Crítico
  if (dias >= MORA_THRESHOLDS.MODERADO)   return 4; // Moderado
  if (dias >= MORA_THRESHOLDS.PRECAUCION) return 3; // Precaución
  if (dias >= MORA_THRESHOLDS.LEVE)       return 2; // Leve
  return 1; // Mínimo
}

export interface ResultadoProcesarMora {
  cuotasVencidas: number;
  prestamosEnMoraActualizados: number;
  prestamosActivosRecuperados: number;
  clientesRiesgoActualizado: number;
  notificacionesEnviadas: number;
  errores: string[];
  procesadoEn: string;
}

@Injectable()
export class MoraService implements OnModuleInit {
  private readonly logger = new Logger(MoraService.name);

  // Cache en memoria para detectar cambios de sub-nivel entre ejecuciones
  // Estructura: clienteId → nivelMoraNumerico anterior
  private readonly cacheNivelesMora = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacionesService: NotificacionesService,
    private readonly notificacionesGateway: NotificacionesGateway,
    private readonly pushService: PushService,
  ) {}

  async onModuleInit() {
    this.logger.log('⏰ [MORA] Procesando mora automática al arranque...');
    try {
      const result = await this.procesarMoraAutomatica();
      this.logger.log(
        `✅ [MORA] Completado: ${result.cuotasVencidas} cuotas vencidas, ` +
        `${result.prestamosEnMoraActualizados} préstamos → EN_MORA, ` +
        `${result.prestamosActivosRecuperados} recuperados, ` +
        `${result.notificacionesEnviadas} notificaciones enviadas`,
      );
    } catch (err) {
      this.logger.error(`❌ [MORA] Error al arranque: ${err.message}`);
    }
  }

  /**
   * Proceso principal de mora.
   * Se ejecuta al arrancar el servidor y puede llamarse manualmente vía endpoint.
   *
   * Pasos:
   * 1. Marcar cuotas PENDIENTE/PARCIAL vencidas como VENCIDA
   * 2. Préstamos ACTIVOS con cuotas VENCIDAS → EN_MORA
   * 3. Préstamos EN_MORA sin cuotas VENCIDAS → ACTIVO (ya pagaron)
   * 4. Actualizar nivelRiesgo del cliente + enviar notificaciones al cambiar de nivel
   * 5. Broadcast WebSocket para refrescar el frontend
   */
  async procesarMoraAutomatica(): Promise<ResultadoProcesarMora> {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const resultado: ResultadoProcesarMora = {
      cuotasVencidas: 0,
      prestamosEnMoraActualizados: 0,
      prestamosActivosRecuperados: 0,
      clientesRiesgoActualizado: 0,
      notificacionesEnviadas: 0,
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
        data: { estado: 'VENCIDA' },
      });
      resultado.cuotasVencidas = cuotasUpdate.count;
      this.logger.log(`[MORA] Paso 1: ${cuotasUpdate.count} cuotas → VENCIDA`);
    } catch (err) {
      resultado.errores.push(`Paso 1: ${err.message}`);
      this.logger.error('[MORA] Error en Paso 1:', err.message);
    }

    // ─── PASO 2: Préstamos ACTIVOS con cuotas vencidas → EN_MORA ─────────────
    try {
      const prestamosConVencidas = await this.prisma.prestamo.findMany({
        where: {
          estado: 'ACTIVO',
          eliminadoEn: null,
          cuotas: { some: { estado: 'VENCIDA' } },
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
        } catch (err) {
          resultado.errores.push(`Préstamo ${prest.numeroPrestamo} → EN_MORA: ${err.message}`);
        }
      }
      this.logger.log(`[MORA] Paso 2: ${resultado.prestamosEnMoraActualizados} préstamos → EN_MORA`);
    } catch (err) {
      resultado.errores.push(`Paso 2: ${err.message}`);
      this.logger.error('[MORA] Error en Paso 2:', err.message);
    }

    // ─── PASO 3: Préstamos EN_MORA sin cuotas VENCIDAS → ACTIVO ──────────────
    try {
      const prestamosRecuperados = await this.prisma.prestamo.findMany({
        where: {
          estado: 'EN_MORA',
          eliminadoEn: null,
          cuotas: { none: { estado: 'VENCIDA' } },
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
      resultado.errores.push(`Paso 3: ${err.message}`);
      this.logger.error('[MORA] Error en Paso 3:', err.message);
    }

    // ─── PASO 4: Actualizar nivelRiesgo + notificaciones ─────────────────────
    try {
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
          nombres: true,
          apellidos: true,
          dni: true,
          telefono: true,
          nivelRiesgo: true,
          asignacionesRuta: {
            where: { activa: true },
            take: 1,
            select: {
              ruta: {
                select: {
                  id: true,
                  nombre: true,
                  zona: true,
                  cobrador: {
                    select: {
                      id: true,
                      nombres: true,
                      apellidos: true,
                    },
                  },
                },
              },
            },
          },
          prestamos: {
            where: {
              estado: { in: ['ACTIVO', 'EN_MORA'] },
              eliminadoEn: null,
            },
            select: {
              numeroPrestamo: true,
              saldoPendiente: true,
              cuotas: {
                where: { estado: 'VENCIDA' },
                orderBy: { fechaVencimiento: 'asc' },
                take: 1,
                select: { fechaVencimiento: true, monto: true },
              },
            },
          },
        },
      });

      for (const cliente of clientesConPrestamos) {
        try {
          // Calcular días máximos en mora entre todos sus préstamos
          let diasMoraMax = 0;
          for (const prestamo of cliente.prestamos) {
            if (prestamo.cuotas.length > 0) {
              const cuota = prestamo.cuotas[0];
              const fechaVenc = new Date(cuota.fechaVencimiento);
              const dias = Math.floor(
                (hoy.getTime() - fechaVenc.getTime()) / (1000 * 60 * 60 * 24),
              );
              if (dias > diasMoraMax) diasMoraMax = dias;
            }
          }

          const nuevoNivelPrisma = diasMoraMax > 0
            ? nivelRiesgoPorDias(diasMoraMax)
            : 'VERDE';

          const nuevaEtiqueta = etiquetaMora(diasMoraMax);
          const nuevoNivelNumerico = nivelMoraNumerico(diasMoraMax);
          const nivelNumericoAnterior = this.cacheNivelesMora.get(cliente.id) ?? 1;

          // Detectar si el cliente subió de nivel de mora (o acaba de entrar a mora)
          const subioDeNivel = nuevoNivelNumerico > nivelNumericoAnterior && diasMoraMax > 0;
          const esNuevoEnMora = nivelNumericoAnterior === 1 && nuevoNivelNumerico > 1;

          // Actualizar nivelRiesgo en DB si cambió
          if (cliente.nivelRiesgo !== nuevoNivelPrisma) {
            await this.prisma.cliente.update({
              where: { id: cliente.id },
              data: {
                nivelRiesgo: nuevoNivelPrisma,
                ultimaActualizacionRiesgo: new Date(),
              },
            });
            resultado.clientesRiesgoActualizado++;
          }

          // Actualizar cache
          this.cacheNivelesMora.set(cliente.id, nuevoNivelNumerico);

          // ─── Enviar notificaciones si el cliente subió de nivel ────────────
          if (subioDeNivel || esNuevoEnMora) {
            const nombreCliente = `${cliente.nombres} ${cliente.apellidos}`;
            const asignacion = cliente.asignacionesRuta[0];
            const ruta = asignacion?.ruta;
            const cobrador = ruta?.cobrador;
            const emoji = emojiMora(nuevaEtiqueta);

            const tituloNotif = `${emoji} Cliente en mora: ${nuevaEtiqueta}`;
            const mensajeNotif =
              `${nombreCliente} (C.C. ${cliente.dni}) tiene ${diasMoraMax} día${diasMoraMax !== 1 ? 's' : ''} en mora` +
              ` y está en nivel ${nuevaEtiqueta}.` +
              (ruta ? ` Ruta: ${ruta.nombre} (${ruta.zona}).` : ' Sin ruta asignada.') +
              (cobrador ? ` Cobrador: ${cobrador.nombres} ${cobrador.apellidos}.` : '');

            const metadataNotif = {
              clienteId: cliente.id,
              clienteNombre: nombreCliente,
              clienteDni: cliente.dni,
              diasEnMora: diasMoraMax,
              etiquetaMora: nuevaEtiqueta,
              nivelRiesgo: nuevoNivelPrisma,
              rutaId: ruta?.id,
              rutaNombre: ruta?.nombre,
              rutaZona: ruta?.zona,
              cobradorId: cobrador?.id,
              cobradorNombre: cobrador ? `${cobrador.nombres} ${cobrador.apellidos}` : null,
            };

            // 1. Notificación interna para admins/coordinadores
            try {
              await this.notificacionesService.notifyApprovers({
                titulo: tituloNotif,
                mensaje: mensajeNotif,
                tipo: 'ALERTA',
                entidad: 'Cliente',
                entidadId: cliente.id,
                metadata: metadataNotif,
              });
              resultado.notificacionesEnviadas++;
            } catch (err) {
              this.logger.warn(`[MORA] Error notif interna cliente ${cliente.id}: ${err.message}`);
            }

            // 2. Notificación interna para el cobrador asignado (si existe)
            if (cobrador?.id) {
              try {
                await this.notificacionesService.create({
                  usuarioId: cobrador.id,
                  titulo: tituloNotif,
                  mensaje:
                    `Tu cliente ${nombreCliente} tiene ${diasMoraMax} día${diasMoraMax !== 1 ? 's' : ''} ` +
                    `en mora (nivel ${nuevaEtiqueta}). Por favor gestionar el cobro.`,
                  tipo: 'ALERTA',
                  entidad: 'Cliente',
                  entidadId: cliente.id,
                  metadata: metadataNotif,
                });
                resultado.notificacionesEnviadas++;
              } catch (err) {
                this.logger.warn(`[MORA] Error notif cobrador ${cobrador.id}: ${err.message}`);
              }
            }

            // 3. Push notification a admins/coordinadores
            try {
              await this.pushService.sendPushNotification({
                title: tituloNotif,
                body: mensajeNotif,
                roleFilter: ['ADMIN', 'SUPER_ADMINISTRADOR', 'COORDINADOR', 'SUPERVISOR'],
                data: {
                  type: 'MORA_NIVEL',
                  clienteId: cliente.id,
                  etiqueta: nuevaEtiqueta,
                  diasEnMora: diasMoraMax,
                  rutaNombre: ruta?.nombre ?? null,
                },
              });
              resultado.notificacionesEnviadas++;
            } catch (err) {
              this.logger.warn(`[MORA] Error push admins: ${err.message}`);
            }

            // 4. Push notification al cobrador asignado
            if (cobrador?.id) {
              try {
                await this.pushService.sendPushNotification({
                  title: tituloNotif,
                  body:
                    `${nombreCliente} lleva ${diasMoraMax} días sin pagar. ` +
                    `Nivel: ${nuevaEtiqueta}. Gestiona el cobro hoy.`,
                  userId: cobrador.id,
                  data: {
                    type: 'MORA_NIVEL',
                    clienteId: cliente.id,
                    etiqueta: nuevaEtiqueta,
                    diasEnMora: diasMoraMax,
                  },
                });
                resultado.notificacionesEnviadas++;
              } catch (err) {
                this.logger.warn(`[MORA] Error push cobrador ${cobrador.id}: ${err.message}`);
              }
            }

            this.logger.log(
              `[MORA] 🔔 Notificado: ${nombreCliente} → ${nuevaEtiqueta} (${diasMoraMax} días)` +
              (ruta ? ` | Ruta: ${ruta.nombre}` : ''),
            );
          }
        } catch (err) {
          resultado.errores.push(`Cliente ${cliente.id}: ${err.message}`);
        }
      }

      // Clientes que ya no tienen préstamos EN_MORA → regresar a VERDE
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

      this.logger.log(
        `[MORA] Paso 4: ${resultado.clientesRiesgoActualizado} clientes riesgo actualizado, ` +
        `${resultado.notificacionesEnviadas} notificaciones enviadas`,
      );
    } catch (err) {
      resultado.errores.push(`Paso 4: ${err.message}`);
      this.logger.error('[MORA] Error en Paso 4:', err.message);
    }

    // ─── PASO 5: Broadcast WebSocket ─────────────────────────────────────────
    try {
      this.notificacionesGateway.broadcastPrestamosActualizados({ accion: 'MORA_PROCESADA' });
      this.notificacionesGateway.broadcastDashboardsActualizados({ origen: 'MORA' });
    } catch (err) {
      this.logger.warn('[MORA] Error broadcast WS:', err.message);
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

    const cliente = await this.prisma.cliente.findUnique({
      where: { id: clienteId },
      select: {
        id: true,
        nombres: true,
        apellidos: true,
        nivelRiesgo: true,
        asignacionesRuta: {
          where: { activa: true },
          take: 1,
          select: {
            ruta: {
              select: {
                nombre: true,
                zona: true,
                cobrador: { select: { nombres: true, apellidos: true } },
              },
            },
          },
        },
        prestamos: {
          where: {
            estado: { in: ['ACTIVO', 'EN_MORA'] },
            eliminadoEn: null,
          },
          select: {
            numeroPrestamo: true,
            saldoPendiente: true,
            cuotas: {
              where: { estado: 'VENCIDA' },
              orderBy: { fechaVencimiento: 'asc' },
              select: { fechaVencimiento: true, monto: true, montoPagado: true },
            },
          },
        },
      },
    });

    if (!cliente) return null;

    let diasMoraMax = 0;
    let cuotasVencidasTotal = 0;
    let montoVencidoTotal = 0;

    for (const p of cliente.prestamos) {
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

    const asignacion = cliente.asignacionesRuta[0];
    const ruta = asignacion?.ruta;

    return {
      clienteId,
      clienteNombre: `${cliente.nombres} ${cliente.apellidos}`,
      diasEnMora: diasMoraMax,
      nivelRiesgo: diasMoraMax > 0 ? nivelRiesgoPorDias(diasMoraMax) : 'VERDE',
      etiqueta: etiquetaMora(diasMoraMax),
      cuotasVencidas: cuotasVencidasTotal,
      montoVencido: montoVencidoTotal,
      ruta: ruta
        ? {
            nombre: ruta.nombre,
            zona: ruta.zona,
            cobrador: ruta.cobrador
              ? `${ruta.cobrador.nombres} ${ruta.cobrador.apellidos}`
              : 'Sin cobrador',
          }
        : null,
    };
  }
}
