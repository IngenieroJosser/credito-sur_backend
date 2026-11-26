/**
 * Lo que hizo ESTA persona, y lo que tiene a su cargo ahora.
 *
 * ── Por qué existe ──────────────────────────────────────────────────────────
 *
 * El detalle de un usuario enseñaba, para un administrador o un contador, el
 * dinero en caja de toda la empresa, las rutas activas del sistema y el
 * balance del día. Lo dijo el dueño: «¿de qué nos sirve ver el detalle de un
 * usuario si al final nos muestra el detalle de todo el sistema? Para eso veo
 * todo el sistema».
 *
 * Tenía razón, y el código ya lo sabía: la propia pantalla llevaba escrito el
 * letrero «Cifras de todo el sistema, no de esta persona». Eso no es una
 * aclaración, es la confesión de que la ficha no habla de quien la abre.
 *
 * ── Qué se puede atribuir de verdad ─────────────────────────────────────────
 *
 * Esto no se inventa: el esquema ya guarda QUIÉN hizo cada cosa. Barrido
 * sobre `schema.prisma`, los campos que apuntan a un usuario:
 *
 *     Pago.cobradorId              quién registró el cobro
 *     Prestamo.creadoPorId         quién creó el crédito
 *     Prestamo.aprobadoPorId       quién lo aprobó
 *     Cliente.creadoPorId          quién dio de alta al cliente
 *     Cliente.aprobadoPorId        quién lo aprobó
 *     Gasto.cobradorId             quién registró el gasto
 *     Transaccion.creadoPorId      quién movió la caja
 *     ArqueoCaja.creadoPorId       quién cuadró
 *     RegistroVisita.cobradorId    quién visitó
 *     Ruta.cobradorId/supervisorId/coordinadorId   de quién es la ruta
 *
 * Con eso, la misma ficha sirve para los siete roles: no cambia QUÉ se mide,
 * cambia qué sale distinto de cero. Un administrador que aprueba créditos lo
 * enseña; uno que no, no.
 *
 * ── La regla del cero ───────────────────────────────────────────────────────
 *
 * Una cifra en cero solo se muestra cuando el cero es la verdad —la persona
 * podía hacerlo y no lo hizo—. Lo que no forma parte de su trabajo no se
 * pinta en cero: se omite. Un «$ 0 cobrado» en la ficha de un contador no
 * dice «no cobró», dice «esa cifra no es suya».
 */
import { Prisma } from '@prisma/client';

/** Lo mínimo de Prisma que esto necesita, para poder doblarlo en las pruebas. */
export type ClienteDeConteo = {
  pago: {
    aggregate: (args: unknown) => Promise<{
      _count: number;
      _sum: { montoTotal: Prisma.Decimal | null };
    }>;
  };
  prestamo: {
    aggregate: (args: unknown) => Promise<{
      _count: number;
      _sum: { monto: Prisma.Decimal | null };
    }>;
  };
  cliente: { count: (args: unknown) => Promise<number> };
  gasto: {
    aggregate: (args: unknown) => Promise<{
      _count: number;
      _sum: { monto: Prisma.Decimal | null };
    }>;
  };
  transaccion: {
    aggregate: (args: unknown) => Promise<{
      _count: number;
      _sum: { monto: Prisma.Decimal | null };
    }>;
  };
  arqueoCaja: { count: (args: unknown) => Promise<number> };
  registroVisita: { count: (args: unknown) => Promise<number> };
  ruta: { count: (args: unknown) => Promise<number> };
  registroAuditoria: { count: (args: unknown) => Promise<number> };
};

/** Un contador con su importe, cuando el importe tiene sentido. */
export type Cuenta = {
  cantidad: number;
  /** `null` cuando ese recuento no lleva dinero asociado. */
  monto: number | null;
};

