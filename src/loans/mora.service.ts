import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { mensajeDeError } from '../common/error.util';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { NotificacionesGateway } from '../notificaciones/notificaciones.gateway';
import { PushService } from '../push/push.service';
import {
  formatBogotaOffsetIso,
  getBogotaDayKey,
  getBogotaStartEndOfDay,
  getBogotaWeekday,
} from '../utils/date-utils';

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
  LEVE: 1, // 1 día  → Leve, sigue en VERDE
  PRECAUCION: 3, // 3 días → Precaución, sube a AMARILLO
  MODERADO: 5, // 5 días → Moderado, sigue en AMARILLO
  CRITICO: 8, // 8+ días→ Crítico, sube a ROJO
};

/**
 * Etiqueta legible de mora según días vencidos.
 * "Mínimo" es el estado base (0 días = al día, siempre VERDE).
 */
export function etiquetaMora(dias: number): string {
  if (dias >= MORA_THRESHOLDS.CRITICO) return 'Crítico'; // 8+
  if (dias >= MORA_THRESHOLDS.MODERADO) return 'Moderado'; // 5-7
  if (dias >= MORA_THRESHOLDS.PRECAUCION) return 'Precaución'; // 3-4
  if (dias >= MORA_THRESHOLDS.LEVE) return 'Leve'; // 1-2
  return 'Mínimo'; // 0 días → siempre verde, estado base
}

/** Emoji de alerta según etiqueta */
function emojiMora(etiqueta: string): string {
  switch (etiqueta) {
    case 'Crítico':
      return '🔴';
    case 'Moderado':
      return '🟠';
    case 'Precaución':
      return '🟡';
    case 'Leve':
      return '🟢';
    default:
      return '✅';
  }
}

/** Nivel de riesgo del schema Prisma (VERDE / AMARILLO / ROJO) según días en mora */
function nivelRiesgoPorDias(dias: number): 'VERDE' | 'AMARILLO' | 'ROJO' {
  if (dias >= MORA_THRESHOLDS.CRITICO) return 'ROJO'; // 8+
  if (dias >= MORA_THRESHOLDS.PRECAUCION) return 'AMARILLO'; // 3-7
  return 'VERDE'; // 0-2 → Mínimo / Leve, siguen en verde
}

/**
 * Determina el "nivel mora interno" (1-5) para detectar cambios de sub-nivel
 * aunque el nivelRiesgo del schema sea el mismo (ej: Precaución y Moderado son AMARILLO).
 */
function nivelMoraNumerico(dias: number): number {
  if (dias >= MORA_THRESHOLDS.CRITICO) return 5; // Crítico
  if (dias >= MORA_THRESHOLDS.MODERADO) return 4; // Moderado
  if (dias >= MORA_THRESHOLDS.PRECAUCION) return 3; // Precaución
  if (dias >= MORA_THRESHOLDS.LEVE) return 2; // Leve
  return 1; // Mínimo
}

function buildBogotaNoon(key: string): Date {
  return new Date(`${key}T12:00:00-05:00`);
}

function shiftBogotaKey(key: string, days: number): string {
  const shifted = new Date(buildBogotaNoon(key).getTime() + days * 86_400_000);
  return getBogotaDayKey(shifted);
}

/**
 * Días de atraso de una cuota, contados como los cuenta la operación.
 *
 *  - Frecuencia DIARIO: se cuentan días hábiles de ruta, SIN domingos. El
 *    domingo no hay jornada, así que un cliente diario no puede atrasarse ese
 *    día; contarlo lo haría subir de nivel por un cobro que nadie salió a hacer.
 *  - Resto de frecuencias: días calendario.
 *
 * Se compara por clave de día de Bogotá y se ancla cada día al mediodía
 * (`buildBogotaNoon`): así la resta de fechas nunca cae en el borde de
 * medianoche, donde el desfase con UTC cambiaría el día.
 *
 * Devuelve 0 si la cuota vence hoy o después.
 */
