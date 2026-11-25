/**
 * La actividad de un usuario, contada en español y sin identificadores.
 *
 * ── Lo que se enseñaba ─────────────────────────────────────────────────────
 *
 * El detalle de usuario mostraba la auditoría tal como está en la tabla:
 *
 *     ACTUALIZAR_USUARIO   Usuario fe3e3d3f-00ff-44f9-9f68-fdc40305cffc
 *     CREAR_PRESTAMO       Prestamo b86ee359-c87c-4b7f-8c50-44c620bb5e2e
 *
 * El nombre del enum en mayúsculas y un UUID. Para quien mira la pantalla eso
 * no dice **nada**: ni qué pasó, ni sobre quién.
 *
 * Aquí se traduce la acción a una frase y se resuelve el identificador al
 * nombre de lo que sea —el número del crédito y su cliente, el número del
 * pago y su importe, el nombre de la ruta—. Y si no se puede resolver, **no
 * se enseña el identificador**: se omite. Un UUID en pantalla es ruido, no
 * información.
 */
import { Prisma } from '@prisma/client';

export type TipoDeMovimiento = 'in' | 'out' | 'neutral';

export type ActividadLegible = {
  /** Instante en ISO. El formato lo pone la pantalla. */
  time: string;
  /** La frase en español: «Registró un pago». */
  action: string;
  /** Sobre qué: «Crédito CR-0012 · Juan Pérez». Vacío si no se pudo resolver. */
  detail: string;
  /** El importe ya formateado, cuando lo hay. */
  amount?: string;
  type: TipoDeMovimiento;
};

/**
 * La frase de cada acción.
 *
 * Las claves son las que el backend escribe de verdad: salen de barrer
 * `accion: '...'` en todo `src/`. `actividad-legible.spec.ts` comprueba que no
 * falte ninguna, así que si alguien añade una acción nueva y no la traduce, la
 * prueba lo dice.
 */
export const FRASES: Record<string, string> = {
  // Créditos
  CREAR_PRESTAMO: 'Creó un crédito',
  ACTUALIZAR_PRESTAMO: 'Modificó un crédito',
  APROBAR_PRESTAMO: 'Aprobó un crédito',
  RECHAZAR_PRESTAMO: 'Rechazó un crédito',
  ARCHIVAR_PRESTAMO: 'Archivó un crédito',
  RESTAURAR_PRESTAMO: 'Restauró un crédito',
  ELIMINAR_PRESTAMO: 'Eliminó un crédito',

  // Dinero
  REGISTRAR_PAGO: 'Registró un pago',
  PAGO: 'Registró un pago',
  REVERSAR_PAGO: 'Reversó un pago',
  ASIGNAR_MORA: 'Asignó mora',
  MORA_PROCESADA: 'Procesó la mora del día',

  // Clientes
  CREAR_CLIENTE: 'Creó un cliente',
  RECHAZAR_CLIENTE: 'Rechazó un cliente',
  ARCHIVAR_CLIENTE: 'Archivó un cliente',
  RESTAURAR_CLIENTE: 'Restauró un cliente',
  ELIMINAR_CLIENTE: 'Eliminó un cliente',
  ALERTA_CLIENTE_NO_UBICADO: 'Reportó un cliente no ubicado',
  VISITA_REGISTRADA: 'Registró una visita',

  // Rutas y jornada
  CREAR_RUTA: 'Creó una ruta',
  JORNADA_CERRADA_REGULARIZADA: 'Regularizó una jornada cerrada',

  // Usuarios y accesos
  CREAR_USUARIO: 'Creó un usuario',
  ACTUALIZAR_USUARIO: 'Modificó un usuario',
  ARCHIVAR_USUARIO: 'Archivó un usuario',
  RESTAURAR_USUARIO: 'Restauró un usuario',
  OCULTAR_USUARIO_ARCHIVADO: 'Ocultó un usuario archivado',
  RESETEAR_CONTRASENA: 'Restableció una contraseña',
  PERMISOS_ACTUALIZADOS: 'Cambió permisos',
  TOGGLE_ESTADO: 'Activó o desactivó un usuario',

  // Prórrogas y reprogramaciones
  APROBAR_PRORROGA: 'Aprobó una prórroga',
  REVERTIR_PRORROGA: 'Revirtió una prórroga',
  REPROGRAMACION_SOLICITADA: 'Solicitó reprogramar una cuota',
  REPROGRAMACION_APROBADA: 'Aprobó una reprogramación',
  REPROGRAMACION_RECHAZADA: 'Rechazó una reprogramación',

  // Inventario
  INVENTARIO_ACTUALIZADO: 'Actualizó el inventario',

  // Genéricas (el módulo que las escribe ya dice la entidad)
  CREAR: 'Creó un registro',
  CREADO: 'Creó un registro',
  ACTUALIZAR: 'Modificó un registro',
  ACTUALIZADO: 'Modificó un registro',
  ELIMINAR: 'Eliminó un registro',
  ARCHIVAR: 'Archivó un registro',
  RESTAURAR: 'Restauró un registro',
  APROBAR: 'Aprobó una solicitud',
  APROBADO: 'Aprobó una solicitud',
  RECHAZAR: 'Rechazó una solicitud',
  RECHAZADO: 'Rechazó una solicitud',
  CONFIRMAR: 'Confirmó una solicitud',
  REENVIAR: 'Reenvió una solicitud',
  REVERTIR: 'Revirtió una operación',
  EXISTENTE: 'Reutilizó un registro existente',

  // Consultas (quedan registradas por auditoría de acceso)
  AUDIT_VIEW: 'Consultó la auditoría',
  CONTABLE_VIEW: 'Consultó la contabilidad',
  ARTICULOS_VIEW: 'Consultó los artículos',
  CREDITOS_ARTICULOS_VIEW: 'Consultó los créditos de artículos',
  CUENTAS_VENCIDAS_VIEW: 'Consultó las cuentas vencidas',
  REPORTES_FINANCIEROS_VIEW: 'Consultó los reportes financieros',
};

