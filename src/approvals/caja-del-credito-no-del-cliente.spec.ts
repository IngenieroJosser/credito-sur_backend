import * as fs from 'fs';
import * as path from 'path';

/**
 * El desembolso sale de la caja de la ruta DEL CREDITO.
 *
 * ── El defecto ─────────────────────────────────────────────────────────────
 *
 * Al aprobar, la caja de la que sale el dinero se elegia con
 * `prestamo.cliente.asignacionesRuta[0].rutaId`: la asignacion del CLIENTE, y
 * ese `[0]` es una cualquiera. El indice unico parcial de la tabla es
 * `(rutaId, clienteId) WHERE activa`, de modo que un cliente con creditos en
 * dos rutas tiene DOS asignaciones activas: el desembolso podia salir de la
 * caja de una ruta que no es la de este credito.
 *
 * En este sistema la ruta la lleva el credito (`Prestamo.rutaId`);
 * `AsignacionRuta` es el orden de visita, derivado de los creditos
 * (`sincronizar-asignaciones.ts`).
 *
 * ── Por que importa, en palabras del propio backend ────────────────────────
 *
 * `resolveCajaIngresoPago` ya lo deja escrito: «Equivocar la caja aqui no se
 * nota en el momento: aparece al cierre de ruta, como un descuadre que nadie
 * sabe de donde salio».
 *
 * ── Por que una centinela de codigo ────────────────────────────────────────
 *
 * Los dos sitios estan dentro de `procesarAprobacion`, una transaccion de mas
 * de 500 lineas con una docena de escrituras; montar sus dobles para comprobar
 * de que caja salio un asiento costaria mas de lo que vigila. Lo que no puede
 * volver es la FUENTE de la ruta, y eso se lee en el codigo.
 */
const FUENTE = fs.readFileSync(
  path.join(__dirname, 'approvals.service.ts'),
  'utf8',
);

describe('la caja del desembolso es la de la ruta del credito', () => {
  it('ninguna eleccion de ruta arranca por la asignacion del cliente', () => {
    /*
     * Lo que se prohibe es que la asignacion del cliente sea el PRIMER valor de
     * la cascada. Como respaldo detras de `prestamo.rutaId` esta bien: hace
     * falta para las filas viejas, de antes de que ningun credito pudiera
     * quedarse sin ruta.
     */
    const comoPrimera =
      /(?:const|let)\s+\w*[Rr]uta\w*\s*=\s*prestamo\??\.cliente\??\.asignacionesRuta/g;

    const culpables = FUENTE.match(comoPrimera) || [];
    expect(culpables).toEqual([]);
  });

  it('y las dos cascadas empiezan por la ruta del credito', () => {
    const conRespaldo =
      FUENTE.match(
        /prestamo\??\.rutaId \|\|\s*\n?\s*prestamo\??\.cliente\??\.asignacionesRuta\??\.\[0\]\??\.rutaId/g,
      ) || [];

    // Piso medido: son dos, el credito de articulo y el de dinero pedido por un
    // cobrador. Si aparece una tercera eleccion de caja, que tambien pase por
    // aqui.
    expect(conRespaldo.length).toBe(2);
  });

  it('el modelo sigue diciendo que la ruta la lleva el credito', () => {
    // Si `Prestamo.rutaId` desapareciera, esta prueba y su arreglo dejarian de
    // tener sentido, y mas vale que se note aqui.
    const schema = fs.readFileSync(
      path.join(__dirname, '..', 'prisma', 'schema.prisma'),
      'utf8',
    );
    const modelo = schema.slice(schema.indexOf('model Prestamo'));
    expect(modelo.slice(0, 4000)).toMatch(/rutaId\s+String\?/);
  });
});
