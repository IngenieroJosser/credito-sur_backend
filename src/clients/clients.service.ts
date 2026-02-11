import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { PrismaService } from 'prisma/prisma.service';
import { NivelRiesgo, RolUsuario } from '@prisma/client';

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(createClientDto: CreateClientDto) {
    // Generar código único (simple por ahora)
    const count = await this.prisma.cliente.count();
    const codigo = `C-${(count + 1).toString().padStart(4, '0')}`;

    // Buscar un usuario para asignar como creador (TODO: Usar usuario autenticado)
    const creador = await this.prisma.usuario.findFirst();
    if (!creador) {
      throw new Error(
        'No existen usuarios en el sistema para asignar la creación',
      );
    }

    // Extraer campos que no están en el modelo Cliente o necesitan mapeo
    const { rutaId, observaciones, archivos, ...clientData } = createClientDto;

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
      },
    });
  }

  update(id: string, updateClientDto: UpdateClientDto) {
    const { rutaId, observaciones, archivos, ...clientData } = updateClientDto;
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

  async getAllClients(filters: {
    nivelRiesgo?: string;
    ruta?: string;
    search?: string;
  }) {
    try {
      this.logger.log(
        `Getting clients with filters: ${JSON.stringify(filters)}`,
      );

      const { nivelRiesgo = 'all', ruta = '', search = '' } = filters;

      // Construir filtros de forma segura
      const where: any = {
        eliminadoEn: null, // Solo clientes no eliminados
      };

      // Filtro por nivel de riesgo
      if (nivelRiesgo !== 'all') {
        const nivelesValidos = Object.values(NivelRiesgo);
        if (nivelesValidos.includes(nivelRiesgo as NivelRiesgo)) {
          where.nivelRiesgo = nivelRiesgo;
        } else {
          this.logger.warn(`Nivel de riesgo inválido recibido: ${nivelRiesgo}`);
        }
      }

      // Filtro por ruta
      if (ruta && ruta !== '') {
        where.asignacionesRuta = {
          some: {
            rutaId: ruta,
            activa: true,
          },
        };
      }

      // Filtro por búsqueda
      if (search && search.trim() !== '') {
        const searchTerm = search.trim();
        where.OR = [
          {
            dni: {
              contains: searchTerm,
              mode: 'insensitive' as any,
            },
          },
          {
            nombres: {
              contains: searchTerm,
              mode: 'insensitive' as any,
            },
          },
          {
            apellidos: {
              contains: searchTerm,
              mode: 'insensitive' as any,
            },
          },
          {
            telefono: {
              contains: searchTerm,
              mode: 'insensitive' as any,
            },
          },
          {
            codigo: {
              contains: searchTerm,
              mode: 'insensitive' as any,
            },
          },
        ];
      }

      this.logger.log(`Query where clause: ${JSON.stringify(where)}`);

      // Obtener clientes con relaciones necesarias
      const clientesRaw = await this.prisma.cliente.findMany({
        where,
        include: {
          asignacionesRuta: {
            where: { activa: true },
            include: {
              ruta: {
                select: {
                  id: true,
                  nombre: true,
                  codigo: true,
                },
              },
            },
            take: 1,
          },
          prestamos: {
            where: { eliminadoEn: null },
            select: {
              id: true,
              estado: true,
              saldoPendiente: true,
            },
          },
          pagos: {
            select: {
              fechaPago: true,
            },
            orderBy: { fechaPago: 'desc' },
            take: 1,
          },
        },
        orderBy: { creadoEn: 'desc' },
      });

      // Si no hay filtros específicos de rutas o riesgo, incluimos aprobaciones pendientes
      let aprobacionesPendientes: any[] = [];
      if (nivelRiesgo === 'all' && (ruta === '' || !ruta)) {
        const queryAprobaciones: any = {
          estado: 'PENDIENTE',
          tipoAprobacion: 'NUEVO_CLIENTE',
        };

        // Aplicar búsqueda a las aprobaciones también si existe
        if (search && search.trim() !== '') {
          const s = search.trim();
          queryAprobaciones.datosSolicitud = {
            contains: s,
          };
        }

        aprobacionesPendientes = await this.prisma.aprobacion.findMany({
          where: queryAprobaciones,
          include: { solicitadoPor: true },
          orderBy: { creadoEn: 'desc' },
        });
      }

      // Calcular estadísticas (Restaurado)
      const totalClientes = await this.prisma.cliente.count({
        where: { eliminadoEn: null },
      });

      const buenComportamiento = await this.prisma.cliente.count({
        where: {
          eliminadoEn: null,
          nivelRiesgo: 'VERDE',
          puntaje: { gte: 80 },
        },
      });

      const enRiesgo = await this.prisma.cliente.count({
        where: {
          eliminadoEn: null,
          OR: [{ nivelRiesgo: 'ROJO' }, { nivelRiesgo: 'LISTA_NEGRA' }],
        },
      });

      const promedioScore = await this.prisma.cliente.aggregate({
        where: { eliminadoEn: null },
        _avg: {
          puntaje: true,
        },
      });

      this.logger.log(
        `Found ${clientesRaw.length} active clients and ${aprobacionesPendientes.length} pending approvals`,
      );

      // Transformar clientes reales
      const clientesTransformados = clientesRaw.map((cliente) => {
        try {
          // Calcular score basado en múltiples factores
          let score = cliente.puntaje || 100;
          let tendencia: 'SUBE' | 'BAJA' | 'ESTABLE' = 'ESTABLE';

          // Ajustar score basado en préstamos
          const prestamosActivos = cliente.prestamos.filter(
            (p) => p.estado === 'ACTIVO',
          );
          const prestamosEnMora = cliente.prestamos.filter(
            (p) => p.estado === 'EN_MORA',
          );

          if (prestamosEnMora.length > 0) {
            score -= 20;
            tendencia = 'BAJA';
          } else if (prestamosActivos.length > 0) {
            score += 5;
            tendencia = 'SUBE';
          }

          // Ajustar basado en tiempo desde el último pago
          if (cliente.pagos && cliente.pagos.length > 0) {
            const ultimoPago = cliente.pagos[0].fechaPago;
            const diasDesdeUltimoPago = Math.floor(
              (Date.now() - new Date(ultimoPago).getTime()) /
                (1000 * 60 * 60 * 24),
            );

            if (diasDesdeUltimoPago > 30) {
              score -= 10;
            } else if (diasDesdeUltimoPago <= 7) {
              score += 5;
            }
          }

          // Limitar score entre 0 y 100
          score = Math.max(0, Math.min(100, score));

          // Obtener ruta asignada
          let rutaAsignada = '';
          let rutaNombre = '';

          if (cliente.asignacionesRuta && cliente.asignacionesRuta.length > 0) {
            const asignacion = cliente.asignacionesRuta[0];
            if (asignacion.ruta) {
              rutaAsignada = asignacion.ruta.id;
              rutaNombre = asignacion.ruta.nombre;
            }
          }

          // Obtener última visita (basado en último pago o última interacción)
          let ultimaVisita = 'Nunca';
          if (cliente.pagos && cliente.pagos.length > 0) {
            const fecha = new Date(cliente.pagos[0].fechaPago);
            ultimaVisita = fecha.toISOString().split('T')[0];
          }

          // Calcular deuda total y mora
          const montoTotal = cliente.prestamos.reduce(
            (sum, p) => sum + Number(p.saldoPendiente || 0),
            0,
          );
          const montoMora = cliente.prestamos
            .filter((p) => p.estado === 'EN_MORA')
            .reduce((sum, p) => sum + Number(p.saldoPendiente || 0), 0);

          return {
            id: cliente.id,
            codigo: cliente.codigo,
            dni: cliente.dni,
            nombres: cliente.nombres,
            apellidos: cliente.apellidos,
            telefono: cliente.telefono,
            correo: cliente.correo,
            direccion: cliente.direccion,
            referencia: cliente.referencia,
            nivelRiesgo: cliente.nivelRiesgo,
            puntaje: cliente.puntaje,
            enListaNegra: cliente.enListaNegra,
            estadoAprobacion: cliente.estadoAprobacion,
            score: Math.round(score),
            tendencia,
            ultimaVisita,
            rutaId: rutaAsignada,
            rutaNombre: rutaNombre,
            montoTotal,
            montoMora,
            prestamosActivos: prestamosActivos.length,
          };
        } catch (error) {
          this.logger.error(`Error transforming client ${cliente.id}:`, error);
          return {
            id: cliente.id,
            codigo: cliente.codigo || 'ERROR',
            dni: cliente.dni || '',
            nombres: cliente.nombres || 'Error',
            apellidos: cliente.apellidos || '',
            telefono: cliente.telefono || '',
            correo: cliente.correo || '',
            direccion: cliente.direccion || '',
            referencia: cliente.referencia || '',
            nivelRiesgo: cliente.nivelRiesgo || 'VERDE',
            puntaje: cliente.puntaje || 50,
            enListaNegra: cliente.enListaNegra || false,
            estadoAprobacion: cliente.estadoAprobacion || 'APROBADO',
            score: 50,
            tendencia: 'ESTABLE' as const,
            ultimaVisita: 'Nunca',
            rutaId: '',
            rutaNombre: '',
            montoTotal: 0,
            montoMora: 0,
            prestamosActivos: 0,
          };
        }
      });

      // Transformar aprobaciones pendientes
      const aprobacionesTransformadas = aprobacionesPendientes.map((aprob) => {
        const datos = JSON.parse(aprob.datosSolicitud as string);
        return {
          id: aprob.id,
          codigo: aprob.referenciaId || 'PENDIENTE',
          dni: datos.dni || '',
          nombres: datos.nombres || 'Pendiente',
          apellidos: datos.apellidos || '',
          telefono: datos.telefono || '',
          correo: datos.correo || '',
          direccion: datos.direccion || '',
          referencia: datos.referencia || '',
          nivelRiesgo: 'VERDE',
          puntaje: 100,
          enListaNegra: false,
          estadoAprobacion: aprob.estado,
          score: 100,
          tendencia: 'ESTABLE',
          ultimaVisita: 'Pendiente',
          rutaId: '',
          rutaNombre: 'Sin ruta',
          montoTotal: 0,
          montoMora: 0,
          prestamosActivos: 0,
          creadoEn: aprob.creadoEn,
        };
      });

      // Combinar y ordenar por fecha de creación descendente
      const todosLosClientes = [
        ...aprobacionesTransformadas,
        ...clientesTransformados,
      ].sort((a: any, b: any) => {
        const dateA = new Date(a.creadoEn || 0).getTime();
        const dateB = new Date(b.creadoEn || 0).getTime();
        return dateB - dateA;
      });

      return {
        clientes: todosLosClientes,
        estadisticas: {
          total: totalClientes || 0,
          buenComportamiento: buenComportamiento || 0,
          enRiesgo: enRiesgo || 0,
          scorePromedio: Number(promedioScore._avg?.puntaje?.toFixed(1) || 0),
        },
      };
    } catch (error) {
      this.logger.error('Error in getAllClients:', error);
      return {
        clientes: [],
        estadisticas: {
          total: 0,
          buenComportamiento: 0,
          enRiesgo: 0,
          scorePromedio: 0,
        },
      };
    }
  }

  async getClientById(id: string) {
    this.logger.log(`[DEBUG] getClientById called with ID: ${id}`);
    try {
      const cliente = await this.prisma.cliente.findUnique({
        where: {
          id,
          eliminadoEn: null,
        },
        include: {
          asignacionesRuta: {
            include: {
              ruta: true,
              cobrador: {
                select: {
                  id: true,
                  nombres: true,
                  apellidos: true,
                  telefono: true,
                },
              },
            },
          },
          prestamos: {
            where: { eliminadoEn: null },
            include: {
              producto: true,
              cuotas: true,
              pagos: {
                include: {
                  detalles: true,
                },
              },
            },
            orderBy: { creadoEn: 'desc' },
          },
          pagos: {
            include: {
              prestamo: true,
              cobrador: true,
            },
            orderBy: { fechaPago: 'desc' },
            take: 10,
          },
          creadoPor: {
            select: {
              id: true,
              nombres: true,
              apellidos: true,
              rol: true,
            },
          },
          aprobadoPor: {
            select: {
              id: true,
              nombres: true,
              apellidos: true,
              rol: true,
            },
          },
          archivos: {
            where: { estado: 'ACTIVO' },
          },
        },
      });

      if (!cliente) {
        this.logger.log(
          `[DEBUG] Cliente no encontrado en tabla principal, buscando en aprobaciones: ${id}`,
        );
        // Si no es un cliente aprobado, buscamos si es una solicitud pendiente
        const aprobacion = await this.prisma.aprobacion.findUnique({
          where: { id },
          include: { solicitadoPor: true },
        });

        if (aprobacion) {
          this.logger.log(
            `[DEBUG] Aprobación encontrada. Tipo: ${aprobacion.tipoAprobacion}, Estado: ${aprobacion.estado}`,
          );
          if (aprobacion.tipoAprobacion === 'NUEVO_CLIENTE') {
            const datos = JSON.parse(aprobacion.datosSolicitud as string);
            return {
              id: aprobacion.id,
              codigo: aprobacion.referenciaId || 'PENDIENTE',
              ...datos,
              estadoAprobacion: aprobacion.estado,
              creadoEn: aprobacion.creadoEn,
              creadoPor: aprobacion.solicitadoPor,
            };
          }
        } else {
          this.logger.warn(
            `[DEBUG] No se encontró la aprobación con ID: ${id}`,
          );
        }

        throw new NotFoundException('Cliente no encontrado');
      }

      return cliente;
    } catch (error) {
      this.logger.error(`Error getting client ${id}:`, error);
      throw error;
    }
  }

  async createClient(data: CreateClientDto) {
    this.logger.log(`[DEBUG] createClient llamado para documento: ${data.dni}`);
    try {
      // Validar si ya existe un cliente con ese documento
      const clienteExistente = await this.prisma.cliente.findFirst({
        where: { dni: data.dni, eliminadoEn: null },
      });

      if (clienteExistente) {
        throw new ConflictException(
          `Ya existe un cliente registrado con ese número de documento: ${data.dni}`,
        );
      }

      // Buscar un usuario para asignar como creador si no viene uno (TODO: Usar usuario autenticado)
      let solicitadoPorId = data.creadoPorId;
      if (!solicitadoPorId) {
        const creador = await this.prisma.usuario.findFirst();
        if (!creador) {
          throw new NotFoundException(
            'No existen usuarios en el sistema para asignar la creación',
          );
        }
        solicitadoPorId = creador.id;
      }

      const solicitante = await this.prisma.usuario.findUnique({
        where: { id: solicitadoPorId },
        select: { id: true, rol: true },
      });

      if (!solicitante) {
        throw new NotFoundException('Usuario solicitante no encontrado');
      }

      // Generar código único para el cliente
      const codigo = `CLI-${Date.now().toString().slice(-6)}`;

      // Si el creador es ADMIN o SUPER_ADMINISTRADOR -> crear cliente aprobado inmediatamente
      if (
        solicitante.rol === RolUsuario.ADMIN ||
        solicitante.rol === RolUsuario.SUPER_ADMINISTRADOR
      ) {
        const cliente = await this.prisma.cliente.create({
          data: {
            codigo,
            dni: data.dni,
            nombres: data.nombres,
            apellidos: data.apellidos,
            telefono: data.telefono,
            correo: data.correo,
            direccion: data.direccion,
            referencia: data.referencia,
            creadoPorId: solicitadoPorId,
            aprobadoPorId: solicitadoPorId,
            estadoAprobacion: 'APROBADO',
            nivelRiesgo: 'VERDE',
            puntaje: 100,
          },
        });

        // Crear multimedia si viene en la solicitud
        if (
          data.archivos &&
          Array.isArray(data.archivos) &&
          data.archivos.length > 0
        ) {
          await this.prisma.multimedia.createMany({
            data: data.archivos.map((archivo: any) => ({
              clienteId: cliente.id,
              tipoContenido: archivo.tipoContenido,
              tipoArchivo: archivo.tipoArchivo,
              formato: archivo.nombreOriginal?.split('.').pop() || 'bin',
              nombreOriginal: archivo.nombreOriginal,
              nombreAlmacenamiento: archivo.nombreAlmacenamiento,
              ruta: archivo.ruta,
              url: `/uploads/${archivo.nombreAlmacenamiento}`,
              tamanoBytes: archivo.tamanoBytes,
              subidoPorId: solicitadoPorId,
              esPrincipal: archivo.tipoContenido === 'FOTO_PERFIL',
              estado: 'ACTIVO',
            })),
          });
        }

        this.logger.log(
          `[DEBUG] Cliente aprobado automáticamente por ${solicitante.rol}: ${cliente.id}`,
        );
        return cliente;
      }

      // Caso contrario -> flujo de aprobación pendiente
      const aprobacion = await this.prisma.aprobacion.create({
        data: {
          tipoAprobacion: 'NUEVO_CLIENTE',
          referenciaId: codigo,
          tablaReferencia: 'clientes',
          solicitadoPorId: solicitadoPorId,
          estado: 'PENDIENTE',
          datosSolicitud: JSON.stringify({
            dni: data.dni,
            nombres: data.nombres,
            apellidos: data.apellidos,
            telefono: data.telefono,
            correo: data.correo,
            direccion: data.direccion,
            referencia: data.referencia,
            archivos: data.archivos || [],
          }),
        },
      });

      this.logger.log(`[DEBUG] Aprobación creada con ID: ${aprobacion.id}`);
      return {
        mensaje: 'Cliente creado exitosamente. Pendiente de aprobación.',
        aprobacionId: aprobacion.id,
        clienteCodigo: codigo,
      };
    } catch (error) {
      this.logger.error('Error creating client:', error);
      throw error;
    }
  }

  async approveClient(id: string, aprobadoPorId: string, datosAprobados?: any) {
    try {
      // Primero encontrar la aprobación
      const aprobacion = await this.prisma.aprobacion.findUnique({
        where: { id },
      });

      if (!aprobacion) {
        throw new NotFoundException('Aprobación no encontrada');
      }

      if (aprobacion.tipoAprobacion !== 'NUEVO_CLIENTE') {
        throw new Error('Tipo de aprobación inválido');
      }

      // Parsear datos de solicitud
      const datosSolicitud = JSON.parse(aprobacion.datosSolicitud as string);

      // Crear el cliente
      const cliente = await this.prisma.cliente.create({
        data: {
          codigo: aprobacion.referenciaId,
          dni: datosSolicitud.dni,
          nombres: datosSolicitud.nombres,
          apellidos: datosSolicitud.apellidos,
          telefono: datosSolicitud.telefono,
          correo: datosSolicitud.correo,
          direccion: datosSolicitud.direccion,
          referencia: datosSolicitud.referencia,

          creadoPorId: aprobacion.solicitadoPorId,
          aprobadoPorId: aprobadoPorId,
          estadoAprobacion: 'APROBADO',
          nivelRiesgo: 'VERDE',
          puntaje: 100,
        },
      });

      // Si hay archivos en la solicitud, crearlos
      if (
        datosSolicitud.archivos &&
        Array.isArray(datosSolicitud.archivos) &&
        datosSolicitud.archivos.length > 0
      ) {
        // Mapear tipos de contenido a Enum de Prisma si es necesario
        // Asumimos que vienen validados

        await this.prisma.multimedia.createMany({
          data: datosSolicitud.archivos.map((archivo: any) => ({
            clienteId: cliente.id,
            tipoContenido: archivo.tipoContenido,
            tipoArchivo: archivo.tipoArchivo,
            formato: archivo.nombreOriginal.split('.').pop() || 'bin',
            nombreOriginal: archivo.nombreOriginal,
            nombreAlmacenamiento: archivo.nombreAlmacenamiento,
            ruta: archivo.ruta,
            url: `/uploads/${archivo.nombreAlmacenamiento}`, // URL relativa
            tamanoBytes: archivo.tamanoBytes,
            subidoPorId: aprobacion.solicitadoPorId,
            esPrincipal: archivo.tipoContenido === 'FOTO_PERFIL',
            estado: 'ACTIVO',
          })),
        });
      }

      // Actualizar la aprobación
      await this.prisma.aprobacion.update({
        where: { id },
        data: {
          aprobadoPorId,
          estado: 'APROBADO',
          datosAprobados: datosAprobados
            ? JSON.stringify(datosAprobados)
            : undefined,
          revisadoEn: new Date(),
        },
      });

      return cliente;
    } catch (error) {
      this.logger.error(`Error approving client ${id}:`, error);
      throw error;
    }
  }

  async updateClient(
    id: string,
    data: {
      nombres?: string;
      apellidos?: string;
      telefono?: string;
      correo?: string;
      direccion?: string;
      referencia?: string;
      nivelRiesgo?: NivelRiesgo;
      puntaje?: number;
    },
  ) {
    try {
      const cliente = await this.prisma.cliente.findUnique({
        where: {
          id,
          eliminadoEn: null,
        },
      });

      if (!cliente) {
        throw new NotFoundException('Cliente no encontrado');
      }

      return await this.prisma.cliente.update({
        where: { id },
        data: {
          ...data,
          ultimaActualizacionRiesgo:
            data.nivelRiesgo || data.puntaje ? new Date() : undefined,
        },
      });
    } catch (error) {
      this.logger.error(`Error updating client ${id}:`, error);
      throw error;
    }
  }

  async addToBlacklist(id: string, razon: string, agregadoPorId: string) {
    try {
      const cliente = await this.prisma.cliente.findUnique({
        where: {
          id,
          eliminadoEn: null,
        },
      });

      if (!cliente) {
        throw new NotFoundException('Cliente no encontrado');
      }

      return await this.prisma.cliente.update({
        where: { id },
        data: {
          enListaNegra: true,
          razonListaNegra: razon,
          fechaListaNegra: new Date(),
          agregadoListaNegraPorId: agregadoPorId,
          nivelRiesgo: 'LISTA_NEGRA',
          puntaje: 0,
        },
      });
    } catch (error) {
      this.logger.error(`Error adding client ${id} to blacklist:`, error);
      throw error;
    }
  }

  async removeFromBlacklist(id: string) {
    try {
      const cliente = await this.prisma.cliente.findUnique({
        where: {
          id,
          eliminadoEn: null,
        },
      });

      if (!cliente) {
        throw new NotFoundException('Cliente no encontrado');
      }

      return await this.prisma.cliente.update({
        where: { id },
        data: {
          enListaNegra: false,
          razonListaNegra: null,
          fechaListaNegra: null,
          agregadoListaNegraPorId: null,
          nivelRiesgo: 'VERDE',
          puntaje: 80, // Puntaje base después de salir de lista negra
        },
      });
    } catch (error) {
      this.logger.error(`Error removing client ${id} from blacklist:`, error);
      throw error;
    }
  }

  async assignToRoute(
    clienteId: string,
    rutaId: string,
    cobradorId: string,
    diaSemana?: number,
  ) {
    try {
      // Verificar si ya existe una asignación activa
      const asignacionExistente = await this.prisma.asignacionRuta.findFirst({
        where: {
          clienteId,
          activa: true,
        },
      });

      if (asignacionExistente) {
        // Desactivar asignación anterior
        await this.prisma.asignacionRuta.update({
          where: { id: asignacionExistente.id },
          data: { activa: false },
        });
      }

      // Crear nueva asignación
      return await this.prisma.asignacionRuta.create({
        data: {
          rutaId,
          clienteId,
          cobradorId,
          diaSemana,
          ordenVisita: 0,
          activa: true,
        },
      });
    } catch (error) {
      this.logger.error(`Error assigning client ${clienteId} to route:`, error);
      throw error;
    }
  }
}
