import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Processor('mirror-sync-queue')
export class MirrorSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(MirrorSyncProcessor.name);

  constructor(private configService: ConfigService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { model, action, data } = job.data;
    
    // El servidor maestro enviará una petición al Espejo (VPS)
    const mirrorUrl = this.configService.get<string>('MIRROR_VPS_URL');
    const mirrorToken = this.configService.get<string>('MIRROR_SYNC_TOKEN');

    if (!mirrorUrl || !mirrorToken) {
      // Ignoramos grácilmente la sincronización si las variables de entorno no están configuradas (EJ. Puesta en marcha o modo desarrollo 100% aislado)
      this.logger.debug('Sincronización abortada silente: Las variables MIRROR_VPS_URL o MIRROR_SYNC_TOKEN no han sido configuradas en el .env');
      return;
    }

    this.logger.log(`Procesando envío de sincronización espejo: ${model} [${action}] (Intento actual: ${job.attemptsMade})`);

    // Endpoint universal en el VPS que recibirá en masa cualquier modelo para actualizar su DB Prisma 
    // Usamos enrutamiento interno NestJS (Prefijo API y versión v1)
    let baseUrl = mirrorUrl;
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
    
    const endpointRegex = `${baseUrl}/api/v1/mirror-sync/receiver/${model}/${action}`;
    
    try {
      const response = await fetch(endpointRegex, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mirrorToken}`,
          'X-Mirror-Sync-Engine': 'BullMQ-Engine-v1', // Firma de seguridad
        },
        // Enviamos el Row crudo como payload a insertar o actualizar en la tabla espejo
        body: JSON.stringify({ payload: data }), 
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Mirror VPS rechazó el payload con status Code HTTP ${response.status} - Motivo: ${errText}`);
      }

      this.logger.log(`Sincronización ultra-rápida exitosa contra el espejo: Modelo ${model}`);
    } catch (error: any) {
      this.logger.warn(`Desconexión o fallo al insertar en el VPS para modelo ${model}: ${error.message} - El sistema reintentará con Backoff Exponencial en background.`);
      // Relanza la excepción: Causa que BullMQ capture la falla, marque el Job rojo, y programe el retry automático en horas según la ecuación de tiempo.
      throw new Error(`Fallo transmisión Mirror Sync: ${error.message}`); 
    }
  }
}
