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

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  [key: string]: any;

  constructor(private eventEmitter: EventEmitter2) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    const adapter = new PrismaPg(pool);
    const basePrisma = new PrismaClient({ adapter });

    // Envolver PrismaClient para interceptar TODAS las escrituras de DB y disparar eventos
    const prisma = basePrisma.$extends({
      query: {
        $allModels: {
          async $allOperations({ operation, model, args, query }) {
            const isCajaBalanceMutation =
              model === 'Caja' &&
              ['update', 'updateMany', 'upsert'].includes(operation as string) &&
              (args as any)?.data &&
              Object.prototype.hasOwnProperty.call((args as any).data, 'saldoActual');

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

            if (watchActions.includes(operation as string) && model) {
              if (model !== 'OutboxEvent') {
                const aggregateId =
                  (result as any)?.id ||
                  (Array.isArray(result)
                    ? undefined
                    : (args as any)?.where?.id) ||
                  undefined;

                (basePrisma as any).outboxEvent
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

    // Devolvemos un Proxy para que NestJS pueda inyectar PrismaService
    // y redirija cualquier llamada (this.prisma.user.findMany) al cliente extendido.
    return new Proxy(this, {
      get: (target, prop) => {
        if (prop in target) return target[prop as string];
        return (prisma as any)[prop];
      },
    });
  }

  async onModuleInit() {
    await (this as any).$connect();
  }

  async onModuleDestroy() {
    await (this as any).$disconnect();
  }
}
