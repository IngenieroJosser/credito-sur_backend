import * as fs from 'fs';
import * as path from 'path';

import {
  ORIGEN_OFICINA,
  ROLES_DE_OFICINA,
  esRolDeOficina,
  resolverOrigenDeGestion,
} from './origen-de-gestion';

/**
 * El cliente que paga en la sede.
 *
 * Es el caso que pidio el negocio: muchas veces el cliente no espera al
 * cobrador y va a pagar a la oficina, donde lo recibe el coordinador. El
 * dinero entra a CAJA-OFICINA, pero el `cobradorId` del pago se queda en el
 * cobrador de la ruta para que el recaudo y la meta lo cuenten. Sin una marca,
 * nada distinguia ese pago de uno cobrado en la calle.
 */
describe('de donde viene un pago', () => {
  describe('resolverOrigenDeGestion', () => {
    it('marca OFICINA cuando lo registra un rol de oficina', () => {
      expect(resolverOrigenDeGestion(undefined, 'COORDINADOR')).toBe(
        ORIGEN_OFICINA,
      );
      expect(resolverOrigenDeGestion(null, 'ADMIN')).toBe(ORIGEN_OFICINA);
      expect(resolverOrigenDeGestion('', 'SUPER_ADMINISTRADOR')).toBe(
        ORIGEN_OFICINA,
      );
    });

    it('no marca nada cuando el cobro es de la calle', () => {
      expect(resolverOrigenDeGestion(undefined, 'COBRADOR')).toBeNull();
      expect(resolverOrigenDeGestion(undefined, 'SUPERVISOR')).toBeNull();
    });

    it('no marca nada sin rol: null es «no se sabe», no «oficina»', () => {
      expect(resolverOrigenDeGestion(undefined, undefined)).toBeNull();
      expect(resolverOrigenDeGestion(undefined, '')).toBeNull();
    });

    it('CIERRE_PENDIENTE manda sobre la marca de oficina', () => {
      // Media docena de consultas dependen de ese valor exacto: si el
      // coordinador regulariza un cierre, el pago sigue siendo de cierre
      // pendiente, con su fecha operativa.
      expect(resolverOrigenDeGestion('CIERRE_PENDIENTE', 'COORDINADOR')).toBe(
        'CIERRE_PENDIENTE',
      );
    });

    it('el rol llega en cualquier caja de letras', () => {
      expect(esRolDeOficina('coordinador')).toBe(true);
      expect(esRolDeOficina('Admin')).toBe(true);
      expect(esRolDeOficina('cobrador')).toBe(false);
    });
  });

  /**
   * Las dos listas de roles de oficina tienen que ser la misma.
   *
   * `resolveCajaIngresoPago` decide con `rolesOficina` que el efectivo entre a
   * CAJA-OFICINA. Si un rol estuviera en esa lista y no en esta, su pago
   * acabaria en la caja de la oficina sin que nada lo dijera, que es
   * exactamente el silencio que esto viene a cerrar.
   */
  it('la lista de roles es la misma que la que decide la caja', () => {
    const fuente = fs.readFileSync(
      path.join(__dirname, 'payments.service.ts'),
      'utf8',
    );

    const declaracion = fuente.match(/const rolesOficina = \[([^\]]*)\]/)?.[1];

    // Piso: si la declaracion cambia de forma y el match falla, esto avisa en
    // vez de pasar en verde sin haber comparado nada.
    expect(declaracion).toBeDefined();

    const rolesDeLaCaja = (declaracion as string)
      .split(',')
      .map((r) => r.replace(/['"\s]/g, ''))
      .filter(Boolean)
      .sort();

    expect(rolesDeLaCaja.length).toBeGreaterThanOrEqual(3);
    expect(rolesDeLaCaja).toEqual([...ROLES_DE_OFICINA].sort());
  });

  it('el servicio pone la marca en los dos sitios donde nace un pago', () => {
    const fuente = fs.readFileSync(
      path.join(__dirname, 'payments.service.ts'),
      'utf8',
    );

    // Antes el campo se copiaba tal cual del DTO en los dos `create`, y el DTO
    // solo admite CIERRE_PENDIENTE: por ahi no podia entrar nunca la marca.
    const copiaDirecta = fuente.match(
      /origenGestion: paymentDto\.origenGestion\b/g,
    );
    expect(copiaDirecta).toBeNull();

    const conLaRegla = fuente.match(
      /origenGestion: resolverOrigenDeGestion\(/g,
    );
    expect(conLaRegla?.length).toBe(2);
  });
});
