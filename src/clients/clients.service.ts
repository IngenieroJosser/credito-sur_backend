import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { NotificacionesGateway } from '../notificaciones/notificaciones.gateway';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import { NivelRiesgo, RolUsuario } from '@prisma/client';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificacionesService: NotificacionesService,
    private readonly notificacionesGateway: NotificacionesGateway,
    private readonly configuracionService: ConfiguracionService,
  ) {}

  async create(createClientDto: CreateClientDto) {
    // Validar si ya existe un cliente con ese documento
    const clienteExistente = await this.prisma.cliente.findFirst({
      where: { dni: createClientDto.dni },
    });

    if (clienteExistente) {
      if (!clienteExistente.eliminadoEn) {
        throw new ConflictException(
          `Ya existe un cliente activo con ese número de documento: ${createClientDto.dni}`,
        );
      } else {
        throw new ConflictException(
          `El cliente con documento ${createClientDto.dni} ya existe pero está archivado. Restáuralo desde la sección de Archivados.`,
        );
      }
    }

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
    const {
      rutaId: _rutaId,
      observaciones: _observaciones,
      archivos: _archivos,
      ...clientData
    } = createClientDto;

    const cliente = await this.prisma.cliente.create({
      data: {
        ...clientData,
        codigo,
        creadoPorId: creador.id,
        // TODO: Manejar asignación de ruta y observaciones si es necesario en otras tablas
      },
    });

    this.notificacionesGateway.broadcastClientesActualizados({
      accion: 'CREAR',
      clienteId: cliente.id,
    });

    return cliente;
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

  async update(id: string, updateClientDto: UpdateClientDto) {
    const {
      rutaId: _rutaId,
      observaciones: _observaciones,
      archivos,
      ...clientData
    } = updateClientDto;

    // Actualizar datos básicos del cliente
    const clienteActualizado = await this.prisma.cliente.update({
      where: { id },
      data: clientData,
    });

    // Si vienen archivos, procesar actualización (incluso si el array está vacío, significa que se eliminaron todos)
    if (archivos !== undefined) {
      this.logger.log(`[DEBUG] Actualizando archivos para cliente ${id}. Archivos recibidos: ${archivos.length}`);

      // ESTRATEGIA SIMPLE: Marcar TODOS los archivos existentes como ELIMINADOS
      const archivosExistentes = await this.prisma.multimedia.findMany({
        where: { 
          clienteId: id,
          estado: 'ACTIVO'
        },
        select: { id: true, tipoContenido: true },
      });

      if (archivosExistentes.length > 0) {
        this.logger.log(`[DEBUG] Marcando ${archivosExistentes.length} archivos antiguos como ELIMINADOS`);
        await this.prisma.multimedia.updateMany({
          where: {
            id: { in: archivosExistentes.map(a => a.id) }
          },
          data: {
            estado: 'ELIMINADO' as const,
            eliminadoEn: new Date()
          }
        });
      }

      // Crear nuevos archivos
      const nuevosArchivos = archivos.map((archivo: any) => {
        // Asegurar que la URL sea correcta
        const url = archivo.url || archivo.path || archivo.ruta;
        const urlFinal = url?.startsWith('http') ? url : url;
        
        return {
          clienteId: id,
          tipoContenido: archivo.tipoContenido,
          tipoArchivo: archivo.tipoArchivo,
          formato: archivo.formato || archivo.tipoArchivo?.split('/')[1] || 'jpg',
          nombreOriginal: archivo.nombreOriginal,
          nombreAlmacenamiento: archivo.nombreAlmacenamiento || archivo.nombreOriginal,
          ruta: archivo.ruta || archivo.path,
          url: urlFinal,
          tamanoBytes: archivo.tamanoBytes || 0,
          subidoPorId: archivo.subidoPorId || clienteActualizado.creadoPorId,
          estado: 'ACTIVO' as const,
        };
      });

      await this.prisma.multimedia.createMany({
        data: nuevosArchivos,
      });

      this.logger.log(`[DEBUG] Archivos actualizados para cliente ${id}:`);
      this.logger.log(`  - Eliminados: ${archivosExistentes.length} archivos antiguos`);
      this.logger.log(`  - Creados: ${nuevosArchivos.length} archivos nuevos`);
      nuevosArchivos.forEach((a, i) => {
        this.logger.log(`    [${i}] ${a.tipoContenido} - ${a.tipoArchivo} - ${a.url}`);
      });
    }

    const clienteConArchivos = await this.prisma.cliente.findUnique({
      where: { id },
      include: {
        archivos: {
          where: { estado: 'ACTIVO' },
        },
      },
    });

    this.notificacionesGateway.broadcastClientesActualizados({
      accion: 'ACTUALIZAR',
      clienteId: id,
    });

    return clienteConArchivos;
  }

  remove(id: string) {
    return this.prisma.cliente.update({
      where: { id },
      data: { eliminadoEn: new Date() },
    }).then((cliente) => {
      this.notificacionesGateway.broadcastClientesActualizados({
        accion: 'ELIMINAR',
        clienteId: id,
      });
      return cliente;
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

      // Ya no necesitamos incluir aprobacionesPendientes por separado porque ahora
      // todos los clientes se crean en la tabla principal con estado PENDIENTE.
      const aprobacionesPendientes: any[] = [];

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
              detalles: {
                include: {
                  cuota: true,
                },
              },
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

      // Log de archivos devueltos
      if (cliente && cliente.archivos) {
        this.logger.log(`[DEBUG] Cliente ${id} - Archivos ACTIVOS devueltos: ${cliente.archivos.length}`);
        cliente.archivos.forEach((a: any, i: number) => {
          this.logger.log(`  [${i}] ${a.tipoContenido} - ${a.tipoArchivo} - Estado: ${a.estado} - URL: ${a.url}`);
        });
      }

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
        where: { dni: data.dni },
      });

      if (clienteExistente) {
        if (!clienteExistente.eliminadoEn) {
          throw new ConflictException(
            `Ya existe un cliente activo con ese número de documento: ${data.dni}`,
          );
        } else {
          throw new ConflictException(
            `El cliente con documento ${data.dni} ya existe pero está archivado. Restáuralo desde la sección de Archivados.`,
          );
        }
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

      // Flujo de aprobación
      const autoAprobar = await this.configuracionService.shouldAutoApproveClients();
      const estadoInicial = autoAprobar ? 'APROBADO' : 'PENDIENTE';

      // 1. Crear el cliente en la base de datos
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
          estadoAprobacion: estadoInicial,
          nivelRiesgo: 'VERDE',
          puntaje: 100,
        },
      });

      // 2. Crear multimedia si viene en la solicitud
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

      // 3. Crear el registro de aprobación referenciando al cliente
      const aprobacion = await this.prisma.aprobacion.create({
        data: {
          tipoAprobacion: 'NUEVO_CLIENTE',
          referenciaId: cliente.id,
          tablaReferencia: 'Cliente',
          solicitadoPorId: solicitadoPorId,
          estado: estadoInicial,
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
          ...(autoAprobar ? { aprobadoPorId: solicitadoPorId, revisadoEn: new Date() } : {})
        },
      });

      } // Fin de if (!autoAprobar)

      this.notificacionesGateway.broadcastClientesActualizados({
        accion: 'CREAR',
        clienteId: cliente.id,
      });

      this.logger.log(`[DEBUG] Cliente creado con estado ${estadoInicial} (ID: ${cliente.id}) y aprobación creada (ID: ${aprobacion.id}).`);
      return {
        mensaje: autoAprobar ? 'Cliente creado y aprobado automáticamente.' : 'Cliente creado exitosamente. Pendiente de aprobación.',
        aprobacionId: aprobacion.id,
        clienteId: cliente.id,
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

      // El cliente ya fue creado con estado PENDIENTE, ahora lo activamos
      const cliente = await this.prisma.cliente.update({
        where: { id: aprobacion.referenciaId },
        data: {
          estadoAprobacion: 'APROBADO',
          aprobadoPorId: aprobadoPorId,
          // Actualizar datos si cambiaron durante la aprobación
          dni: datosAprobados?.dni || datosSolicitud.dni,
          nombres: datosAprobados?.nombres || datosSolicitud.nombres,
          apellidos: datosAprobados?.apellidos || datosSolicitud.apellidos,
          telefono: datosAprobados?.telefono || datosSolicitud.telefono,
          correo: datosAprobados?.correo || datosSolicitud.correo,
          direccion: datosAprobados?.direccion || datosSolicitud.direccion,
          referencia: datosAprobados?.referencia || datosSolicitud.referencia,
        },
      });

      // Los archivos ya fueron creados en createClient, no es necesario volver a crearlos aquí

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

      // Notificar al solicitante que su cliente fue aprobado
      const aprobadorInfo = await this.prisma.usuario.findUnique({
        where: { id: aprobadoPorId },
        select: { nombres: true, apellidos: true },
      });

      await this.notificacionesService.create({
        usuarioId: aprobacion.solicitadoPorId,
        titulo: 'Cliente Aprobado',
        mensaje: `Tu solicitud de cliente ${datosSolicitud.nombres} ${datosSolicitud.apellidos} (DNI: ${datosSolicitud.dni}) ha sido aprobada por ${aprobadorInfo?.nombres} ${aprobadorInfo?.apellidos}`,
        tipo: 'APROBACION',
        entidad: 'Cliente',
        entidadId: cliente.id,
        metadata: {
          accion: 'APROBADO',
          clienteNombre: `${datosSolicitud.nombres} ${datosSolicitud.apellidos}`,
          clienteDni: datosSolicitud.dni,
          aprobadoPor: `${aprobadorInfo?.nombres} ${aprobadorInfo?.apellidos}`,
        },
      });

      return cliente;
    } catch (error) {
      this.logger.error(`Error approving client ${id}:`, error);
      throw error;
    }
  }

  async rejectClient(id: string, rechazadoPorId: string, razon?: string) {
    try {
      // Encontrar la aprobación
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

      // Actualizar la aprobación como rechazada
      await this.prisma.aprobacion.update({
        where: { id },
        data: {
          aprobadoPorId: rechazadoPorId,
          estado: 'RECHAZADO',
          datosAprobados: razon ? JSON.stringify({ razon }) : undefined,
          revisadoEn: new Date(),
        },
      });

      // También actualizamos el estado del cliente a RECHAZADO
      await this.prisma.cliente.update({
        where: { id: aprobacion.referenciaId },
        data: {
          estadoAprobacion: 'RECHAZADO',
          eliminadoEn: new Date(), // Lo ocultamos de la lista normal
        },
      });

      // Notificar al solicitante que su cliente fue rechazado
      const rechazadorInfo = await this.prisma.usuario.findUnique({
        where: { id: rechazadoPorId },
        select: { nombres: true, apellidos: true },
      });

      await this.notificacionesService.create({
        usuarioId: aprobacion.solicitadoPorId,
        titulo: 'Cliente Rechazado',
        mensaje: `Tu solicitud de cliente ${datosSolicitud.nombres} ${datosSolicitud.apellidos} (DNI: ${datosSolicitud.dni}) ha sido rechazada por ${rechazadorInfo?.nombres} ${rechazadorInfo?.apellidos}${razon ? `. Razón: ${razon}` : ''}`,
        tipo: 'APROBACION',
        entidad: 'Aprobacion',
        entidadId: id,
        metadata: {
          accion: 'RECHAZADO',
          clienteNombre: `${datosSolicitud.nombres} ${datosSolicitud.apellidos}`,
          clienteDni: datosSolicitud.dni,
          rechazadoPor: `${rechazadorInfo?.nombres} ${rechazadorInfo?.apellidos}`,
          razon: razon || 'No especificada',
        },
      });

      return {
        mensaje: 'Solicitud de cliente rechazada exitosamente',
        aprobacionId: id,
      };
    } catch (error) {
      this.logger.error(`Error rejecting client ${id}:`, error);
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
      archivos?: any[];
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

      // Separar archivos de los datos del cliente
      const { archivos, ...clientData } = data;

      // Actualizar datos básicos del cliente
      const clienteActualizado = await this.prisma.cliente.update({
        where: { id },
        data: {
          ...clientData,
          ultimaActualizacionRiesgo:
            clientData.nivelRiesgo || clientData.puntaje ? new Date() : undefined,
        },
      });

      // Procesar archivos si se enviaron
      if (archivos && Array.isArray(archivos)) {
        this.logger.log(`[UPDATE] Procesando ${archivos.length} archivos para cliente ${id}`);

        // 1. Marcar TODOS los archivos ACTIVOS como ELIMINADOS
        const eliminados = await this.prisma.multimedia.updateMany({
          where: {
            clienteId: id,
            estado: 'ACTIVO',
          },
          data: {
            estado: 'ELIMINADO' as const,
            eliminadoEn: new Date(),
          },
        });
        this.logger.log(`[UPDATE] ${eliminados.count} archivos antiguos marcados como ELIMINADOS`);

        // 2. Crear los archivos nuevos
        if (archivos.length > 0) {
          await this.prisma.multimedia.createMany({
            data: archivos.map((archivo: any) => ({
              clienteId: id,
              tipoContenido: archivo.tipoContenido,
              tipoArchivo: archivo.tipoArchivo || 'image/jpeg',
              formato: archivo.formato || archivo.tipoArchivo?.split('/')[1] || archivo.nombreOriginal?.split('.').pop() || 'jpg',
              nombreOriginal: archivo.nombreOriginal,
              nombreAlmacenamiento: archivo.nombreAlmacenamiento || archivo.nombreOriginal,
              ruta: archivo.ruta || archivo.path || '',
              url: archivo.url || archivo.ruta || archivo.path || '',
              tamanoBytes: archivo.tamanoBytes || 0,
              subidoPorId: cliente.creadoPorId,
              estado: 'ACTIVO' as const,
            })),
          });
          this.logger.log(`[UPDATE] ${archivos.length} archivos nuevos creados`);
        }
      }

      // Devolver cliente con archivos actualizados
      return this.prisma.cliente.findUnique({
        where: { id },
        include: {
          archivos: {
            where: { estado: 'ACTIVO' },
          },
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
