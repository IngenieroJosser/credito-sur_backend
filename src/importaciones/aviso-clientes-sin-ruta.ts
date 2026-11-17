/**
 * El aviso de los clientes que una importacion deja sin ruta.
 *
 * ── Por que existe ─────────────────────────────────────────────────────────
 *
 * `confirmarClientesCreditos` resuelve la ruta de cada cliente por el codigo
 * que trae el archivo, y tenia dos salidas en silencio: la fila que no trae
 * codigo y el codigo que no existe. Los creditos de esos clientes se crean
 * despues SIN `rutaId`, porque la ruta solo se le pone a los que si se
 * resolvieron.
 *
 * Un credito sin ruta no entra en la jornada de nadie: existe, devenga mora y
 * nadie va a cobrarlo. Medido en la base de desarrollo: 25 de 60 creditos
 * vivos sin ruta, casi todos de articulo, y cinco clientes con 8, 4, 4, 3 y 3
 * creditos cada uno sin una sola, la mayoria ya EN_MORA. Nadie se entero al
 * importarlos.
 *
 * ── Por que un modulo y no el texto donde se usa ───────────────────────────
 *
 * Porque su prueba necesita leer la frase, y montar el servicio entero con su
 * transaccion para eso costaria cien lineas de dobles y mediria sobre todo los
 * dobles. Escrito aparte, lo que se prueba es el texto de verdad y no una
 * copia suya —que es como se separan las dos, y en este proyecto ya paso—.
 */

export function avisoDeClientesSinRuta(
  /** Clientes cuya fila del archivo no traia codigo de ruta. */
  sinCodigoDeRuta: string[],
  /** Codigos de ruta que venian en el archivo y no existen en el sistema. */
  codigosDesconocidos: string[],
): string | null {
  const sinRuta = sinCodigoDeRuta.length + codigosDesconocidos.length;
  // Lo normal no necesita aviso: un informe que avisa siempre deja de leerse.
  if (sinRuta === 0) return null;

  /*
   * Los dos motivos van separados porque se arreglan distinto: la fila sin
   * codigo se corrige en el archivo; el codigo desconocido, creando la ruta o
   * corrigiendo el codigo.
   */
  const partes: string[] = [];
  if (sinCodigoDeRuta.length) {
    partes.push(
      `${sinCodigoDeRuta.length} porque el archivo no trae codigo de ruta`,
    );
  }
  if (codigosDesconocidos.length) {
    // Sin repetir: veinte clientes de la misma ruta mal escrita no son veinte
    // problemas distintos.
    const codigos = [...new Set(codigosDesconocidos)].join(', ');
    partes.push(
      `${codigosDesconocidos.length} porque la ruta no existe (${codigos})`,
    );
  }

  /*
   * La frase dice la CONSECUENCIA y no solo el hecho. «Quedaron sin ruta» no
   * mueve a nadie; «no entraran en la jornada de nadie» si.
   */
  return (
    `ATENCION: ${sinRuta} cliente(s) quedaron SIN RUTA y sus creditos no entraran ` +
    `en la jornada de nadie: ${partes.join(' y ')}. Asignalos a una ruta para que ` +
    'se puedan cobrar.'
  );
}