export type LoQueHizo = {
  /** Desde cuándo se cuenta, en ISO. */
  desde: string;
  /**
   * Cuántos días abarca, ya contados.
   *
   * Va calculado desde aquí a propósito: si la pantalla lo deduce restando
   * `desde` del reloj, llama a `Date.now()` mientras dibuja —impuro, y el
   * linter lo rechaza— y además el número bailaría entre el servidor y el
   * navegador.
   */
  dias: number;
  pagosRegistrados: Cuenta;
  creditosCreados: Cuenta;
  ventasContado: Cuenta;
  creditosAprobados: Cuenta;
  clientesCreados: Cuenta;
  gastosRegistrados: Cuenta;
  movimientosDeCaja: Cuenta;
  arqueosDeCaja: Cuenta;
  visitasRegistradas: Cuenta;
  accionesEnElSistema: Cuenta;
};

export type LoQueTieneACargo = {
  rutasTotal: number;
  rutasActivas: number;
};

const aNumero = (valor: Prisma.Decimal | null | undefined): number =>
  valor ? Number(valor) : 0;

/**
 * Qué cifras forman parte del trabajo de cada rol.
 *
 * Sirve para decidir si un cero se enseña o se calla. Fuera de esta lista, un
 * recuento en cero se omite; dentro, se enseña, porque ahí el cero informa.
 *
 * El supervisor y el coordinador cobran de verdad —no son roles de consulta—,
 * así que llevan los pagos igual que el cobrador.
 */
/**
 * Las claves que son cifras.
 *
 * `desde` vive en el mismo objeto porque la pantalla necesita decir desde
 * cuándo cuenta, pero es una fecha, no un recuento: sacarla del tipo evita
 * que se cuele en la lista de tarjetas.
 */
export type ClaveDeCifra = Exclude<keyof LoQueHizo, 'desde' | 'dias'>;

export const PROPIO_DEL_ROL: Record<string, ClaveDeCifra[]> = {
  COBRADOR: [
    'pagosRegistrados',
    'gastosRegistrados',
    'visitasRegistradas',
    'arqueosDeCaja',
  ],
  SUPERVISOR: ['pagosRegistrados', 'gastosRegistrados', 'arqueosDeCaja'],
  COORDINADOR: ['pagosRegistrados', 'creditosCreados', 'clientesCreados'],
  PUNTO_DE_VENTA: ['ventasContado', 'creditosCreados', 'clientesCreados'],
  CONTADOR: ['movimientosDeCaja', 'gastosRegistrados', 'arqueosDeCaja'],
  ADMIN: ['creditosAprobados', 'creditosCreados', 'clientesCreados'],
  SUPER_ADMINISTRADOR: ['creditosAprobados', 'movimientosDeCaja'],
};

/**
 * Contar lo que hizo una persona desde una fecha.
 *
 * Consultas en paralelo, todas filtradas por su identificador. No hay
 * ninguna que mire el sistema entero: si una cifra no se puede atribuir a
 * alguien, no pinta nada en su ficha.
 */
