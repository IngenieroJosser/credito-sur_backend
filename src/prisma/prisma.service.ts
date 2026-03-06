import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
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
            const result = await query(args);
            const watchActions = ['create', 'update', 'delete', 'upsert', 'createMany', 'updateMany', 'deleteMany'];
            
            if (watchActions.includes(operation as string) && model) {
              // Lanzar evento asíncrono para BullMQ 
              eventEmitter.emit('database.write.success', {
                model,
                action: operation,
                data: result,
              });
            }
            
            return result;
          }
        }
      }
    });

    // Devolvemos un Proxy para que NestJS pueda inyectar PrismaService 
    // y redirija cualquier llamada (this.prisma.user.findMany) al cliente extendido.
    return new Proxy(this, {
      get: (target, prop) => {
        if (prop in target) return target[prop as string];
        return (prisma as any)[prop];
      }
    });
  }

  async onModuleInit() {
    await (this as any).$connect();
  }

  async onModuleDestroy() {
    await (this as any).$disconnect();
  }
}
