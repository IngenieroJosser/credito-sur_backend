import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConfiguracionService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfiguracion() {
    let config = await this.prisma.configuracionSistema.findUnique({
      where: { id: 'default' },
    });

    if (!config) {
      config = await this.prisma.configuracionSistema.create({
        data: {
          id: 'default',
          autoAprobarClientes: false,
          autoAprobarCreditos: false,
        },
      });
    }

    return config;
  }

  async updateConfiguracion(
    data: {
      autoAprobarClientes?: boolean;
      autoAprobarCreditos?: boolean;
    },
    userId?: string
  ) {
    await this.getConfiguracion();

    return this.prisma.configuracionSistema.update({
      where: { id: 'default' },
      data: {
        ...data,
        actualizadoPorId: userId,
      },
    });
  }

  async shouldAutoApproveClients(): Promise<boolean> {
    const config = await this.getConfiguracion();
    return config.autoAprobarClientes || false;
  }

  async shouldAutoApproveCredits(): Promise<boolean> {
    const config = await this.getConfiguracion();
    return config.autoAprobarCreditos || false;
  }
}
