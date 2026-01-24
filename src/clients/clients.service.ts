import { Injectable } from '@nestjs/common';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createClientDto: CreateClientDto) {
    // Generar código único (simple por ahora)
    const count = await this.prisma.cliente.count();
    const codigo = `C-${(count + 1).toString().padStart(4, '0')}`;

    // Buscar un usuario para asignar como creador (TODO: Usar usuario autenticado)
    const creador = await this.prisma.usuario.findFirst();
    if (!creador) {
      throw new Error('No existen usuarios en el sistema para asignar la creación');
    }

    // Extraer campos que no están en el modelo Cliente o necesitan mapeo
    const { rutaId, observaciones, ...clientData } = createClientDto;

    return this.prisma.cliente.create({
      data: {
        ...clientData,
        codigo,
        creadoPorId: creador.id,
        // TODO: Manejar asignación de ruta y observaciones si es necesario en otras tablas
      },
    });
  }

  findAll() {
    return this.prisma.cliente.findMany({
      where: { eliminadoEn: null },
      orderBy: { creadoEn: 'desc' },
    });
  }

  findOne(id: string) {
    return this.prisma.cliente.findUnique({
      where: { id },
      include: {
        prestamos: true,
        pagos: true,
      }
    });
  }

  update(id: string, updateClientDto: UpdateClientDto) {
    const { rutaId, observaciones, ...clientData } = updateClientDto;
    return this.prisma.cliente.update({
      where: { id },
      data: clientData,
    });
  }

  remove(id: string) {
    return this.prisma.cliente.update({
      where: { id },
      data: { eliminadoEn: new Date() },
    });
  }
}