export async function loQueHizoLaPersona(
  db: ClienteDeConteo,
  usuarioId: string,
  desde: Date,
  dias: number,
): Promise<LoQueHizo> {
  const [
    pagos,
    creados,
    aprobados,
    clientes,
    gastos,
    movimientos,
    ventas,
    arqueos,
    visitas,
    acciones,
  ] = await Promise.all([
    db.pago.aggregate({
      where: { cobradorId: usuarioId, creadoEn: { gte: desde } },
      _count: true,
      _sum: { montoTotal: true },
    }),
    db.prestamo.aggregate({
      where: {
        creadoPorId: usuarioId,
        creadoEn: { gte: desde },
        eliminadoEn: null,
      },
      _count: true,
      _sum: { monto: true },
    }),
    db.prestamo.aggregate({
      where: {
        aprobadoPorId: usuarioId,
        creadoEn: { gte: desde },
        eliminadoEn: null,
      },
      _count: true,
      _sum: { monto: true },
    }),
    db.cliente.count({
      where: {
        creadoPorId: usuarioId,
        creadoEn: { gte: desde },
        eliminadoEn: null,
      },
    }),
    db.gasto.aggregate({
      where: { cobradorId: usuarioId, creadoEn: { gte: desde } },
      _count: true,
      _sum: { monto: true },
    }),
    db.transaccion.aggregate({
      where: { creadoPorId: usuarioId, creadoEn: { gte: desde } },
      _count: true,
      _sum: { monto: true },
    }),
    db.transaccion.aggregate({
      where: {
        creadoPorId: usuarioId,
        tipoReferencia: 'VENTA_CONTADO',
        tipo: 'INGRESO',
        fechaTransaccion: { gte: desde },
      },
      _count: true,
      _sum: { monto: true },
    }),
    db.arqueoCaja.count({
      where: { creadoPorId: usuarioId, creadoEn: { gte: desde } },
    }),
    db.registroVisita.count({
      where: { cobradorId: usuarioId, creadoEn: { gte: desde } },
    }),
    db.registroAuditoria.count({
      where: { usuarioId, creadoEn: { gte: desde } },
    }),
  ]);

  return {
    desde: desde.toISOString(),
    dias,
    pagosRegistrados: {
      cantidad: pagos._count,
      monto: aNumero(pagos._sum.montoTotal),
    },
    creditosCreados: {
      cantidad: creados._count,
      monto: aNumero(creados._sum.monto),
    },
    ventasContado: {
      cantidad: ventas._count,
      monto: aNumero(ventas._sum.monto),
    },
    creditosAprobados: {
      cantidad: aprobados._count,
      monto: aNumero(aprobados._sum.monto),
    },
    clientesCreados: { cantidad: clientes, monto: null },
    gastosRegistrados: {
      cantidad: gastos._count,
      monto: aNumero(gastos._sum.monto),
    },
    movimientosDeCaja: {
      cantidad: movimientos._count,
      monto: aNumero(movimientos._sum.monto),
    },
    arqueosDeCaja: { cantidad: arqueos, monto: null },
    visitasRegistradas: { cantidad: visitas, monto: null },
    accionesEnElSistema: { cantidad: acciones, monto: null },
  };
}

/**
 * Las rutas que lleva, sea por el papel que sea.
 *
 * Un cobrador las lleva como cobrador, un supervisor como supervisor y un
 * coordinador como coordinador; la pregunta de la ficha es la misma —«¿de
 * cuántas rutas responde?»— así que se consulta con un `OR` y no con un `if`
 * por rol, que es como estaba y por eso un administrador veía las del
 * sistema entero.
 */
export async function loQueTieneACargo(
  db: ClienteDeConteo,
  usuarioId: string,
): Promise<LoQueTieneACargo> {
  const suyas = {
    eliminadoEn: null,
    OR: [
      { cobradorId: usuarioId },
      { supervisorId: usuarioId },
      { coordinadorId: usuarioId },
    ],
  };
  const [rutasTotal, rutasActivas] = await Promise.all([
    db.ruta.count({ where: suyas }),
    db.ruta.count({ where: { ...suyas, activa: true } }),
  ]);
  return { rutasTotal, rutasActivas };
}

/**
 * Qué cifras merecen salir en pantalla.
 *
 * Se enseña lo que hizo (cantidad > 0) y, además, lo que es propio de su rol
 * aunque esté en cero —ahí el cero significa «hoy no cobró», que es un dato—.
 * Lo demás se calla, en vez de llenar la ficha de ceros que no quieren decir
 * nada.
 */
export function cifrasQueImportan(
  hizo: LoQueHizo,
  rol: string,
): ClaveDeCifra[] {
  const propias = PROPIO_DEL_ROL[String(rol || '').toUpperCase()] ?? [];
  const candidatas: ClaveDeCifra[] = [
    'pagosRegistrados',
    'creditosCreados',
    'ventasContado',
    'creditosAprobados',
    'clientesCreados',
    'gastosRegistrados',
    'movimientosDeCaja',
    'arqueosDeCaja',
    'visitasRegistradas',
    'accionesEnElSistema',
  ];
  return candidatas.filter(
    (clave) => hizo[clave].cantidad > 0 || propias.includes(clave),
  );
}
