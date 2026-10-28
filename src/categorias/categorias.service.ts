import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCategoriaDto,
  UpdateCategoriaDto,
} from './dto/create-categoria.dto';

@Injectable()
export class CategoriasService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateCategoriaDto) {
    return this.prisma.categoria.create({
      data: {
        ...data,
      },
    });
  }

  async findAll(tipo?: string) {
    return this.prisma.categoria.findMany({
      where: {
        // `tipo: ''` traería cero resultados y la pantalla saldría vacía; Prisma
        // ignora un `undefined`.
        tipo: tipo || undefined,
        activa: true,
        eliminadoEn: null,
      },
      orderBy: { nombre: 'asc' },
    });
  }

  /**
   * Una categoría archivada ya no existe para quien consulta.
   *
   * Antes esto era un `findUnique({ where: { id } })` sin filtro: `findAll`
   * descartaba las borradas y esto no, así que una categoría eliminada
   * desaparecía del listado pero seguía siendo consultable por su id, y la
   * pantalla que la leyera así la pintaba como si viviera.
   *
   * Se dejó abierto un tiempo por si algún sitio necesitaba leer una archivada
   * —el detalle de un artículo viejo, un reporte histórico—. Rastreado: no hay
   * ninguno. `GET /categorias/:id` no se llama desde el frontend ni desde el
   * propio backend; el servicio del frontend solo expone `obtenerTodas`, `crear`
   * y `eliminar`. Así que el hueco no protegía a nadie.
   *
   * Y ahora avisa en vez de devolver `null`: un `null` llegaba al controlador
   * como un 200 con cuerpo vacío, que quien llama lee como "la categoría existe
   * y no tiene datos".
   */
  async findOne(id: string) {
    const categoria = await this.prisma.categoria.findFirst({
      where: { id, eliminadoEn: null },
    });

    if (!categoria) {
      throw new NotFoundException(`No existe la categoría ${id}.`);
    }

    return categoria;
  }

  /**
   * No se puede modificar una categoría archivada sin restaurarla antes.
   *
   * Mismo hueco que en `findOne`, del lado de la escritura: nada impedía revivir
   * campos de una categoría borrada. `findOne` hace de guardia y además da el 404
   * en vez del error crudo de Prisma que salía al actualizar un id inexistente.
   */
  async update(id: string, data: Partial<UpdateCategoriaDto>) {
    await this.findOne(id);

    return this.prisma.categoria.update({
      where: { id },
      data: {
        ...data,
      },
    });
  }

  /**
   * Borrado lógico: el duro rompería los artículos, clientes y gastos que ya
   * apuntan a esta categoría.
   *
   * Pasa por `findOne`, así que borrar dos veces no reescribe la fecha del
   * primer borrado con la de hoy, que es perder cuándo se archivó de verdad.
   */
  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.categoria.update({
      where: { id },
      data: {
        activa: false,
        eliminadoEn: new Date(),
      },
    });
  }
}
