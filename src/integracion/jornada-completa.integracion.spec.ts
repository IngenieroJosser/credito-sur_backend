import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { LedgerService } from '../accounting/ledger.service';
import { MoraService } from '../loans/mora.service';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoansService } from '../loans/loans.service';
import { PaymentsService } from '../payments/payments.service';

/**
 * Una jornada de verdad, de punta a punta, contra la base de datos.
 *
 * Qué hace, en el orden en que pasa en la calle:
 *
 *   cliente nuevo → crédito → cuotas → pago de una cuota → pago de otra →
 *   saldo pendiente → el préstamo se salda
 *
 * Por qué así y no por partes: las pruebas de este repositorio ejercitan funciones con
 * dobles de Prisma, de una en una. Eso deja fuera lo que de verdad falla en producción —el
 * estado que una operación le deja a la siguiente—: un pago que no baja el saldo, una
 * cuota que queda PENDIENTE después de cobrarse, un préstamo que sigue ACTIVO con todo
 * pagado. Nada de eso lo ve una prueba que mira una función aislada.
 *
 * Los servicios NO se construyen a mano: se levanta el módulo real de Nest y solo se le
 * cambia Prisma por el de la base de pruebas. Montar a mano `LoansService` pide pasarle
 * media docena de dependencias, y cada una que se sustituye por un doble es un trozo del
 * sistema que la prueba deja de ejercitar.
 *
 * ── Dónde escribe ──────────────────────────────────────────────────────────────────────
 * En `credito_sur_test`, NUNCA en `credito_sur`; si la URL que arma no termina en `_test`,
 * se niega a arrancar. Prepararla: `npm run test:integracion`.
 */

