import {
  BadRequestException,
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { EventEmitter2 } from '@nestjs/event-emitter';

function crearClienteExtendido(eventEmitter: EventEmitter2) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const adapter = new PrismaPg(pool);
  const basePrisma = new PrismaClient({ adapter });

  // Envolver PrismaClient para interceptar TODAS las escrituras de DB y disparar eventos
  return basePrisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ operation, model, args, query }) {
          const isCajaBalanceMutation =
            model === 'Caja' &&
            ['update', 'updateMany', 'upsert'].includes(operation) &&
            (args as any)?.data &&
            Object.prototype.hasOwnProperty.call(
              (args as any).data,
              'saldoActual',
            );

          if (isCajaBalanceMutation) {
            const saldoActual = (args as any).data.saldoActual;
            const esDeltaLedger =
              saldoActual &&
              typeof saldoActual === 'object' &&
              (Object.prototype.hasOwnProperty.call(saldoActual, 'increment') ||
                Object.prototype.hasOwnProperty.call(saldoActual, 'decrement'));

            if (!esDeltaLedger) {
              throw new BadRequestException(
                'Caja.saldoActual no se puede sobrescribir directamente. Use movimientos/asientos contables para ajustar la caja.',
              );
            }
          }

          const result = await query(args);
          const watchActions = [
            'create',
            'update',
            'delete',
            'upsert',
            'createMany',
            'updateMany',
            'deleteMany',
          ];

          if (watchActions.includes(operation) && model) {
            if (model !== 'OutboxEvent') {
              // Solo sirve un id suelto. En deleteMany/updateMany el
              // `where.id` suele ser un objeto ({ in: [...] }, { not: x })
              // y Prisma rechazaba el create entero: cada borrado masivo
              // dejaba un "[OUTBOX] Error creando evento" en el registro
              // y se perdia el evento.
              const idDelResultado = (result as any)?.id;
              const idDelWhere = Array.isArray(result)
                ? undefined
                : (args as any)?.where?.id;

              const aggregateId =
                typeof idDelResultado === 'string'
                  ? idDelResultado
                  : typeof idDelWhere === 'string'
                    ? idDelWhere
                    : undefined;

              basePrisma.outboxEvent
                ?.create({
                  data: {
                    eventType: `${model}.${operation}`,
                    aggregateType: model,
                    aggregateId,
                    payload: {
                      model,
                      action: operation,
                      data: result,
                    },
                  },
                })
                .catch((error: Error) => {
                  console.error(
                    '[OUTBOX] Error creando evento:',
                    error.message,
                  );
                });
            }

            // Lanzar evento asíncrono para BullMQ
            if (process.env.IS_MIRROR_VPS !== 'true') {
              eventEmitter.emit('database.write.success', {
                model,
                action: operation,
                data: result,
              });
            }

            //Tiempo real universal: cuando se CREA cualquier Aprobacion,
            // emitir evento para que el Gateway lo transmita via WebSocket.
            // Cubre TODO tipo de revisión: préstamos nuevos, reprogramaciones,
            // prórrogas, cuentas vencidas, solicitudes contables, etc.
            if (model === 'Aprobacion') {
              if (operation === 'create' || operation === 'createMany') {
                eventEmitter.emit('aprobacion.created', { data: result });
              }
              if (
                operation === 'update' ||
                operation === 'updateMany' ||
                operation === 'upsert' ||
                operation === 'delete' ||
                operation === 'deleteMany'
              ) {
                eventEmitter.emit('aprobacion.updated', { data: result });
              }
            }
          }

          return result;
        },
      },
    },
  });
}

type ClienteExtendido = ReturnType<typeof crearClienteExtendido>;

/**
 * El cliente que se recibe DENTRO de una transacción.
 *
 * No sirve `Prisma.TransactionClient`: ese es el tipo del cliente sin extender, y
 * el nuestro lleva la extensión que intercepta las escrituras. Al firmar los
 * métodos con el tipo equivocado, TypeScript no podía casar el callback de
 * `$transaction` y se quedaba con la sobrecarga que recibe un array, cuyo
 * resultado es `any[]`: de ahí salía, en cascada, buena parte del `any` de los
 * servicios que escriben en transacción.
 */
export type TransaccionPrisma = Omit<
  ClienteExtendido,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/**
 * La clase y la interfaz de abajo se fusionan a proposito.
 *
 * `no-unsafe-declaration-merging` avisa de esto porque, en general, fusionar una
 * clase con una interfaz promete metodos que el prototipo no tiene. Aqui es
 * justo lo que hace falta y es seguro: el constructor devuelve un Proxy que
 * reenvia al cliente extendido cualquier propiedad que la clase no tenga, asi
 * que en ejecucion todo lo que la interfaz declara existe de verdad.
 *
 * La alternativa era el `[key: string]: any` que habia antes, que hacia que TODO
 * acceso al cliente devolviera `any`: el resultado de cada consulta, el `tx` de
 * cada transaccion y, en cascada, los parametros de cada `.map()` colgado de
 * ellos. Eran 305 de los 365 avisos de `noImplicitAny` del backend.
 */
@Injectable()
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  constructor(private eventEmitter: EventEmitter2) {
    const prisma = crearClienteExtendido(eventEmitter);

    // Devolvemos un Proxy para que NestJS pueda inyectar PrismaService
    // y redirija cualquier llamada (this.prisma.user.findMany) al cliente extendido.
    return new Proxy(this, {
      get: (target, prop) => {
        if (prop in target)
          return (target as Record<string, unknown>)[prop as string];
        return (prisma as Record<string, unknown>)[prop as string];
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

/* eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging,
   @typescript-eslint/no-empty-object-type -- la fusion es intencionada, ver
   arriba; y la interfaz esta vacia a proposito: solo existe para darle a la
   clase el tipo del cliente extendido. */
export interface PrismaService extends ClienteExtendido {}
