import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { CreateSyncConflictDto } from './dto/create-sync-conflict.dto';
import { UpdateSyncConflictDto } from './dto/update-sync-conflict.dto';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SyncConflictsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async create(createSyncConflictDto: CreateSyncConflictDto, userId?: string) {
    return this.prisma.syncConflict.create({
      data: {
        ...createSyncConflictDto,
        creadoPorId: userId,
      },
    });
  }

  async findAll(user: any) {
    let whereClause = {};

    if (user.rol === 'COORDINADOR') {
      // Find all routes supervised by this user
      const rutas = await this.prisma.ruta.findMany({
        where: { supervisorId: user.id },
        select: { cobradorId: true },
      });
      const cobradorIds = rutas.map(r => r.cobradorId);
      
      // If no routes assigned, they can't see anything unless they are the creators
      if (cobradorIds.length === 0) {
        whereClause = { creadoPorId: user.id };
      } else {
        whereClause = {
          creadoPorId: { in: [...cobradorIds, user.id] },
        };
      }
    }

    return this.prisma.syncConflict.findMany({
      where: whereClause,
      orderBy: { creadoEn: 'desc' },
      include: {
        creadoPor: {
          select: { id: true, nombres: true, apellidos: true, correo: true },
        },
      },
    });
  }

  async findOne(id: string, user: any) {
    const conflict = await this.prisma.syncConflict.findUnique({
      where: { id },
      include: {
        creadoPor: {
          select: { id: true, nombres: true, apellidos: true },
        },
        resueltoPor: {
          select: { id: true, nombres: true, apellidos: true },
        },
      },
    });

    if (!conflict) throw new BadRequestException('Conflicto no encontrado');

    if (user.rol === 'COORDINADOR') {
      const rutas = await this.prisma.ruta.findMany({
        where: { supervisorId: user.id },
        select: { cobradorId: true },
      });
      const cobradorIds = rutas.map(r => r.cobradorId);
      if (conflict.creadoPorId !== user.id && (!conflict.creadoPorId || !cobradorIds.includes(conflict.creadoPorId))) {
        throw new UnauthorizedException('No tienes permisos para ver este conflicto');
      }
    }

    return conflict;
  }

  async resolveConflict(id: string, accion: string, userId: string, token: string) {
    const conflict = await this.prisma.syncConflict.findUnique({ where: { id } });
    if (!conflict) throw new BadRequestException('Conflicto no encontrado');
    if (conflict.estadoResolucion !== 'PENDIENTE') throw new BadRequestException('El conflicto ya fue resuelto');

    let success = false;
    let extraError = null;

    if (accion === 'RESOLVER') {
      // Intentar reprocesar
      try {
        let endpoint = conflict.endpoint;
        // Make sure it starts with a slash
        if (!endpoint.startsWith('/')) endpoint = '/' + endpoint;
        
        // Remove /api/v1 if present in endpoint to build internal logic nicely, or just append to PORT
        // We will make a raw HTTP request back to ourselves
        const baseUrl = this.configService.get<string>('API_URL') || 'http://localhost:3000/api/v1';
        
        const fullUrl = `${baseUrl}${endpoint.replace('/api/v1', '')}`;

        const res = await fetch(fullUrl, {
          method: conflict.operacion,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token, // Reprocesamos en nombre de quien hace click, o forzamos permisos
          },
          body: JSON.stringify(conflict.datos),
        });

        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Error ${res.status}: ${body}`);
        }

        success = true;
      } catch (err: any) {
        extraError = err.message || 'Fallo automatizado';
      }
    } else {
      success = true; // Descartado siempre es éxito en la operación lógica
    }

    if (accion === 'RESOLVER' && !success) {
      throw new BadRequestException(`No se pudo reprocesar automáticamente: ${extraError}`);
    }

    return this.prisma.syncConflict.update({
      where: { id },
      data: {
        estadoResolucion: accion === 'RESOLVER' ? 'RESUELTO' : 'DESCARTADO',
        resueltoPorId: userId,
      },
    });
  }

  async remove(id: string) {
    return this.prisma.syncConflict.delete({
      where: { id },
    });
  }
}