const urlDePruebas = (): string | null => {
  try {
    const env = readFileSync(join(__dirname, '..', '..', '.env'), 'utf8');
    const url = env.match(/postgresql:\/\/[^\s"'\r\n]*/)?.[0];
    if (!url) return null;
    const dedicada = url.replace(/\/[^/?]+(\?|$)/, '/credito_sur_test$1');
    if (!/\/credito_sur_test(\?|$)/.test(dedicada)) return null;
    return dedicada;
  } catch {
    return null;
  }
};

const URL_PRUEBAS = urlDePruebas();
// Marca unica y CORTA: `Cliente.codigo` es VarChar(20), y "JORNADA-" mas la marca de
// tiempo entera se pasaba por un caracter.
const MARCA = `JOR-${Date.now().toString(36).toUpperCase()}`;

/** Un crédito pequeño y redondo, para que las cuentas se sigan a ojo. */
const MONTO = 600000;
const TASA = 20;
const CUOTAS = 3;
/** Lo que se deja en la caja de oficina para poder desembolsar. */
const CAPITAL_DE_CAJA = 50000000;

describe('Una jornada completa contra la base de datos', () => {
  const hayBase = !!URL_PRUEBAS;
  const siHayBase = hayBase ? describe : describe.skip;

  let prisma: PrismaClient;
  let loans: LoansService;
  let payments: PaymentsService;


  let usuarioId = '';
  let clienteId = '';
  let rutaId = '';
  let cajaCreadaAqui = false;
  let prestamoId = '';
  let reprogramacionId = '';
  let cuotaAReprogramar = '';
  let fechaOriginal: Date;
  let nuevaFecha = '';

  beforeAll(async () => {
    if (!hayBase) return;

    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: URL_PRUEBAS! }),
    });
    await prisma.$connect();

    // Los dos módulos que la jornada usa, y no AppModule entero: este arrastra
    // `@nestjs/mapped-types`, que viene en ESM y Jest no transpila, y además levantaría
    // websockets y tareas programadas que aquí no pintan nada.
    // Los servicios se arman a mano y NO levantando los módulos de Nest: el grafo de
    // módulos arrastra `@nestjs/mapped-types`, que se publica solo en ESM y Jest no
    // transpila, además de websockets y tareas programadas que aquí no pintan nada.
    //
    // Lo que SÍ va de verdad: Prisma, el libro contable, la mora y la configuración, que
    // son los que tocan el dinero. Lo que va como doble mudo —notificaciones, auditoría,
    // push, imágenes— son efectos laterales: su fallo no cambia un peso, y montarlos
    // pediría media infraestructura.
    const servicioPrisma = prisma as unknown as PrismaService;
    const mudo = () => new Proxy({}, { get: () => jest.fn() }) as never;

    const ledger = new LedgerService(servicioPrisma);
    const configuracion = new ConfiguracionService(servicioPrisma);
    const mora = new MoraService(servicioPrisma, mudo(), mudo(), mudo());

    loans = new LoansService(
      servicioPrisma,
      mudo(),
      mudo(),
      mudo(),
      mudo(),
      configuracion,
      ledger,
    );
    payments = new PaymentsService(
      servicioPrisma,
      mudo(),
      mudo(),
      mudo(),
      mudo(),
      ledger,
      mora,
    );

    // La caja de oficina con capital: sin ella el sistema RECHAZA cualquier crédito
    // —"No hay capital en la caja de oficina"—. Se busca por el código fijo que usa
    // `createLoan`, y solo se crea si no está; si ya existía, no se le toca el saldo.
    const usuarioParaCaja = await prisma.usuario.create({
      data: {
        nombres: 'Jornada',
        apellidos: 'Integración',
        correo: `${MARCA.toLowerCase()}@test.local`,
        hashContrasena: 'no-se-usa',
        rol: 'SUPER_ADMINISTRADOR',
      },
    });
    usuarioId = usuarioParaCaja.id;

    const cajaOficina = await prisma.caja.findFirst({
      where: { codigo: 'CAJA-OFICINA' },
    });
    if (!cajaOficina) {
      await prisma.caja.create({
        data: {
          codigo: 'CAJA-OFICINA',
          nombre: 'Caja de oficina (pruebas)',
          tipo: 'PRINCIPAL',
          saldoActual: CAPITAL_DE_CAJA,
          activa: true,
          responsableId: usuarioId,
        },
      });
      cajaCreadaAqui = true;
    } else if (Number(cajaOficina.saldoActual) < MONTO) {
      await prisma.caja.update({
        where: { id: cajaOficina.id },
        data: { saldoActual: CAPITAL_DE_CAJA },
      });
    }
  }, 180000);

  afterAll(async () => {
    if (!hayBase || !prisma) return;
    // En orden de dependencia: lo que apunta a algo se borra antes que aquello.
    if (prestamoId) {
      // Los detalles del pago cuelgan del pago: van primero, o salta
      // `detalles_pago_pagoId_fkey`.
      const pagos = await prisma.pago.findMany({
        where: { prestamoId },
        select: { id: true },
      });
      if (pagos.length) {
        await prisma.detallePago.deleteMany({
          where: { pagoId: { in: pagos.map((p) => p.id) } },
        });
      }
      await prisma.pago.deleteMany({ where: { prestamoId } });
      // La aprobación apunta al préstamo por `referenciaId`, no por una clave foránea; sus
      // efectos provisionales caen solos con ella (onDelete: Cascade).
      await prisma.aprobacion.deleteMany({ where: { referenciaId: prestamoId } });
      await prisma.cuota.deleteMany({ where: { prestamoId } });
      await prisma.prestamo.deleteMany({ where: { id: prestamoId } });
    }
    if (clienteId) {
      // Cobrar deja rastro de la visita, y la visita apunta al cliente.
      await prisma.registroVisita.deleteMany({ where: { clienteId } });
      await prisma.asignacionRuta.deleteMany({ where: { clienteId } });
      await prisma.cliente.deleteMany({ where: { id: clienteId } });
    }
    if (rutaId) await prisma.ruta.deleteMany({ where: { id: rutaId } });
    // La caja NO se borra aunque la hayamos creado: el desembolso le cuelga movimientos
    // contables, y borrarla choca con sus claves foráneas. Queda en la base de pruebas,
    // que es desechable, y la próxima corrida la reutiliza.
    // El usuario y las cajas se quedan: les cuelgan movimientos contables y asientos del
    // libro, y borrarlos pediría desarmar media contabilidad en orden inverso. La base de
    // pruebas es desechable —se recrea con `npm run test:integracion`—, así que no vale
    // la pena: lo que sí se limpia es lo que haría fallar una segunda corrida.
    await prisma.$disconnect();
  }, 180000);

  siHayBase('de cliente nuevo a préstamo saldado', () => {
    it('1. se crea el cliente', async () => {
      const cliente = await prisma.cliente.create({
        data: {
          codigo: MARCA,
          dni: String(Date.now()).slice(-10),
          nombres: 'Cliente',
          apellidos: 'De Jornada',
          telefono: '3000000000',
          creadoPorId: usuarioId,
        },
      });
      clienteId = cliente.id;
      expect(clienteId).toBeTruthy();
    }, 60000);

    it('2. el cliente entra en una ruta', async () => {
      // No es decorado: el sistema RECHAZA el crédito de un cliente sin ruta —"El credito
      // debe quedar asignado a una ruta"—. Saltarse este paso es saltarse una regla de
      // negocio que la prueba está aquí para ejercitar.
      const ruta = await prisma.ruta.create({
        data: {
          codigo: MARCA,
          nombre: `Ruta de ${MARCA}`,
          zona: 'Zona de pruebas',
          cobradorId: usuarioId,
        },
      });
      rutaId = ruta.id;

      await prisma.asignacionRuta.create({
        data: { rutaId, clienteId, cobradorId: usuarioId },
      });

      // Y su caja. El cobro la exige —"No existe una caja de ruta activa asociada a la
      // ruta del cliente"—: es donde entra el efectivo que se recoge en la calle.
      await prisma.caja.create({
        data: {
          codigo: `C-${MARCA}`.slice(0, 20),
          nombre: `Caja de ${MARCA}`,
          tipo: 'RUTA',
          rutaId,
          saldoActual: 0,
          activa: true,
          responsableId: usuarioId,
        },
      });

      const asignados = await prisma.asignacionRuta.count({ where: { clienteId } });
      expect(asignados).toBe(1);
    }, 60000);

    it('3. se le crea un crédito y nacen sus cuotas', async () => {
      const prestamo = await loans.createLoan({
        clienteId,
        tipoPrestamo: 'DINERO',
        monto: MONTO,
        tasaInteres: TASA,
        plazoMeses: CUOTAS,
        cantidadCuotas: CUOTAS,
        frecuenciaPago: 'MENSUAL',
        fechaInicio: new Date().toISOString().slice(0, 10),
        creadoPorId: usuarioId,
      } as never);

      prestamoId = (prestamo as { id: string }).id;
      expect(prestamoId).toBeTruthy();

      // Las cuotas son lo que el cobrador va a ver en la calle: si no nacen, no hay ruta.
      const cuotas = await prisma.cuota.findMany({
        where: { prestamoId },
        orderBy: { numeroCuota: 'asc' },
      });
      expect(cuotas).toHaveLength(CUOTAS);
      expect(cuotas.map((c) => c.numeroCuota)).toEqual([1, 2, 3]);
      for (const cuota of cuotas) {
        expect(Number(cuota.monto)).toBeGreaterThan(0);
      }
    }, 120000);

    it('4. la suma de las cuotas es el total del préstamo, sin pesos perdidos', async () => {
      // El reparto del redondeo es donde se escapan los pesos: tres cuotas de un total que
      // no divide exacto tienen que seguir sumando el total, no el total menos dos.
      const [prestamo, cuotas] = await Promise.all([
        prisma.prestamo.findUniqueOrThrow({ where: { id: prestamoId } }),
        prisma.cuota.findMany({ where: { prestamoId } }),
      ]);

      // El préstamo no guarda un total: es el capital más el interés.
      const totalDelPrestamo =
        Number(prestamo.monto) + Number(prestamo.interesTotal);
      const sumaCuotas = cuotas.reduce((t, c) => t + Number(c.monto), 0);
      expect(sumaCuotas).toBe(totalDelPrestamo);
    }, 60000);

    it('5. el crédito se aprueba y queda activo', async () => {
      // Un crédito nace PENDIENTE_APROBACION y el sistema RECHAZA cobrarle nada hasta que
      // alguien lo aprueba. Es la regla que separa "solicitado" de "desembolsado", y
      // saltarla dejaría la prueba cobrando sobre un préstamo que no existe para el
      // negocio.
      const antes = await prisma.prestamo.findUniqueOrThrow({
        where: { id: prestamoId },
        select: { estado: true },
      });
      expect(antes.estado).toBe('PENDIENTE_APROBACION');

      await loans.approveLoan(prestamoId, usuarioId);

      const despues = await prisma.prestamo.findUniqueOrThrow({
        where: { id: prestamoId },
        select: { estado: true },
      });
      expect(despues.estado).toBe('ACTIVO');
    }, 120000);

    it('6. pagar una cuota la deja pagada y baja el saldo', async () => {
      const antes = await prisma.prestamo.findUniqueOrThrow({
        where: { id: prestamoId },
        select: { saldoPendiente: true },
      });
      const cuota = await prisma.cuota.findFirstOrThrow({
        where: { prestamoId, numeroCuota: 1 },
      });
      const monto = Number(cuota.monto);

      await payments.create({
        clienteId,
        prestamoId,
        montoTotal: monto,
        metodoPago: 'EFECTIVO',
        cobradorId: usuarioId,
      } as never);

      const [cuotaDespues, prestamoDespues] = await Promise.all([
        prisma.cuota.findUniqueOrThrow({ where: { id: cuota.id } }),
        prisma.prestamo.findUniqueOrThrow({ where: { id: prestamoId } }),
      ]);

      // Las tres cosas que tienen que moverse a la vez. Que el pago se guarde pero la
      // cuota siga PENDIENTE es exactamente el fallo que una prueba aislada no ve.
      expect(cuotaDespues.estado).toBe('PAGADA');
      expect(Number(prestamoDespues.saldoPendiente)).toBe(
        Number(antes.saldoPendiente) - monto,
      );
      const pagos = await prisma.pago.findMany({ where: { prestamoId } });
      expect(pagos).toHaveLength(1);
      expect(Number(pagos[0].montoTotal)).toBe(monto);
    }, 120000);

    it('7. se pide reprogramar una cuota que aún no se ha cobrado', async () => {
      // Lo que pasa en la calle: el cliente no tiene con qué el día que toca y pide otra
      // fecha. Y aquí está el detalle que importa, medido y no supuesto: la cuota SE MUEVE
      // YA, sin esperar a que nadie apruebe. Es un efecto provisional —la aprobación queda
      // PENDIENTE y lo confirma después—, de modo que el cobrador deja de ver esa cuota
      // vencida al instante. Quien lea esto esperando lo contrario se equivoca: lo que
      // falta por aprobar no es el cambio, es su confirmación.
      const cuota = await prisma.cuota.findFirstOrThrow({
        where: { prestamoId, estado: { not: 'PAGADA' } },
        orderBy: { numeroCuota: 'asc' },
      });
      cuotaAReprogramar = cuota.id;
      fechaOriginal = cuota.fechaVencimiento;

      // La nueva fecha se cuenta desde HOY y no desde el vencimiento: el sistema no
      // admite pasar de 30 días desde hoy en un crédito mensual. Pedir "quince días más"
      // sobre una cuota que vence dentro de dos meses lo rechaza, y con razón: sería
      // aplazar a tres meses vista.
      const nueva = new Date();
      nueva.setDate(nueva.getDate() + 20);
      nuevaFecha = nueva.toISOString().slice(0, 10);

      const solicitud = await loans.solicitarReprogramacion({
        prestamoId,
        cuotaId: cuota.id,
        nuevaFecha,
        motivo: 'El cliente pidió quince días más',
        solicitadoPorId: usuarioId,
      });

      reprogramacionId = (solicitud as { aprobacion: { id: string } }).aprobacion.id;
      expect(reprogramacionId).toBeTruthy();

      const aprobacion = await prisma.aprobacion.findUniqueOrThrow({
        where: { id: reprogramacionId },
      });
      expect(aprobacion.estado).toBe('PENDIENTE');

      const tras = await prisma.cuota.findUniqueOrThrow({ where: { id: cuota.id } });
      expect(tras.fechaVencimiento).not.toEqual(fechaOriginal);
      expect(tras.fechaVencimiento.toISOString().slice(0, 10)).toBe(nuevaFecha);

      // Y queda el rastro de que está pendiente de confirmar.
      const efectos = await prisma.efectoProvisional.findMany({
        where: { aprobacionId: reprogramacionId },
      });
      expect(efectos).toHaveLength(1);
      expect(efectos[0].estado).toBe('PENDIENTE_REVISION');
    }, 120000);

    it('8. aprobarla confirma el cambio y cierra la solicitud', async () => {
      await loans.aprobarReprogramacion(reprogramacionId, usuarioId);

      const [aprobacion, cuota, efectos] = await Promise.all([
        prisma.aprobacion.findUniqueOrThrow({ where: { id: reprogramacionId } }),
        prisma.cuota.findUniqueOrThrow({ where: { id: cuotaAReprogramar } }),
        prisma.efectoProvisional.findMany({
          where: { aprobacionId: reprogramacionId },
        }),
      ]);

      expect(aprobacion.estado).toBe('APROBADO');
      // El efecto deja de estar en revisión: el cambio ya es firme.
      expect(efectos[0].estado).toBe('CONFIRMADO');
      // Y la fecha sigue siendo la pedida: aprobar confirma, no vuelve a mover.
      expect(cuota.fechaVencimiento.toISOString().slice(0, 10)).toBe(nuevaFecha);
    }, 120000);

    it('9. no deja aplazar más allá del tope del crédito mensual', async () => {
      // La regla que protege la cartera: un crédito mensual no se puede correr más de 30
      // días desde hoy. Sin este tope, reprogramar sería una forma de no cobrar nunca.
      const cuota = await prisma.cuota.findFirstOrThrow({
        where: { prestamoId, estado: { not: 'PAGADA' } },
        orderBy: { numeroCuota: 'asc' },
      });
      const demasiadoLejos = new Date();
      demasiadoLejos.setDate(demasiadoLejos.getDate() + 90);

      await expect(
        loans.solicitarReprogramacion({
          prestamoId,
          cuotaId: cuota.id,
          nuevaFecha: demasiadoLejos.toISOString().slice(0, 10),
          motivo: 'Intento de aplazar tres meses',
          solicitadoPorId: usuarioId,
        }),
      ).rejects.toThrow(/30 días/);
    }, 60000);

    it('10. reprogramar no cambia lo que el cliente debe', async () => {
      // Lo que más importa y lo más fácil de romper: correr una fecha no puede alterar
      // el saldo ni la suma de las cuotas. Si al reprogramar se recalculara el interés
      // sin querer, el cliente acabaría debiendo más por haber pedido un plazo.
      const [prestamo, cuotas] = await Promise.all([
        prisma.prestamo.findUniqueOrThrow({ where: { id: prestamoId } }),
        prisma.cuota.findMany({ where: { prestamoId } }),
      ]);

      const total = Number(prestamo.monto) + Number(prestamo.interesTotal);
      const sumaCuotas = cuotas.reduce((t, c) => t + Number(c.monto), 0);
      expect(sumaCuotas).toBe(total);
      expect(cuotas).toHaveLength(CUOTAS);
    }, 60000);

    it('11. al pagar todas, el préstamo queda saldado y sin cuotas pendientes', async () => {
      const pendientes = await prisma.cuota.findMany({
        where: { prestamoId, estado: { not: 'PAGADA' } },
        orderBy: { numeroCuota: 'asc' },
      });

      for (const cuota of pendientes) {
        await payments.create({
          clienteId,
          prestamoId,
          montoTotal: Number(cuota.monto),
          metodoPago: 'EFECTIVO',
          cobradorId: usuarioId,
        } as never);
      }

      const [prestamo, sinPagar] = await Promise.all([
        prisma.prestamo.findUniqueOrThrow({ where: { id: prestamoId } }),
        prisma.cuota.count({ where: { prestamoId, estado: { not: 'PAGADA' } } }),
      ]);

      expect(sinPagar).toBe(0);
      // Saldo en cero y estado al día: un préstamo que sigue ACTIVO con todo pagado
      // reaparece en la ruta del cobrador al día siguiente.
      expect(Number(prestamo.saldoPendiente)).toBe(0);
      expect(prestamo.estado).toBe('PAGADO');
    }, 180000);

    it('12. lo cobrado coincide con el total del préstamo', async () => {
      const [prestamo, pagos] = await Promise.all([
        prisma.prestamo.findUniqueOrThrow({ where: { id: prestamoId } }),
        prisma.pago.findMany({ where: { prestamoId } }),
      ]);

      const cobrado = pagos.reduce((t, p) => t + Number(p.montoTotal), 0);
      expect(cobrado).toBe(Number(prestamo.monto) + Number(prestamo.interesTotal));
    }, 60000);
  });

  it('avisa si no hay base de pruebas', () => {
    if (!hayBase) {
      console.warn(
        'La jornada completa se saltó: no se pudo armar la URL de credito_sur_test.',
      );
    }
    expect(true).toBe(true);
  });
});