export function calcularDiasMoraOperativos(
  fechaVencimiento: Date,
  hoy: Date,
  frecuenciaPago?: string | null,
): number {
  const vencimientoKey = getBogotaDayKey(fechaVencimiento);
  const hoyKey = getBogotaDayKey(hoy);
  if (!vencimientoKey || !hoyKey || vencimientoKey >= hoyKey) return 0;

  if (String(frecuenciaPago || '').toUpperCase() !== 'DIARIO') {
    const vencimiento = buildBogotaNoon(vencimientoKey);
    const actual = buildBogotaNoon(hoyKey);
    return Math.max(
      0,
      Math.floor((actual.getTime() - vencimiento.getTime()) / 86_400_000),
    );
  }

  let dias = 0;
  let cursorKey = shiftBogotaKey(vencimientoKey, 1);
  while (cursorKey && cursorKey <= hoyKey) {
    if (getBogotaWeekday(buildBogotaNoon(cursorKey)) !== 0) {
      dias++;
    }
    cursorKey = shiftBogotaKey(cursorKey, 1);
  }

  return dias;
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

type MoraDbClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class MoraService implements OnModuleInit {
  private readonly logger = new Logger(MoraService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacionesService: NotificacionesService,
    private readonly notificacionesGateway: NotificacionesGateway,
    private readonly pushService: PushService,
  ) {}

  async recalcularNivelRiesgoCliente(
    clienteId: string,
    db: MoraDbClient = this.prisma,
  ): Promise<{
    clienteId: string;
    diasEnMora: number;
    nivelRiesgo: 'VERDE' | 'AMARILLO' | 'ROJO';
    actualizado: boolean;
  } | null> {
    const hoy = new Date();

    const cliente = await db.cliente.findUnique({
      where: { id: clienteId },
      select: {
        id: true,
        nivelRiesgo: true,
        nivelMoraNotificado: true,
        enListaNegra: true,
        prestamos: {
          where: {
            estado: { in: ['ACTIVO', 'EN_MORA'] },
            eliminadoEn: null,
          },
          select: {
            frecuenciaPago: true,
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

    if (!cliente || cliente.enListaNegra) return null;

    let diasMoraMax = 0;
    for (const prestamo of cliente.prestamos) {
      const cuota = prestamo.cuotas[0];
      if (!cuota) continue;

      const dias = calcularDiasMoraOperativos(
        new Date(cuota.fechaVencimiento),
        hoy,
        prestamo.frecuenciaPago,
      );
      if (dias > diasMoraMax) diasMoraMax = dias;
    }

    const nuevoNivel =
      diasMoraMax > 0 ? nivelRiesgoPorDias(diasMoraMax) : 'VERDE';

    const cambioRiesgo = cliente.nivelRiesgo !== nuevoNivel;

    // Esto corre despues de un pago, donde el nivel de mora solo puede bajar.
    // Se guarda SOLO la bajada: si se guardara una subida, el proceso de mora
    // la tomaria como ya conocida y nunca la notificaria. Un NULL se deja
    // intacto para que el proceso de mora lo siembre.
    const nuevoNivelMora = nivelMoraNumerico(diasMoraMax);
    const bajoNivelMora =
      cliente.nivelMoraNotificado != null &&
      nuevoNivelMora < cliente.nivelMoraNotificado;

    if (cambioRiesgo || bajoNivelMora) {
      await db.cliente.update({
        where: { id: cliente.id },
        data: {
          ...(cambioRiesgo
            ? { nivelRiesgo: nuevoNivel, ultimaActualizacionRiesgo: new Date() }
            : {}),
          ...(bajoNivelMora ? { nivelMoraNotificado: nuevoNivelMora } : {}),
        },
      });
    }

    return {
      clienteId: cliente.id,
      diasEnMora: diasMoraMax,
      nivelRiesgo: nuevoNivel,
      actualizado: cliente.nivelRiesgo !== nuevoNivel,
    };
  }

  /**
   * En produccion corre el proceso de mora al arrancar, ademas de la corrida
   * diaria (`procesarMoraDiaria`). Fuera de produccion no corre, para no
   * notificar desde entornos de desarrollo.
   *
   * Arrancar ya no vuelve a notificar a todos: el ultimo nivel de cada cliente
   * esta guardado en `Cliente.nivelMoraNotificado`.
   */
  async onModuleInit() {
    if (process.env.NODE_ENV !== 'production') return;
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
      this.logger.error(`❌ [MORA] Error al arranque: ${mensajeDeError(err)}`);
    }
  }

  /**
   * Corrida diaria del proceso de mora a las 6:00 a. m. de Bogota, antes de que
   * salgan las rutas.
   *
   * Sin esta corrida el nivel de riesgo y las notificaciones solo se
   * actualizaban cuando el servidor se reiniciaba. La zona horaria va
   * explicita: el repo no fija TZ y un cron sin `timeZone` usa el reloj del
   * proceso, que en un servidor UTC seria otra hora.
   */
  @Cron('0 6 * * *', { name: 'mora-diaria', timeZone: 'America/Bogota' })
  async procesarMoraDiaria() {
    if (process.env.NODE_ENV !== 'production') return;
    try {
      const result = await this.procesarMoraAutomatica();
      this.logger.log(
        `[MORA] Corrida diaria: ${result.cuotasVencidas} cuotas vencidas, ` +
          `${result.notificacionesEnviadas} notificaciones enviadas`,
      );
    } catch (err) {
      this.logger.error(
        `[MORA] Error en la corrida diaria: ${mensajeDeError(err)}`,
      );
    }
  }

  /**
   * Proceso principal de mora.
   * Se ejecuta al arrancar el servidor (produccion), todos los dias a las 6:00
   * a. m. de Bogota (`procesarMoraDiaria`) y manualmente via endpoint.
   *
   * Pasos:
   * 1. Marcar cuotas PENDIENTE/PARCIAL vencidas como VENCIDA
   * 2. Préstamos ACTIVOS con cuotas VENCIDAS → EN_MORA
   * 3. Préstamos EN_MORA sin cuotas VENCIDAS → ACTIVO (ya pagaron)
   * 4. Actualizar nivelRiesgo del cliente + enviar notificaciones al cambiar de nivel
   * 5. Broadcast WebSocket para refrescar el frontend
   */
  async procesarMoraAutomatica(): Promise<ResultadoProcesarMora> {
    const hoyKeyBogota = getBogotaDayKey(new Date());
    const hoy = hoyKeyBogota
      ? new Date(`${hoyKeyBogota}T00:00:00.000Z`)
      : new Date();

    const resultado: ResultadoProcesarMora = {
      cuotasVencidas: 0,
      prestamosEnMoraActualizados: 0,
      prestamosActivosRecuperados: 0,
      clientesRiesgoActualizado: 0,
      notificacionesEnviadas: 0,
      errores: [],
      procesadoEn: formatBogotaOffsetIso(new Date()),
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
      resultado.errores.push(`Paso 1: ${mensajeDeError(err)}`);
      this.logger.error('[MORA] Error en Paso 1:', mensajeDeError(err));
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
          resultado.errores.push(
            `Préstamo ${prest.numeroPrestamo} → EN_MORA: ${mensajeDeError(err)}`,
          );
        }
      }
      this.logger.log(
        `[MORA] Paso 2: ${resultado.prestamosEnMoraActualizados} préstamos → EN_MORA`,
      );
    } catch (err) {
      resultado.errores.push(`Paso 2: ${mensajeDeError(err)}`);
      this.logger.error('[MORA] Error en Paso 2:', mensajeDeError(err));
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
          resultado.errores.push(
            `Préstamo ${prest.numeroPrestamo} → ACTIVO: ${mensajeDeError(err)}`,
          );
        }
      }
      this.logger.log(
        `[MORA] Paso 3: ${resultado.prestamosActivosRecuperados} préstamos recuperados → ACTIVO`,
      );
    } catch (err) {
      resultado.errores.push(`Paso 3: ${mensajeDeError(err)}`);
      this.logger.error('[MORA] Error en Paso 3:', mensajeDeError(err));
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
          nivelMoraNotificado: true,
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
              frecuenciaPago: true,
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
              const dias = calcularDiasMoraOperativos(
                new Date(cuota.fechaVencimiento),
                hoy,
                prestamo.frecuenciaPago,
              );
              if (dias > diasMoraMax) diasMoraMax = dias;
            }
          }

          const nuevoNivelPrisma =
            diasMoraMax > 0 ? nivelRiesgoPorDias(diasMoraMax) : 'VERDE';

          const nuevaEtiqueta = etiquetaMora(diasMoraMax);
          const nuevoNivelNumerico = nivelMoraNumerico(diasMoraMax);
          // Ultimo nivel guardado en la base (antes era un Map en memoria que se
          // vaciaba en cada reinicio y hacia notificar a todos otra vez).
          // NULL = cliente anterior a la columna: se siembra sin notificar.
          const nivelNumericoAnterior = cliente.nivelMoraNotificado;

          // Detectar si el cliente subió de nivel de mora (o acaba de entrar a mora)
          const subioDeNivel =
            nivelNumericoAnterior != null &&
            nuevoNivelNumerico > nivelNumericoAnterior &&
            diasMoraMax > 0;
          const esNuevoEnMora =
            nivelNumericoAnterior === 1 && nuevoNivelNumerico > 1;

          const cambioRiesgo = cliente.nivelRiesgo !== nuevoNivelPrisma;
          // El nivel de mora se guarda tambien cuando BAJA: asi una recaida
          // posterior vuelve a notificarse.
          const cambioNivelMora = nivelNumericoAnterior !== nuevoNivelNumerico;

          if (cambioRiesgo || cambioNivelMora) {
            await this.prisma.cliente.update({
              where: { id: cliente.id },
              data: {
                ...(cambioRiesgo
                  ? {
                      nivelRiesgo: nuevoNivelPrisma,
                      ultimaActualizacionRiesgo: new Date(),
                    }
                  : {}),
                ...(cambioNivelMora
                  ? { nivelMoraNotificado: nuevoNivelNumerico }
                  : {}),
              },
            });
            if (cambioRiesgo) resultado.clientesRiesgoActualizado++;
          }

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
              (ruta
                ? ` Ruta: ${ruta.nombre} (${ruta.zona}).`
                : ' Sin ruta asignada.') +
              (cobrador
                ? ` Cobrador: ${cobrador.nombres} ${cobrador.apellidos}.`
                : '');

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
              cobradorNombre: cobrador
                ? `${cobrador.nombres} ${cobrador.apellidos}`
                : null,
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
              this.logger.warn(
                `[MORA] Error notif interna cliente ${cliente.id}: ${mensajeDeError(err)}`,
              );
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
                this.logger.warn(
                  `[MORA] Error notif cobrador ${cobrador.id}: ${mensajeDeError(err)}`,
                );
              }
            }

            // 3. Push notification a admins/coordinadores
            try {
              await this.pushService.sendPushNotification({
                title: tituloNotif,
                body: mensajeNotif,
                roleFilter: [
                  'ADMIN',
                  'SUPER_ADMINISTRADOR',
                  'COORDINADOR',
                  'SUPERVISOR',
                ],
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
              this.logger.warn(
                `[MORA] Error push admins: ${mensajeDeError(err)}`,
              );
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
                this.logger.warn(
                  `[MORA] Error push cobrador ${cobrador.id}: ${mensajeDeError(err)}`,
                );
              }
            }

            this.logger.log(
              `[MORA] 🔔 Notificado: ${nombreCliente} → ${nuevaEtiqueta} (${diasMoraMax} días)` +
                (ruta ? ` | Ruta: ${ruta.nombre}` : ''),
            );
          }
        } catch (err) {
          resultado.errores.push(
            `Cliente ${cliente.id}: ${mensajeDeError(err)}`,
          );
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

      // Clientes que ya no tienen prestamos activos ni en mora no pasan por el
      // ciclo de arriba. Su nivel de mora vuelve a 1 para que, si reciben un
      // credito nuevo y se atrasan, se les vuelva a notificar.
      await this.prisma.cliente.updateMany({
        where: {
          nivelMoraNotificado: { gt: 1 },
          prestamos: {
            none: {
              estado: { in: ['ACTIVO', 'EN_MORA'] },
              eliminadoEn: null,
            },
          },
        },
        data: { nivelMoraNotificado: 1 },
      });

      this.logger.log(
        `[MORA] Paso 4: ${resultado.clientesRiesgoActualizado} clientes riesgo actualizado, ` +
          `${resultado.notificacionesEnviadas} notificaciones enviadas`,
      );
    } catch (err) {
      resultado.errores.push(`Paso 4: ${mensajeDeError(err)}`);
      this.logger.error('[MORA] Error en Paso 4:', mensajeDeError(err));
    }

    // ─── PASO 5: Broadcast WebSocket ─────────────────────────────────────────
    try {
      this.notificacionesGateway.broadcastPrestamosActualizados({
        accion: 'MORA_PROCESADA',
      });
      this.notificacionesGateway.broadcastDashboardsActualizados({
        origen: 'MORA',
      });
    } catch (err) {
      this.logger.warn('[MORA] Error broadcast WS:', mensajeDeError(err));
    }

    return resultado;
  }

  /**
   * Devuelve a PENDIENTE las cuotas que se marcaron VENCIDA el mismo día en que
   * vencen, sin ningún abono.
   *
   * Una cuota que vence hoy todavía se puede cobrar hoy. Si un corte de fecha
   * mal calculado la marca vencida antes de tiempo, el cliente aparece en mora
   * sin estarlo. Después reactiva los préstamos EN_MORA que quedaron sin
   * cuotas vencidas.
   *
   * Con `dryRun` solo cuenta lo que repararía, sin escribir nada.
   */
  async repararFalsosVencidosHoy(params?: {
    prestamoId?: string;
    dryRun?: boolean;
  }): Promise<{
    dayKeyBogota: string;
    cuotasDetectadas: number;
    cuotasReparadas: number;
    prestamosReactivados: number;
  }> {
    const dryRun = params?.dryRun === true;

    const hoyKeyBogota = getBogotaDayKey(new Date());
    if (!hoyKeyBogota) {
      throw new Error('No se pudo calcular el dayKey de Bogotá');
    }

    const inicioHoyUTC = new Date(`${hoyKeyBogota}T00:00:00.000Z`);
    const inicioMananaUTC = new Date(inicioHoyUTC.getTime() + 86_400_000);

    // Se considera "falso vencido": cuota marcada VENCIDA el mismo día calendario (Bogotá)
    // con montoPagado=0 (no hay abonos) → típicamente por corte de fecha.
    const whereCuotas: any = {
      estado: 'VENCIDA',
      montoPagado: 0,
      fechaVencimiento: {
        gte: inicioHoyUTC,
        lt: inicioMananaUTC,
      },
      prestamo: {
        eliminadoEn: null,
      },
    };
    if (params?.prestamoId) whereCuotas.prestamoId = params.prestamoId;

    const cuotasDetectadas = await this.prisma.cuota.count({
      where: whereCuotas,
    });
    let cuotasReparadas = 0;
    if (!dryRun && cuotasDetectadas > 0) {
      const upd = await this.prisma.cuota.updateMany({
        where: whereCuotas,
        data: { estado: 'PENDIENTE' },
      });
      cuotasReparadas = upd.count;
    }

    let prestamosReactivados = 0;
    if (!dryRun) {
      const prestamosEnMora = await this.prisma.prestamo.findMany({
        where: {
          ...(params?.prestamoId ? { id: params.prestamoId } : {}),
          estado: 'EN_MORA',
          eliminadoEn: null,
          cuotas: { none: { estado: 'VENCIDA' } },
          saldoPendiente: { gt: 0 },
        },
        select: { id: true },
      });

      if (prestamosEnMora.length > 0) {
        await this.prisma.prestamo.updateMany({
          where: { id: { in: prestamosEnMora.map((p) => p.id) } },
          data: { estado: 'ACTIVO' },
        });
        prestamosReactivados = prestamosEnMora.length;
      }
    }

    this.logger.log(
      `[MORA][REPAIR] day=${hoyKeyBogota} dryRun=${dryRun} cuotasDetectadas=${cuotasDetectadas} cuotasReparadas=${cuotasReparadas} prestamosReactivados=${prestamosReactivados}`,
    );

    return {
      dayKeyBogota: hoyKeyBogota,
      cuotasDetectadas,
      cuotasReparadas,
      prestamosReactivados,
    };
  }

  /**
   * Calcula el resumen de mora de un cliente específico
   * (días en mora, nivel, etiqueta) sin modificar nada en DB.
   */
  async getResumenMoraCliente(clienteId: string) {
    const { startDate: hoy } = getBogotaStartEndOfDay(new Date());

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
            frecuenciaPago: true,
            cuotas: {
              where: { estado: 'VENCIDA' },
              orderBy: { fechaVencimiento: 'asc' },
              select: {
                fechaVencimiento: true,
                monto: true,
                montoPagado: true,
              },
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
        const dias = calcularDiasMoraOperativos(
          new Date(c.fechaVencimiento),
          hoy,
          p.frecuenciaPago,
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
