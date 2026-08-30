import { Prisma } from '@prisma/client';

/**
 * La ruta la lleva el crédito (`Prestamo.rutaId`). `AsignacionRuta` se queda
 * como el orden de visita del cobrador, derivado de los créditos que la ruta
 * tiene de ese cliente.
 *
 * Deja una asignación activa por cada ruta donde el cliente tenga algún
 * crédito, y desactiva las de las rutas donde ya no tiene ninguno.
 *
 * Antes se desactivaban TODAS las asignaciones del cliente al asignarle una
 * ruta, así que mandar su segundo crédito a otra ruta lo sacaba de la primera
 * y el cobrador de aquella dejaba de verlo aunque le siguiera debiendo.
 */
export async function sincronizarAsignacionesCliente(
  tx: Prisma.TransactionClient,
  clienteId: string,
): Promise<void> {
  const creditos = await tx.prestamo.findMany({
    where: { clienteId, eliminadoEn: null, rutaId: { not: null } },
    select: { rutaId: true },
    distinct: ['rutaId'],
  });

  const rutasConCredito = new Set(
    creditos.map((c) => c.rutaId).filter((id): id is string => Boolean(id)),
  );

  const asignaciones = await tx.asignacionRuta.findMany({
    where: { clienteId },
    orderBy: [{ activa: 'desc' }, { creadoEn: 'asc' }],
  });

  const yaCubiertas = new Set<string>();

  for (const asignacion of asignaciones) {
    // Solo la primera de cada ruta puede quedar activa: hay un único parcial
    // sobre (rutaId, clienteId) donde activa = true.
    const debeEstarActiva =
      rutasConCredito.has(asignacion.rutaId) &&
      !yaCubiertas.has(asignacion.rutaId);

    if (debeEstarActiva) yaCubiertas.add(asignacion.rutaId);

    if (asignacion.activa !== debeEstarActiva) {
      await tx.asignacionRuta.update({
        where: { id: asignacion.id },
        data: { activa: debeEstarActiva },
      });
    }
  }

  for (const rutaId of rutasConCredito) {
    if (yaCubiertas.has(rutaId)) continue;

    const ruta = await tx.ruta.findUnique({
      where: { id: rutaId },
      select: { cobradorId: true },
    });
    if (!ruta?.cobradorId) continue;

    const maxOrden = await tx.asignacionRuta.aggregate({
      where: { rutaId, activa: true },
      _max: { ordenVisita: true },
    });

    await tx.asignacionRuta.create({
      data: {
        rutaId,
        clienteId,
        cobradorId: ruta.cobradorId,
        ordenVisita: (maxOrden._max.ordenVisita || 0) + 1,
        activa: true,
      },
    });
  }
}