/** El dinero entra, sale, o la acción no mueve dinero. */
const TIPOS: Record<string, TipoDeMovimiento> = {
  REGISTRAR_PAGO: 'in',
  PAGO: 'in',
  REVERSAR_PAGO: 'out',
  CREAR_PRESTAMO: 'out',
  APROBAR_PRESTAMO: 'out',
};

/**
 * La frase de una acción, o una legible aunque no esté en la tabla.
 *
 * El respaldo NO devuelve el enum en crudo: convierte `ALGO_RARO` en «Algo
 * raro». Peor que una frase imprecisa es un `ALGO_RARO` en la cara.
 */
export function frasePorAccion(accion: string): string {
  const clave = String(accion || '').toUpperCase();
  if (FRASES[clave]) return FRASES[clave];
  if (!clave) return 'Actividad';
  const palabras = clave.toLowerCase().replace(/_/g, ' ');
  return palabras.charAt(0).toUpperCase() + palabras.slice(1);
}

export function tipoPorAccion(accion: string): TipoDeMovimiento {
  return TIPOS[String(accion || '').toUpperCase()] ?? 'neutral';
}

/** Un importe en pesos, como se escribe aquí. */
export function comoPesos(valor: Prisma.Decimal | number | null | undefined) {
  const n = Number(valor ?? 0);
  if (!Number.isFinite(n) || n === 0) return undefined;
  return `$ ${n.toLocaleString('es-CO')}`;
}

/**
 * La entidad, normalizada.
 *
 * En la base conviven `Prestamo` y `PRESTAMO`, `Transaccion` y `TRANSACCION`:
 * los módulos no se pusieron de acuerdo. Comparar sin normalizar dejaba la
 * mitad de los registros sin resolver.
 */
export function normalizarEntidad(entidad: string | null | undefined) {
  return String(entidad || '')
    .trim()
    .toUpperCase();
}

/** Lo mínimo que se necesita de Prisma para resolver nombres. */
export type ClienteDeConsulta = {
  prestamo: { findMany: (args: unknown) => Promise<unknown[]> };
  pago: { findMany: (args: unknown) => Promise<unknown[]> };
  cliente: { findMany: (args: unknown) => Promise<unknown[]> };
  ruta: { findMany: (args: unknown) => Promise<unknown[]> };
  usuario: { findMany: (args: unknown) => Promise<unknown[]> };
  transaccion: { findMany: (args: unknown) => Promise<unknown[]> };
  gasto: { findMany: (args: unknown) => Promise<unknown[]> };
};

type Resuelto = { texto: string; importe?: string };

/**
 * Resuelve en BLOQUE los identificadores de la auditoría a nombres.
 *
 * En bloque y no uno a uno: son hasta una consulta por tipo de entidad, no una
 * por fila. Con doce registros de actividad eso es la diferencia entre doce
 * viajes a la base y cinco.
 *
 * Lo que no se pueda resolver se queda sin texto, y la pantalla no enseña
 * nada: un UUID no es informacion.
 */
