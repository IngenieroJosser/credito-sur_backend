import * as fs from 'fs';
import * as path from 'path';

/**
 * La columna «Ruta» de un credito dice la ruta DEL CREDITO.
 *
 * ── Lo que pasaba ──────────────────────────────────────────────────────────
 *
 * `getAllLoans` armaba `rutaNombre` con la primera asignacion activa del
 * CLIENTE. Y en este sistema la ruta la lleva el credito
 * (`Prestamo.rutaId`); `AsignacionRuta` es el orden de visita, derivado de los
 * creditos (`sincronizar-asignaciones.ts`). Cuando las dos no coinciden, la
 * fila mentia en los dos sentidos:
 *
 *   - un credito SIN ruta cuyo cliente si esta en una se mostraba DENTRO de
 *     esa ruta, aunque ninguna jornada lo incluye: existe, devenga mora y
 *     nadie va a cobrarlo;
 *   - y un credito CON ruta cuyo cliente no tiene asignacion activa se
 *     mostraba como «Sin asignar».
 *
 * ── Medido contra la base de desarrollo, 2026-11-18 ────────────────────────
 *
 * Con el backend en marcha, `GET /loans`:
 *
 *   antes:    41 «Ruta Centro - Norte» + 24 «Sin asignar»,
 *             mientras `?ruta=sin-ruta` devolvia 26
 *   despues:  41 + 26, y el filtro sigue en 26
 *
 * Los tres que se escondian eran de un mismo cliente asignado a la ruta
 * (ART-000047 ACTIVO, PRES-000040 y PRES-000032 EN_MORA), y habia un cuarto
 * caso al reves. Importa porque ese mismo texto se pinta en Cuentas en mora,
 * donde 24 de los 26 huerfanos estan EN_MORA: los que mas falta hacia ver eran
 * justo los que quedaban tapados.
 *
 * ── Por que una centinela de codigo ────────────────────────────────────────
 *
 * `getAllLoans` es un metodo de 400 lineas con una docena de consultas; montar
 * sus dobles para comprobar una cadena de texto costaria mas de lo que vigila.
 * Lo que no puede volver es la FUENTE del dato, y eso se lee en el codigo.
 */
const FUENTE = fs.readFileSync(
  path.join(__dirname, 'loans.service.ts'),
  'utf8',
);

/** El cuerpo de `getAllLoans`, para no acusar a otros metodos del archivo. */
const cuerpoDeGetAllLoans = () => {
  const inicio = FUENTE.indexOf('async getAllLoans(');
  expect(inicio).toBeGreaterThan(0);

  // Hasta el siguiente metodo del servicio.
  const resto = FUENTE.slice(inicio + 10);
  const siguiente = resto.search(/\n {2}(?:private |protected )?async \w+\(/);
  const cuerpo = siguiente > 0 ? resto.slice(0, siguiente) : resto;

  // Piso: si el recorte sale corto, la centinela estaria mirando casi nada.
  expect(cuerpo.length).toBeGreaterThan(5000);
  return cuerpo;
};

describe('la ruta que muestra un credito es la suya', () => {
  it('el nombre sale del credito', () => {
    const cuerpo = cuerpoDeGetAllLoans();

    expect(cuerpo).toMatch(/if \(prestamo\.ruta\)/);
    expect(cuerpo).toMatch(/rutaNombre = prestamo\.ruta\.nombre/);
  });

  it('y la consulta trae esa ruta', () => {
    const cuerpo = cuerpoDeGetAllLoans();

    expect(cuerpo).toMatch(/ruta: \{\s*select: \{ id: true, nombre: true, codigo: true \}/);
  });

  it('no vuelve a leer la asignacion del cliente para esto', () => {
    const cuerpo = cuerpoDeGetAllLoans();

    expect(cuerpo).not.toMatch(/prestamo\.cliente\.asignacionesRuta/);
    expect(cuerpo).not.toMatch(/asignacion\.ruta\.nombre/);
  });

  it('sin ruta se dice «Sin asignar», no se deja en blanco ni se inventa', () => {
    const cuerpo = cuerpoDeGetAllLoans();

    expect(cuerpo).toMatch(/let rutaNombre = 'Sin asignar'/);
  });
});
