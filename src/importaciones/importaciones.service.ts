import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { sincronizarAsignacionesCliente } from '../routes/sincronizar-asignaciones';
import { ClientesCreditosParser } from './parsers/clientes-creditos.parser';
import { InventarioParser } from './parsers/inventario.parser';
import { ResultadoValidacion } from './dto/validacion-resultado.dto';
import { LedgerService } from '../accounting/ledger.service';
import { generarPlantillaInventario } from './plantillas/plantilla-inventario';
import {
  generarPlantillaClientesCreditos,
  DatosReferenciaPlantilla,
} from './plantillas/plantilla-clientes-creditos';
import {
  aplicarAvanceHistorico,
  construirPlanCuotas,
  PlanCuota,
  resolverEstadoPrestamoImportado,
} from './avance-historico';
import {
  calcularInteresTotal,
  plazoMesesPersistido,
  TIPO_AMORTIZACION_POR_DEFECTO,
} from './interes-credito';
import { pesos } from '../common/dinero.util';

@Injectable()
export class ImportacionesService {
  private clientesCreditosParser: ClientesCreditosParser;
  private inventarioParser: InventarioParser;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
  ) {
    this.clientesCreditosParser = new ClientesCreditosParser(this.prisma);
    this.inventarioParser = new InventarioParser(this.prisma);
  }

  private getAccountCodeCaja(caja: any) {
    if (caja?.codigo === 'CAJA-BANCO') return '1.1.2';
    if (String(caja?.tipo || '').toUpperCase() === 'RUTA') return '1.2.1';
    return '1.1.1';
  }

  // --- Plantillas ---

  async generarPlantillaInventario() {
    return generarPlantillaInventario();
  }

  /**
   * La plantilla de clientes y créditos se genera con datos vivos del sistema
   * (clientes, artículos, préstamos y rutas). Eso permite que el Excel avise de
   * cédulas repetidas y autocomplete nombres y precios mientras se diligencia,
   * sin tener que subir el archivo para enterarse.
   */
  async generarPlantillaClientesCreditos() {
    const [clientes, productos, prestamos, rutas] = await Promise.all([
      this.prisma.cliente.findMany({
        where: { eliminadoEn: null },
        select: { dni: true, nombres: true, apellidos: true },
        orderBy: { creadoEn: 'desc' },
      }),
      this.prisma.producto.findMany({
        where: { eliminadoEn: null, activo: true },
        select: {
          codigo: true,
          nombre: true,
          costo: true,
          stock: true,
          precios: {
            where: { activo: true },
            select: { meses: true, precio: true },
            orderBy: { meses: 'asc' },
          },
        },
        orderBy: { nombre: 'asc' },
      }),
      this.prisma.prestamo.findMany({
        where: { eliminadoEn: null },
        select: { numeroPrestamo: true },
        orderBy: { creadoEn: 'desc' },
      }),
      this.prisma.ruta.findMany({
        where: { activa: true, eliminadoEn: null },
        select: { codigo: true },
        orderBy: { codigo: 'asc' },
      }),
    ]);

    const datos: DatosReferenciaPlantilla = {
      clientes: clientes.map((c) => ({
        dni: String(c.dni),
        nombre: `${c.nombres} ${c.apellidos}`.trim(),
      })),
      articulos: productos.flatMap((p) =>
        p.precios.map((precio) => ({
          codigo: String(p.codigo).toUpperCase(),
          nombre: p.nombre,
          meses: Number(precio.meses),
          precio: Number(precio.precio) || 0,
          costo: Number(p.costo) || 0,
          stock: Number(p.stock) || 0,
        })),
      ),
      codigosArticulo: productos.map((p) => String(p.codigo).toUpperCase()),
      numerosPrestamo: prestamos.map((p) => String(p.numeroPrestamo)),
      rutas: rutas.map((r) => r.codigo),
    };

    return generarPlantillaClientesCreditos(datos);
  }

  // --- Lotes e historial ---

  /** Últimas importaciones, para poder consultarlas y deshacerlas. */
  async listarLotes(limite = 20) {
    const lotes = await this.prisma.importacionLote.findMany({
      orderBy: { creadoEn: 'desc' },
      take: limite,
      include: {
        creadoPor: { select: { nombres: true, apellidos: true } },
      },
    });

    return lotes.map((lote) => {
      const creado = (lote.resumen?.creado ?? {}) as {
        clientes?: string[];
        prestamos?: string[];
        conMovimientosContables?: boolean;
      };

      const clientes = creado.clientes?.length ?? 0;
      const prestamos = creado.prestamos?.length ?? 0;

      return {
        id: lote.id,
        tipo: lote.tipo,
        estado: lote.estado,
        nombreArchivo: lote.nombreArchivo,
        totalFilas: lote.totalFilas,
        filasConError: lote.filasConError,
        advertencias: lote.advertencias,
        creadoEn: lote.creadoEn,
        confirmadoEn: lote.confirmadoEn,
        creadoPor: lote.creadoPor
          ? `${lote.creadoPor.nombres} ${lote.creadoPor.apellidos}`.trim()
          : null,
        clientesCreados: clientes,
        prestamosCreados: prestamos,
        sePuedeDeshacer: this.evaluarSiSePuedeDeshacer(lote, creado).sePuede,
        razonNoSePuedeDeshacer: this.evaluarSiSePuedeDeshacer(lote, creado)
          .razon,
      };
    });
  }

  private evaluarSiSePuedeDeshacer(
    lote: { estado: string; tipo: string },
    creado: {
      clientes?: string[];
      prestamos?: string[];
      conMovimientosContables?: boolean;
    },
  ): { sePuede: boolean; razon: string | null } {
    if (lote.estado !== 'CONFIRMADO') {
      return { sePuede: false, razon: 'El lote no llegó a confirmarse.' };
    }

    if (lote.tipo !== 'CLIENTES_CREDITOS') {
      return {
        sePuede: false,
        razon:
          'Por ahora solo se pueden deshacer importaciones de clientes y créditos.',
      };
    }

    if (creado.conMovimientosContables) {
      return {
        sePuede: false,
        razon:
          'El lote desembolsó dinero de caja y generó asientos contables. Reversarlo debe hacerse desde el módulo contable.',
      };
    }

    if (!creado.clientes && !creado.prestamos) {
      return {
        sePuede: false,
        razon:
          'Este lote es anterior al registro de lo que se creó, así que no se puede deshacer automáticamente.',
      };
    }

    return { sePuede: true, razon: null };
  }

  /**
   * Deshace una importación: borra los clientes y créditos que creó.
   *
   * Solo se permite si nada se ha movido desde entonces: un crédito con pagos
   * registrados, o un lote que movió caja, ya no se puede revertir sin tocar
   * contabilidad, y eso no es trabajo de una importación.
   */
  async revertirLote(loteId: string): Promise<{
    loteId: string;
    clientesEliminados: number;
    prestamosEliminados: number;
    cuotasEliminadas: number;
    mensajes: string[];
  }> {
    const lote = await this.prisma.importacionLote.findUnique({
      where: { id: loteId },
    });

    if (!lote) {
      throw new BadRequestException('La importación indicada no existe.');
    }

    const creado = (lote.resumen?.creado ?? {}) as {
      clientes?: string[];
      prestamos?: string[];
      conMovimientosContables?: boolean;
    };

    const evaluacion = this.evaluarSiSePuedeDeshacer(lote, creado);
    if (!evaluacion.sePuede) {
      throw new BadRequestException(
        evaluacion.razon || 'Esta importación no se puede deshacer.',
      );
    }

    const idsPrestamos = creado.prestamos ?? [];
    const idsClientes = creado.clientes ?? [];
    const mensajes: string[] = [];

    // Un crédito que ya recibió pagos deja de ser "lo que importamos".
    const prestamosConPagos = await this.prisma.pago.findMany({
      where: { prestamoId: { in: idsPrestamos } },
      select: { prestamoId: true },
      distinct: ['prestamoId'],
    });

    if (prestamosConPagos.length > 0) {
      throw new BadRequestException(
        `No se puede deshacer: ${prestamosConPagos.length} crédito(s) de esta importación ya tienen pagos registrados.`,
      );
    }

    let clientesEliminados = 0;
    let prestamosEliminados = 0;
    let cuotasEliminadas = 0;

    await this.prisma.$transaction(
      async (tx) => {
        const cuotas = await tx.cuota.deleteMany({
          where: { prestamoId: { in: idsPrestamos } },
        });
        cuotasEliminadas = cuotas.count;

        const prestamos = await tx.prestamo.deleteMany({
          where: { id: { in: idsPrestamos } },
        });
        prestamosEliminados = prestamos.count;

        // Los clientes que quedaron con créditos de otras importaciones se conservan.
        const clientesConOtrosCreditos = await tx.prestamo.findMany({
          where: { clienteId: { in: idsClientes } },
          select: { clienteId: true },
          distinct: ['clienteId'],
        });
        const conservar = new Set(
          clientesConOtrosCreditos.map((p) => p.clienteId),
        );
        const eliminables = idsClientes.filter((id) => !conservar.has(id));

        if (conservar.size > 0) {
          mensajes.push(
            `${conservar.size} cliente(s) se conservaron porque tienen créditos de otras importaciones.`,
          );
        }

        await tx.asignacionRuta.deleteMany({
          where: { clienteId: { in: eliminables } },
        });

        const clientes = await tx.cliente.deleteMany({
          where: { id: { in: eliminables } },
        });
        clientesEliminados = clientes.count;

        await tx.importacionLote.update({
          where: { id: loteId },
          data: { estado: 'CANCELADO' },
        });
      },
      { maxWait: 60_000, timeout: 600_000 },
    );

    mensajes.unshift('Importación deshecha correctamente.');

    return {
      loteId,
      clientesEliminados,
      prestamosEliminados,
      cuotasEliminadas,
      mensajes,
    };
  }

  // --- Validación ---

  async validarClientesCreditos(
    file: Express.Multer.File,
  ): Promise<ResultadoValidacion> {
    if (!file || !file.buffer) {
      throw new BadRequestException('Archivo no proporcionado');
    }
    try {
      return await this.clientesCreditosParser.parseAndValidate(
        file.buffer,
        file.originalname,
      );
    } catch (error) {
      throw new BadRequestException(
        'El archivo no es un Excel válido o está dañado.',
      );
    }
  }

  async validarInventario(
    file: Express.Multer.File,
  ): Promise<ResultadoValidacion> {
    if (!file || !file.buffer) {
      throw new BadRequestException('Archivo no proporcionado');
    }
    try {
      return await this.inventarioParser.parseAndValidate(
        file.buffer,
        file.originalname,
      );
    } catch (error) {
      throw new BadRequestException(
        'El archivo no es un Excel válido o está dañado.',
      );
    }
  }

  // --- Confirmación ---

  async confirmarInventario(
    file: Express.Multer.File,
    creadoPorId: string,
  ): Promise<{
    loteId: string;
    estado: string;
    articulosCreados: number;
    articulosActualizados: number;
    articulosOmitidos: number;
    preciosActualizados: number;
    preciosCreados: number;
    preciosOmitidos: number;
    preciosContadoCreados: number;
    mensajes: string[];
    resumen: any;
  }> {
    if (!file || !file.buffer) {
      throw new BadRequestException('Archivo no proporcionado');
    }

    // 1. Re-validar
    let resultado: ResultadoValidacion;
    try {
      resultado = await this.inventarioParser.parseAndValidate(
        file.buffer,
        file.originalname,
      );
    } catch {
      throw new BadRequestException(
        'El archivo no es un Excel válido o está dañado.',
      );
    }

    // 2. Bloquear si hay errores
    if (resultado.errores.length > 0) {
      // Registrar lote fallido para trazabilidad
      const lote = await this.prisma.importacionLote.create({
        data: {
          tipo: 'INVENTARIO',
          estado: 'FALLIDO',
          nombreArchivo: file.originalname,
          totalFilas: resultado.resumen.totalFilas,
          filasValidas: resultado.resumen.filasValidas,
          filasConError: resultado.resumen.filasConError,
          advertencias: resultado.resumen.advertencias,
          resumen: resultado.resumen as any,
          errores: resultado.errores as any,
          creadoPorId,
        },
      });

      throw new BadRequestException({
        message: `El archivo tiene ${resultado.errores.length} error(es). Corrija los errores antes de confirmar.`,
        loteId: lote.id,
        errores: resultado.errores.slice(0, 20), // Primeros 20 errores
        totalErrores: resultado.errores.length,
      });
    }

    const articulos: any[] = (resultado as any).articulos ?? [];
    const precios: any[] = (resultado as any).precios ?? [];

    // 3. Ejecutar dentro de transacción
    let articulosCreados = 0;
    let articulosActualizados = 0;
    let articulosOmitidos = 0;
    let preciosActualizados = 0;
    // Códigos marcados como ACTUALIZAR: sus precios se corrigen, no se omiten.
    const articulosPorCodigo = new Map<string, boolean>(
      articulos.map((art: any) => [art.codigo, Boolean(art.esActualizacion)]),
    );
    let preciosCreados = 0;
    let preciosOmitidos = 0;
    let preciosContadoCreados = 0;
    const mensajes: string[] = [];

    // La importación de inventario actual es una carga operativa inicial:
    // crea catálogo, stock y precios, pero no genera asientos contables.
    await this.prisma.$transaction(
      async (tx) => {
        // Crear o verificar artículos (idempotencia por código)
        for (const art of articulos) {
          const existe = await tx.producto.findUnique({
            where: { codigo: art.codigo },
            select: { id: true },
          });

          if (art.esActualizacion) {
            if (!existe) {
              articulosOmitidos++;
              continue;
            }

            // Se corrigen los datos del artículo; los precios se actualizan más
            // abajo, junto con los que se agregan por primera vez.
            await tx.producto.update({
              where: { id: existe.id },
              data: {
                nombre: art.nombre,
                descripcion: art.descripcion || null,
                categoria: art.categoria,
                marca: art.marca || null,
                modelo: art.modelo || null,
                costo: art.costo,
                stock: art.stock ?? 0,
                stockMinimo: art.stockMinimo ?? 0,
                activo: art.activo !== 'NO',
              },
            });

            articulosActualizados++;
            continue;
          }

          if (existe) {
            // El artículo ya estaba creado: se respetan sus datos actuales y más
            // abajo solo se le agregan las opciones de precio que aún no tenga.
            articulosOmitidos++;
            continue;
          }

          await tx.producto.create({
            data: {
              codigo: art.codigo,
              nombre: art.nombre,
              descripcion: art.descripcion || null,
              categoria: art.categoria,
              marca: art.marca || null,
              modelo: art.modelo || null,
              costo: art.costo,
              stock: art.stock ?? 0,
              stockMinimo: art.stockMinimo ?? 0,
              activo: art.activo !== 'NO',
            },
          });
          articulosCreados++;
        }

        // Crear precios (idempotencia por código + meses)
        for (const precio of precios) {
          const producto = await tx.producto.findUnique({
            where: { codigo: precio.codigoProducto },
            select: { id: true },
          });

          if (!producto) {
            preciosOmitidos++;
            continue;
          }

          const existePrecio = await tx.precioProducto.findFirst({
            where: { productoId: producto.id, meses: precio.meses },
            select: { id: true },
          });

          if (existePrecio) {
            const seActualiza = articulosPorCodigo.get(precio.codigoProducto);
            if (seActualiza) {
              await tx.precioProducto.update({
                where: { id: existePrecio.id },
                data: {
                  precio: precio.precio,
                  activo: precio.activo !== 'NO',
                },
              });
              preciosActualizados++;
            } else {
              preciosOmitidos++;
            }
            continue;
          }

          await tx.precioProducto.create({
            data: {
              productoId: producto.id,
              meses: precio.meses,
              precio: precio.precio,
              activo: precio.activo !== 'NO',
            },
          });
          preciosCreados++;
          // El precio de contado se guarda como una opción de 0 meses.
          if (Number(precio.meses) === 0) preciosContadoCreados++;
        }
      },
      { maxWait: 60_000, timeout: 600_000 },
    );

    if (articulosActualizados > 0) {
      mensajes.push(
        `${articulosActualizados} artículo(s) actualizados y ${preciosActualizados} precio(s) corregidos.`,
      );
    }
    if (articulosOmitidos > 0) {
      mensajes.push(
        `${articulosOmitidos} artículo(s) ya existían en el sistema: se conservaron sus datos y solo se agregaron las opciones de precio que faltaban.`,
      );
    }
    if (preciosContadoCreados > 0) {
      mensajes.push(
        `Se registraron ${preciosContadoCreados} precio(s) de contado.`,
      );
    }
    if (preciosOmitidos > 0) {
      mensajes.push(
        `${preciosOmitidos} opción(es) de precio ya estaban registradas y no se duplicaron.`,
      );
    }

    // 4. Registrar lote confirmado
    const lote = await this.prisma.importacionLote.create({
      data: {
        tipo: 'INVENTARIO',
        estado: 'CONFIRMADO',
        nombreArchivo: file.originalname,
        totalFilas: resultado.resumen.totalFilas,
        filasValidas: resultado.resumen.filasValidas,
        filasConError: resultado.resumen.filasConError,
        advertencias: resultado.resumen.advertencias,
        resumen: resultado.resumen as any,
        creadoPorId,
        confirmadoEn: new Date(),
      },
    });

    return {
      loteId: lote.id,
      estado: 'CONFIRMADO',
      articulosCreados,
      articulosActualizados,
      articulosOmitidos,
      preciosActualizados,
      preciosCreados,
      preciosOmitidos,
      preciosContadoCreados,
      mensajes,
      resumen: resultado.resumen,
    };
  }

  async confirmarClientesCreditos(
    file: Express.Multer.File,
    creadoPorId: string,
  ): Promise<{
    loteId: string;
    clientesCreados: number;
    clientesActualizados: number;
    clientesOmitidos: number;
    clientesAsignadosARuta: number;
    creditosHistoricosCreados: number;
    creditosOperativosCreados: number;
    creditosOmitidos: number;
    creditosNoSoportados: number;
    creditosActualizados: number;
    articulosDescontados: number;
    creditosAvanzados: number;
    cuotasPagadasImportadas: number;
    transaccionesCreadas: number;
    asientosCreados: number;
    cuotasCreadas: number;
    mensajes: string[];
    resumen: any;
  }> {
    if (!file || !file.buffer) {
      throw new BadRequestException('Archivo no proporcionado');
    }

    // 1. Re-validar
    let resultado: ResultadoValidacion;
    try {
      resultado = await this.clientesCreditosParser.parseAndValidate(
        file.buffer,
        file.originalname,
      );
    } catch {
      throw new BadRequestException(
        'El archivo no es un Excel válido o está dañado.',
      );
    }

    // 2. Bloquear si hay errores
    if (resultado.errores.length > 0) {
      const lote = await this.prisma.importacionLote.create({
        data: {
          tipo: 'CLIENTES_CREDITOS',
          estado: 'FALLIDO',
          nombreArchivo: file.originalname,
          totalFilas: resultado.resumen.totalFilas,
          filasValidas: resultado.resumen.filasValidas,
          filasConError: resultado.resumen.filasConError,
          advertencias: resultado.resumen.advertencias,
          resumen: resultado.resumen as any,
          errores: resultado.errores as any,
          creadoPorId,
        },
      });

      throw new BadRequestException({
        message: `El archivo tiene ${resultado.errores.length} error(es). Corrija los errores antes de confirmar.`,
        loteId: lote.id,
        errores: resultado.errores.slice(0, 20),
        totalErrores: resultado.errores.length,
      });
    }

    const clientes: any[] = (resultado as any).clientes ?? [];

    // Mapeo de NivelRiesgo (operativo a Prisma)
    const mapNivelRiesgo = (nivel: string): 'VERDE' | 'AMARILLO' | 'ROJO' => {
      const n = (nivel || '').toUpperCase();
      if (n === 'PRECAUCION' || n === 'MODERADO') return 'AMARILLO';
      if (n === 'CRITICO') return 'ROJO';
      return 'VERDE'; // MINIMO, LEVE o por defecto
    };

    let clientesCreados = 0;
    let clientesActualizados = 0;
    let clientesOmitidos = 0;
    let creditosActualizados = 0;
    let articulosDescontados = 0;
    // Se guardan los ids creados para poder revertir el lote más adelante.
    const idsClientesCreados: string[] = [];
    const idsClientesActualizados: string[] = [];
    const idsPrestamosActualizados: string[] = [];
    const clientesPorAsignar: Array<{ clienteId: string; rutaCodigo: string }> =
      [];
    const idsPrestamosCreados: string[] = [];
    let creditosHistoricosCreados = 0;
    let creditosOperativosCreados = 0;
    let creditosOmitidos = 0;
    let creditosNoSoportados = 0;
    let creditosAvanzados = 0;
    let cuotasPagadasImportadas = 0;
    let transaccionesCreadas = 0;
    let asientosCreados = 0;
    let cuotasCreadas = 0;
    const mensajes: string[] = [];
    let clientesAsignadosARuta = 0;

    let loteId = '';

    // 3. Ejecutar dentro de transacción con try-catch para rollback y lote FALLIDO
    try {
      await this.prisma.$transaction(
        async (tx) => {
          for (const cli of clientes) {
            // Idempotencia por DNI o código
            const existente = await tx.cliente.findFirst({
              where: {
                OR: [
                  { dni: cli.cc },
                  { codigo: cli.codigoImp },
                  { idempotencyKey: cli.codigoImp },
                ],
              },
              select: { id: true },
            });

            if (cli.esActualizacion) {
              if (!existente) {
                clientesOmitidos++;
                continue;
              }

              // Solo se sobreescribe lo que trae el archivo: una columna vacía en el
              // Excel no borra el dato que ya tiene el cliente.
              const cambios: Record<string, unknown> = {
                nombres: cli.nombres,
                apellidos: cli.apellidos,
                telefono: cli.telefono,
                nivelRiesgo: mapNivelRiesgo(cli.nivelRiesgo),
              };

              const opcionales: Array<[string, string]> = [
                ['correo', cli.correo],
                ['direccion', cli.direccion],
                ['referencia', cli.referencia],
                ['referencia1Nombre', cli.referencia1Nombre],
                ['referencia1Telefono', cli.referencia1Telefono],
                ['referencia2Nombre', cli.referencia2Nombre],
                ['referencia2Telefono', cli.referencia2Telefono],
              ];
              opcionales.forEach(([campo, valor]) => {
                if (valor) cambios[campo] = valor;
              });

              await tx.cliente.update({
                where: { id: existente.id },
                data: cambios,
              });

              clientesActualizados++;
              idsClientesActualizados.push(existente.id);
              clientesPorAsignar.push({
                clienteId: existente.id,
                rutaCodigo: cli.rutaCodigo,
              });
              continue;
            }

            if (existente) {
              clientesOmitidos++;
              continue;
            }

            const clienteCreado = await tx.cliente.create({
              data: {
                codigo: cli.codigoImp || cli.cc, // Fallback si no viene algo único
                idempotencyKey: cli.codigoImp, // Usamos el código importación del excel
                dni: cli.cc,
                nombres: cli.nombres,
                apellidos: cli.apellidos,
                correo: cli.correo || null,
                telefono: cli.telefono,
                direccion: cli.direccion || null,
                referencia: cli.referencia || null,
                referencia1Nombre: cli.referencia1Nombre || null,
                referencia1Telefono: cli.referencia1Telefono || null,
                referencia2Nombre: cli.referencia2Nombre || null,
                referencia2Telefono: cli.referencia2Telefono || null,
                nivelRiesgo: mapNivelRiesgo(cli.nivelRiesgo),
                creadoPorId,
                estadoAprobacion: 'APROBADO',
                aprobadoPorId: creadoPorId,
                // Si la ruta viene en el excel y es válida, deberíamos asignarla?
                // Por el momento lo agregamos simple si aplica.
              },
            });
            clientesCreados++;
            idsClientesCreados.push(clienteCreado.id);
            clientesPorAsignar.push({
              clienteId: clienteCreado.id,
              rutaCodigo: cli.rutaCodigo,
            });
          }

          // Asignación a ruta. La ruta la llevan los créditos, así que aquí
          // solo se deja lista la asignación de la ruta que trae el archivo;
          // las de otras rutas se recalculan al final, cuando ya se sabe qué
          // créditos quedaron en cada una.
          const clientesConRuta = new Map<string, string>();

          for (const asignacion of clientesPorAsignar) {
            if (!asignacion.rutaCodigo) continue;

            const ruta = await tx.ruta.findFirst({
              where: { codigo: asignacion.rutaCodigo, eliminadoEn: null },
              select: { id: true, cobradorId: true },
            });

            if (!ruta) continue;

            clientesConRuta.set(asignacion.clienteId, ruta.id);

            const yaAsignado = await tx.asignacionRuta.findFirst({
              where: {
                clienteId: asignacion.clienteId,
                rutaId: ruta.id,
                fechaEspecifica: null,
              },
              select: { id: true },
            });

            if (yaAsignado) {
              await tx.asignacionRuta.update({
                where: { id: yaAsignado.id },
                data: { activa: true, cobradorId: ruta.cobradorId },
              });
            } else {
              await tx.asignacionRuta.create({
                data: {
                  rutaId: ruta.id,
                  clienteId: asignacion.clienteId,
                  cobradorId: ruta.cobradorId,
                  activa: true,
                },
              });
            }

            clientesAsignadosARuta++;
          }

          // V2.3 usa CAJA-OFICINA como caja institucional para importaciones administrativas.
          // La resolución por caja de ruta queda pendiente para una fase posterior.
          const cajaOficina = await tx.caja.findFirst({
            where: { codigo: 'CAJA-OFICINA' },
          });

          let saldoDisponibleCajaOficina = cajaOficina
            ? Number(cajaOficina.saldoActual || 0)
            : 0;

          // Procesar créditos
          const creditos: any[] = (resultado as any).creditos ?? [];
          const roundMoney = (value: number) => pesos(value);
          const hayCreditoOperativoEfectivo = creditos.some(
            (cred) =>
              cred.tipoCarga === 'OPERATIVA' &&
              cred.descontarCaja === 'SI' &&
              cred.tipoPrestamo === 'EFECTIVO',
          );

          if (hayCreditoOperativoEfectivo) {
            mensajes.push(
              'V2.3 usa CAJA-OFICINA como caja institucional para créditos operativos importados.',
            );
          }

          for (const cred of creditos) {
            const isHistorica =
              cred.tipoCarga === 'HISTORICA' && cred.descontarCaja === 'NO';
            const isOperativaEfectivo =
              cred.tipoCarga === 'OPERATIVA' &&
              cred.descontarCaja === 'SI' &&
              cred.tipoPrestamo === 'EFECTIVO';
            // Un crédito de artículo entrega mercancía, no efectivo: descuenta
            // stock y registra la venta, en vez de desembolsar de la caja.
            const isOperativaArticulo =
              cred.tipoCarga === 'OPERATIVA' &&
              cred.tipoPrestamo === 'ARTICULO';

            if (!isHistorica && !isOperativaEfectivo && !isOperativaArticulo) {
              creditosNoSoportados++;
              if (
                cred.tipoCarga === 'OPERATIVA' &&
                cred.descontarCaja === 'NO'
              ) {
                mensajes.push(
                  `Fila ${cred.fila}: La importación operativa sin afectación de caja se implementará en una fase posterior.`,
                );
              }
              continue;
            }

            if (isOperativaEfectivo && cred.cuotaInicial > 0) {
              creditosNoSoportados++;
              mensajes.push(
                `Fila ${cred.fila}: La cuota inicial en créditos operativos de efectivo aún no está soportada.`,
              );
              continue;
            }

            // Idempotencia de préstamo
            const prestamoExistente = await tx.prestamo.findFirst({
              where: {
                OR: [
                  { numeroPrestamo: cred.numeroPrestamo },
                  { idempotencyKey: cred.codigoImp },
                ],
              },
              select: { id: true, cantidadCuotas: true },
            });

            if (!cred.esActualizacion && prestamoExistente) {
              creditosOmitidos++;
              continue;
            }

            // Buscar cliente
            const cliente = await tx.cliente.findUnique({
              where: { dni: cred.ccCliente },
              select: { id: true },
            });

            if (!cliente) {
              // El cliente debería existir si pasó la validación, si no, omitimos por seguridad
              creditosOmitidos++;
              continue;
            }

            if (isOperativaEfectivo) {
              if (!cajaOficina) {
                throw new BadRequestException(
                  'No se encontró la caja institucional CAJA-OFICINA para desembolsos importados.',
                );
              }
              if (!cajaOficina.activa) {
                throw new BadRequestException(
                  'La caja CAJA-OFICINA no está activa.',
                );
              }
              const montoDesembolso = Number(cred.monto);
              if (saldoDisponibleCajaOficina < montoDesembolso) {
                throw new BadRequestException(
                  `La caja CAJA-OFICINA no tiene saldo suficiente para confirmar el crédito operativo (Fila ${cred.fila}). Saldo disponible: ${saldoDisponibleCajaOficina}, Monto: ${montoDesembolso}`,
                );
              }

              // Solo control acumulado para validar el lote completo.
              // El movimiento real de caja lo hace ledgerService.registrarDesembolso()
              // dentro de esta misma transacción mediante cajaDelta.
              saldoDisponibleCajaOficina = roundMoney(
                saldoDisponibleCajaOficina - montoDesembolso,
              );
            }

            let productoId: string | undefined;
            let precioProductoId: string | undefined;
            let precioVentaArticulo: number | undefined;
            let costoArticulo: number | undefined;
            let margenArticulo: number | undefined;

            if (cred.tipoPrestamo === 'ARTICULO') {
              const producto = await tx.producto.findUnique({
                where: { codigo: cred.productoCodigo },
                select: {
                  id: true,
                  costo: true,
                  precios: {
                    where: {
                      meses: plazoMesesPersistido(Number(cred.plazoMeses)),
                      activo: true,
                    },
                    select: {
                      id: true,
                      precio: true,
                    },
                    take: 1,
                  },
                },
              });

              if (producto) {
                productoId = producto.id;
                precioProductoId = producto.precios[0]?.id;
                precioVentaArticulo = producto.precios[0]?.precio
                  ? Number(producto.precios[0].precio)
                  : undefined;
                costoArticulo = producto.costo
                  ? Number(producto.costo)
                  : undefined;
                if (
                  precioVentaArticulo !== undefined &&
                  costoArticulo !== undefined
                ) {
                  margenArticulo = precioVentaArticulo - costoArticulo;
                }
              }
              // Nota V2.2: Para históricos, no bloqueamos si no hay precioProducto (precioProductoId/margen pueden quedar null).
              // El crédito se crea porque el monto real ya viene dado en el Excel.
            }

            // Cálculos financieros
            const monto = Number(cred.monto);
            // Fraccionario para calcular el interés, entero para guardar: es lo
            // mismo que hace createLoan, donde la columna plazoMeses es Int.
            const plazoMeses = Number(cred.plazoMeses);
            const plazoMesesGuardado = Number(
              cred.plazoMesesPersistir ?? plazoMesesPersistido(plazoMeses),
            );
            const tasaInteres = Number(cred.tasaInteres);
            const cantidadCuotas = Number(cred.cantidadCuotas);

            // El interés depende del método elegido: Interés simple aplica la tasa
            // por cada mes de plazo, y Amortización una sola vez sobre el capital.
            const interesTotal = calcularInteresTotal(
              cred.tipoAmortizacion || TIPO_AMORTIZACION_POR_DEFECTO,
              monto,
              tasaInteres,
              plazoMeses,
            );
            const totalPrestamo = roundMoney(monto + interesTotal);

            // Pre-calcular fechas de cuotas
            const fechasCuotas: Date[] = [];
            const fechaVencimiento = new Date(
              cred.fechaPrimerCobro || cred.fechaCredito,
            );

            for (let i = 1; i <= cantidadCuotas; i++) {
              fechasCuotas.push(new Date(fechaVencimiento));
              if (cred.frecuenciaPago === 'MENSUAL') {
                fechaVencimiento.setMonth(fechaVencimiento.getMonth() + 1);
              } else if (cred.frecuenciaPago === 'QUINCENAL') {
                fechaVencimiento.setDate(fechaVencimiento.getDate() + 15);
              } else if (cred.frecuenciaPago === 'SEMANAL') {
                fechaVencimiento.setDate(fechaVencimiento.getDate() + 7);
              } else if (cred.frecuenciaPago === 'DIARIO') {
                fechaVencimiento.setDate(fechaVencimiento.getDate() + 1);
              }
            }

            const fechaFin = fechasCuotas[fechasCuotas.length - 1];

            const planCuotas: PlanCuota[] = construirPlanCuotas({
              tipoAmortizacion:
                cred.tipoAmortizacion || TIPO_AMORTIZACION_POR_DEFECTO,
              monto,
              interesTotal,
              cantidadCuotas,
              fechasVencimiento: fechasCuotas,
            });

            // Créditos que ya venían cobrándose antes de usar el sistema.
            const avance = aplicarAvanceHistorico(
              planCuotas,
              Number(cred.cuotasPagadas || 0),
              Number(cred.abonoAdicional || 0),
              cred.fechaUltimoPago || null,
            );

            if (avance.montoNoAplicado > 0) {
              mensajes.push(
                `Fila ${cred.fila}: quedaron ${avance.montoNoAplicado} sin aplicar porque superaban el total del crédito.`,
              );
            }

            const saldoPendiente = roundMoney(
              totalPrestamo - avance.totalPagado,
            );
            const estadoPrestamo = resolverEstadoPrestamoImportado(
              planCuotas,
              saldoPendiente,
            );

            if (avance.cuotasPagadas > 0 || avance.totalPagado > 0) {
              creditosAvanzados++;
            }

            if (cred.esActualizacion) {
              if (!prestamoExistente) {
                creditosOmitidos++;
                continue;
              }

              // Un crédito con movimientos de caja o asientos contables no se puede
              // reescribir por Excel: habría que reversar contabilidad.
              const movimientos = await tx.transaccion.count({
                where: {
                  tipoReferencia: 'PRESTAMO',
                  referenciaId: prestamoExistente.id,
                },
              });

              if (movimientos > 0) {
                creditosNoSoportados++;
                mensajes.push(
                  `Fila ${cred.fila}: el crédito ${cred.numeroPrestamo} tiene movimientos de caja registrados y no se puede actualizar por importación.`,
                );
                continue;
              }

              if (Number(prestamoExistente.cantidadCuotas) !== cantidadCuotas) {
                creditosNoSoportados++;
                mensajes.push(
                  `Fila ${cred.fila}: no se puede cambiar la cantidad de cuotas de ${prestamoExistente.cantidadCuotas} a ${cantidadCuotas} por importación.`,
                );
                continue;
              }

              await tx.prestamo.update({
                where: { id: prestamoExistente.id },
                data: {
                  monto,
                  tasaInteres,
                  tasaInteresMora: cred.tasaInteresMora ?? 0,
                  plazoMeses: plazoMesesGuardado,
                  tipoAmortizacion:
                    cred.tipoAmortizacion || TIPO_AMORTIZACION_POR_DEFECTO,
                  interesTotal,
                  saldoPendiente,
                  totalPagado: avance.totalPagado,
                  capitalPagado: avance.capitalPagado,
                  interesPagado: avance.interesPagado,
                  estado: estadoPrestamo,
                  garantia: cred.garantia || null,
                  notas: cred.notas || null,
                  cuotaInicial: cred.cuotaInicial || 0,
                },
              });

              // Se reescriben las cuotas en su sitio; no hay pagos que las
              // referencien, porque eso ya se rechazó al validar.
              for (const cuota of planCuotas) {
                await tx.cuota.updateMany({
                  where: {
                    prestamoId: prestamoExistente.id,
                    numeroCuota: cuota.numeroCuota,
                  },
                  data: {
                    fechaVencimiento: cuota.fechaVencimiento,
                    monto: cuota.monto,
                    montoCapital: cuota.montoCapital,
                    montoInteres: cuota.montoInteres,
                    estado: cuota.estado,
                    montoPagado: cuota.montoPagado,
                    fechaPago: cuota.fechaPago,
                  },
                });
              }

              creditosActualizados++;
              idsPrestamosActualizados.push(prestamoExistente.id);
              if (avance.cuotasPagadas > 0) creditosAvanzados++;
              cuotasPagadasImportadas += avance.cuotasPagadas;
              continue;
            }

            const prestamo = await tx.prestamo.create({
              data: {
                numeroPrestamo: cred.numeroPrestamo,
                idempotencyKey: cred.codigoImp,
                clienteId: cliente.id,
                productoId,
                precioProductoId,
                precioVentaArticulo,
                costoArticulo,
                margenArticulo,
                tipoPrestamo: cred.tipoPrestamo,
                tipoAmortizacion:
                  cred.tipoAmortizacion || TIPO_AMORTIZACION_POR_DEFECTO,
                monto,
                tasaInteres,
                tasaInteresMora: cred.tasaInteresMora || 0,
                plazoMeses: plazoMesesGuardado,
                frecuenciaPago: cred.frecuenciaPago,
                cantidadCuotas,
                fechaInicio: cred.fechaCredito,
                fechaPrimerCobro: cred.fechaPrimerCobro || cred.fechaCredito,
                fechaFin,
                estado: estadoPrestamo,
                creadoPorId,
                aprobadoPorId: creadoPorId,
                estadoAprobacion: 'APROBADO',
                interesTotal,
                saldoPendiente,
                totalPagado: avance.totalPagado,
                capitalPagado: avance.capitalPagado,
                interesPagado: avance.interesPagado,
                interesMoraPagado: 0,

                // Nota V2.2: En importación histórica, cuotaInicial se conserva como dato informativo
                // y no reduce el saldoPendiente ni el cálculo de cuotas históricas.
                cuotaInicial: cred.cuotaInicial || 0,
                estadoSincronizacion: 'PENDIENTE',
                garantia: cred.garantia || null,
                notas: cred.notas || null,
              },
            });

            idsPrestamosCreados.push(prestamo.id);

            if (isOperativaEfectivo || isOperativaArticulo) {
              creditosOperativosCreados++;
            } else {
              creditosHistoricosCreados++;
            }

            // ── Crédito operativo de artículo: sale mercancía, no efectivo ──
            if (isOperativaArticulo) {
              if (!productoId) {
                throw new BadRequestException(
                  `Fila ${cred.fila}: no se encontró el artículo ${cred.productoCodigo} para descontar del inventario.`,
                );
              }

              // updateMany con la guarda de stock: si otro proceso vendió la
              // última unidad, el count queda en 0 y se aborta el lote.
              const descuento = await tx.producto.updateMany({
                where: { id: productoId, stock: { gt: 0 } },
                data: { stock: { decrement: 1 } },
              });

              if (descuento.count !== 1) {
                throw new BadRequestException(
                  `Fila ${cred.fila}: el artículo ${cred.productoCodigo} no tiene stock disponible.`,
                );
              }

              articulosDescontados++;

              const inicial = Number(cred.cuotaInicial || 0);
              const precioVenta =
                precioVentaArticulo ?? roundMoney(monto + inicial);

              // La cuota inicial entra en efectivo a la caja de oficina.
              if (inicial > 0 && cajaOficina) {
                await tx.transaccion.create({
                  data: {
                    numeroTransaccion: `IMP-INI-${prestamo.id.slice(0, 24)}`,
                    idempotencyKey: `IMP-INICIAL-${prestamo.id}`,
                    cajaId: cajaOficina.id,
                    clienteId: cliente.id,
                    tipo: 'INGRESO',
                    monto: inicial,
                    descripcion: `Cuota inicial de crédito de artículo importado #${cred.numeroPrestamo}`,
                    creadoPorId,
                    tipoReferencia: 'PRESTAMO',
                    referenciaId: prestamo.id,
                  },
                });
                transaccionesCreadas++;
              }

              const asiento = await this.ledgerService.registrarVentaArticulo(
                {
                  prestamoId: prestamo.id,
                  precioVenta,
                  costoArticulo: costoArticulo ?? 0,
                  montoFinanciado: monto,
                  cuotaInicial: inicial,
                  cajaId: inicial > 0 ? cajaOficina?.id : undefined,
                  accountCodeCaja:
                    inicial > 0 && cajaOficina
                      ? this.getAccountCodeCaja(cajaOficina)
                      : undefined,
                  createdBy: creadoPorId,
                },
                tx,
              );
              if (asiento) asientosCreados++;
            }

            // Si es operativo, registrar transacción de desembolso
            if (isOperativaEfectivo && cajaOficina) {
              const montoDesembolso = Number(cred.monto);
              const transaccion = await tx.transaccion.create({
                data: {
                  numeroTransaccion: `IMP-DES-${prestamo.id.slice(0, 24)}`,
                  idempotencyKey: `IMP-DESEMBOLSO-${prestamo.id}`,
                  cajaId: cajaOficina.id,
                  clienteId: cliente.id,
                  tipo: 'EGRESO',
                  monto: montoDesembolso,
                  descripcion: `Desembolso de crédito operativo importado #${cred.numeroPrestamo}`,
                  creadoPorId,
                  tipoReferencia: 'PRESTAMO',
                  referenciaId: prestamo.id,
                },
              });
              transaccionesCreadas++;

              const accountCodeOrigen = this.getAccountCodeCaja(cajaOficina);

              const journalEntry = await this.ledgerService.registrarDesembolso(
                {
                  prestamoId: prestamo.id,
                  monto: montoDesembolso,
                  cajaOrigenId: cajaOficina.id,
                  accountCodeOrigen,
                  createdBy: creadoPorId,
                },
                tx,
              );
              if (journalEntry) {
                asientosCreados++;
              }
            }

            // Crear cuotas con el estado que ya traen del cobro previo.
            // Se insertan en bloque: una cartera real son miles de cuotas, y una
            // inserción por cuota agota el tiempo de la transacción.
            await tx.cuota.createMany({
              data: planCuotas.map((cuota) => ({
                prestamoId: prestamo.id,
                numeroCuota: cuota.numeroCuota,
                fechaVencimiento: cuota.fechaVencimiento,
                monto: cuota.monto,
                montoCapital: cuota.montoCapital,
                montoInteres: cuota.montoInteres,
                montoInteresMora: 0,
                estado: cuota.estado,
                montoPagado: cuota.montoPagado,
                fechaPago: cuota.fechaPago,
              })),
            });
            cuotasCreadas += planCuotas.length;
            cuotasPagadasImportadas += planCuotas.filter(
              (cuota) => cuota.estado === 'PAGADA',
            ).length;
          }

          // La ruta la lleva el crédito: se le pone la del cliente y luego se
          // recalculan sus asignaciones, para no sacarlo de rutas donde
          // todavía tiene créditos de otra importación.
          if (clientesConRuta.size > 0 && idsPrestamosCreados.length > 0) {
            const porRuta = new Map<string, string[]>();
            for (const [clienteId, rutaId] of clientesConRuta) {
              const lista = porRuta.get(rutaId) || [];
              lista.push(clienteId);
              porRuta.set(rutaId, lista);
            }

            for (const [rutaId, clienteIds] of porRuta) {
              await tx.prestamo.updateMany({
                where: {
                  id: { in: idsPrestamosCreados },
                  clienteId: { in: clienteIds },
                },
                data: { rutaId },
              });
            }
          }

          for (const clienteId of clientesConRuta.keys()) {
            await sincronizarAsignacionesCliente(tx, clienteId);
          }

          // 4. Registrar lote confirmado dentro de la transacción
          const lote = await tx.importacionLote.create({
            data: {
              tipo: 'CLIENTES_CREDITOS',
              estado: 'CONFIRMADO',
              nombreArchivo: file.originalname,
              totalFilas: resultado.resumen.totalFilas,
              filasValidas: resultado.resumen.filasValidas,
              filasConError: resultado.resumen.filasConError,
              advertencias: resultado.resumen.advertencias,
              // Se registra qué creó este lote para poder deshacerlo después.
              resumen: {
                ...resultado.resumen,
                creado: {
                  clientes: idsClientesCreados,
                  prestamos: idsPrestamosCreados,
                  clientesActualizados: idsClientesActualizados,
                  prestamosActualizados: idsPrestamosActualizados,
                  conMovimientosContables: creditosOperativosCreados > 0,
                },
              } as any,
              creadoPorId,
              confirmadoEn: new Date(),
            },
          });
          loteId = lote.id;
        },
        // Migrar una cartera completa no cabe en los 5 s que Prisma da por
        // defecto a una transacción interactiva.
        { maxWait: 60_000, timeout: 600_000 },
      );
    } catch (error) {
      await this.prisma.importacionLote.create({
        data: {
          tipo: 'CLIENTES_CREDITOS',
          estado: 'FALLIDO',
          nombreArchivo: file.originalname,
          totalFilas: resultado.resumen.totalFilas,
          filasValidas: resultado.resumen.filasValidas,
          filasConError: resultado.resumen.filasConError,
          advertencias: resultado.resumen.advertencias,
          resumen: resultado.resumen as any,
          errores: [
            {
              hoja: 'GLOBAL',
              fila: 0,
              campo: 'confirmacion',
              mensaje:
                error instanceof Error
                  ? error.message
                  : 'Error inesperado confirmando importación',
              valor: null,
            },
          ] as any,
          creadoPorId,
        },
      });

      throw error;
    }

    mensajes.push('Clientes y créditos confirmados correctamente.');

    return {
      loteId,
      clientesCreados,
      clientesActualizados,
      clientesOmitidos,
      clientesAsignadosARuta,
      creditosHistoricosCreados,
      creditosOperativosCreados,
      creditosOmitidos,
      creditosNoSoportados,
      creditosActualizados,
      articulosDescontados,
      creditosAvanzados,
      cuotasPagadasImportadas,
      transaccionesCreadas,
      asientosCreados,
      cuotasCreadas,
      mensajes,
      resumen: resultado.resumen,
    };
  }
}