export async function resolverNombres(
  db: ClienteDeConsulta,
  registros: Array<{ entidad: string | null; entidadId: string | null }>,
): Promise<Map<string, Resuelto>> {
  const porEntidad = new Map<string, Set<string>>();
  for (const r of registros) {
    const e = normalizarEntidad(r.entidad);
    const id = (r.entidadId || '').trim();
    if (!e || !id) continue;
    if (!porEntidad.has(e)) porEntidad.set(e, new Set());
    porEntidad.get(e)!.add(id);
  }

  const resueltos = new Map<string, Resuelto>();
  const clave = (entidad: string, id: string) => `${entidad}:${id}`;
  const ids = (entidad: string) => [...(porEntidad.get(entidad) ?? [])];

  const tareas: Array<Promise<void>> = [];

  if (ids('PRESTAMO').length) {
    tareas.push(
      (async () => {
        const filas = (await db.prestamo.findMany({
          where: { id: { in: ids('PRESTAMO') } },
          select: {
            id: true,
            numeroPrestamo: true,
            monto: true,
            cliente: { select: { nombres: true, apellidos: true } },
          },
        })) as Array<{
          id: string;
          numeroPrestamo: string | null;
          monto: Prisma.Decimal | null;
          cliente: { nombres: string; apellidos: string } | null;
        }>;
        for (const f of filas) {
          const quien = f.cliente
            ? `${f.cliente.nombres} ${f.cliente.apellidos}`.trim()
            : '';
          resueltos.set(clave('PRESTAMO', f.id), {
            texto: [
              f.numeroPrestamo ? `Crédito ${f.numeroPrestamo}` : 'Crédito',
              quien,
            ]
              .filter(Boolean)
              .join(' · '),
            importe: comoPesos(f.monto),
          });
        }
      })(),
    );
  }

  if (ids('PAGO').length) {
    tareas.push(
      (async () => {
        const filas = (await db.pago.findMany({
          where: { id: { in: ids('PAGO') } },
          select: {
            id: true,
            numeroPago: true,
            montoTotal: true,
            cliente: { select: { nombres: true, apellidos: true } },
          },
        })) as Array<{
          id: string;
          numeroPago: string | null;
          montoTotal: Prisma.Decimal | null;
          cliente: { nombres: string; apellidos: string } | null;
        }>;
        for (const f of filas) {
          const quien = f.cliente
            ? `${f.cliente.nombres} ${f.cliente.apellidos}`.trim()
            : '';
          resueltos.set(clave('PAGO', f.id), {
            texto: [f.numeroPago ? `Pago ${f.numeroPago}` : 'Pago', quien]
              .filter(Boolean)
              .join(' · '),
            importe: comoPesos(f.montoTotal),
          });
        }
      })(),
    );
  }

  if (ids('CLIENTE').length) {
    tareas.push(
      (async () => {
        const filas = (await db.cliente.findMany({
          where: { id: { in: ids('CLIENTE') } },
          select: { id: true, nombres: true, apellidos: true, codigo: true },
        })) as Array<{
          id: string;
          nombres: string;
          apellidos: string;
          codigo: string | null;
        }>;
        for (const f of filas) {
          resueltos.set(clave('CLIENTE', f.id), {
            texto:
              `${f.nombres} ${f.apellidos}`.trim() ||
              `Cliente ${f.codigo ?? ''}`.trim(),
          });
        }
      })(),
    );
  }

  if (ids('RUTA').length) {
    tareas.push(
      (async () => {
        const filas = (await db.ruta.findMany({
          where: { id: { in: ids('RUTA') } },
          select: { id: true, nombre: true, codigo: true },
        })) as Array<{ id: string; nombre: string; codigo: string | null }>;
        for (const f of filas) {
          resueltos.set(clave('RUTA', f.id), {
            texto: [f.nombre, f.codigo].filter(Boolean).join(' · '),
          });
        }
      })(),
    );
  }

  if (ids('USUARIO').length) {
    tareas.push(
      (async () => {
        const filas = (await db.usuario.findMany({
          where: { id: { in: ids('USUARIO') } },
          select: { id: true, nombres: true, apellidos: true },
        })) as Array<{ id: string; nombres: string; apellidos: string }>;
        for (const f of filas) {
          resueltos.set(clave('USUARIO', f.id), {
            texto: `${f.nombres} ${f.apellidos}`.trim(),
          });
        }
      })(),
    );
  }

  if (ids('TRANSACCION').length) {
    tareas.push(
      (async () => {
        const filas = (await db.transaccion.findMany({
          where: { id: { in: ids('TRANSACCION') } },
          select: {
            id: true,
            numeroTransaccion: true,
            monto: true,
            descripcion: true,
          },
        })) as Array<{
          id: string;
          numeroTransaccion: string | null;
          monto: Prisma.Decimal | null;
          descripcion: string | null;
        }>;
        for (const f of filas) {
          resueltos.set(clave('TRANSACCION', f.id), {
            texto: [
              f.numeroTransaccion
                ? `Movimiento ${f.numeroTransaccion}`
                : 'Movimiento',
              f.descripcion ?? '',
            ]
              .filter(Boolean)
              .join(' · '),
            importe: comoPesos(f.monto),
          });
        }
      })(),
    );
  }

  if (ids('GASTO').length) {
    tareas.push(
      (async () => {
        const filas = (await db.gasto.findMany({
          where: { id: { in: ids('GASTO') } },
          select: {
            id: true,
            numeroGasto: true,
            monto: true,
            descripcion: true,
          },
        })) as Array<{
          id: string;
          numeroGasto: string | null;
          monto: Prisma.Decimal | null;
          descripcion: string | null;
        }>;
        for (const f of filas) {
          resueltos.set(clave('GASTO', f.id), {
            texto: [
              f.numeroGasto ? `Gasto ${f.numeroGasto}` : 'Gasto',
              f.descripcion ?? '',
            ]
              .filter(Boolean)
              .join(' · '),
            importe: comoPesos(f.monto),
          });
        }
      })(),
    );
  }

  await Promise.all(tareas);
  return resueltos;
}
