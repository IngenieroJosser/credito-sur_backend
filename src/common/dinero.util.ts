/**
 * El peso colombiano no tiene centavos: esta función es la red que lo asegura.
 *
 * Es una red, no una calculadora. La regla del sistema no es "nunca redondear
 * dinero", sino resolver la fracción **una sola vez, donde nace**, y de ahí
 * en adelante trabajar en enteros. La fracción nace en el interés —una tasa
 * del 20% sobre 1.234.567 no da un entero— y ahí se resuelve TRUNCANDO, con la
 * tasa en centésimas para no perder un peso por coma flotante.
 *
 * Esa regla vive en tres lugares que tienen que coincidir: el backend
 * (`LoansService.calcularInteresPlano` / `calculateInterestAndCuotas`), la
 * importación (`importaciones/interes-credito.ts`) y el frontend
 * (`lib/interes.ts`, que usan los modales). Hasta el 2026-09-03 se redondeaba
 * con `Math.round`; se pasó a truncar para no cobrar nunca más interés del
 * pactado. Si una de las tres vuelve a redondear, se separan por un peso.
 *
 * Por eso, si a esta función le llega una fracción en un punto donde todo
 * debería ser entero, no es que haya que truncarla: es que algo se calculó mal
 * más arriba. Trunca para no dejar pasar el centavo, pero eso tapa el síntoma.
 *
 * Sobre el truncamiento: `Math.trunc` redondea hacia **cero**, no hacia abajo,
 * así que encoge la magnitud en las dos direcciones y siempre cede a favor de
 * quien paga. No es una regla neutral. Se conserva porque es la misma que usa
 * `truncCop` en pagos, y tener dos reglas distintas para el mismo peso sería
 * peor que tener una discutible.
 *
 * Ojo: esto es solo para dinero. Los porcentajes, las tasas y los plazos sí
 * llevan decimales y no deben pasar por aquí.
 */
export function pesos(valor: number | string | null | undefined): number {
  const numero = Number(valor);
  return Number.isFinite(numero) ? Math.trunc(numero) : 0;
}

/** `true` si la cifra trae fracciones de peso, que no deberían existir. */
export function tieneCentavos(valor: number | null | undefined): boolean {
  return (
    valor !== null &&
    valor !== undefined &&
    Number.isFinite(valor) &&
    !Number.isInteger(valor)
  );
}

/**
 * El techo de un importe de dinero: lo que cabe en `Decimal(15, 2)`.
 *
 * Por encima, Postgres rechaza la escritura y el fallo sale como «Ocurrió un
 * error inesperado» después de haber empezado la transacción. Comprobado
 * mandando 1e15 a `/accounting/transacciones`: respondía 500. Mejor decir que
 * la cifra no cabe antes de tocar la base.
 */
export const MAXIMO_EN_PESOS = 9_999_999_999_999;

/**
 * Por qué un importe no sirve como cantidad de dinero, o `null` si sirve.
 *
 * La dirección del movimiento la lleva su tipo —INGRESO o EGRESO, DEBITO o
 * CREDITO—, nunca el signo de la cifra. Un importe negativo invierte el
 * movimiento sin decirlo, y eso no es una hipótesis: medido contra la base de
 * pruebas, un EGRESO de −3.000.000 sobre una caja con fondos respondía 201 y
 * **subía** el saldo en tres millones. Un egreso que crea dinero. El libro de
 * doble entrada no lo veía porque las dos patas cuadran igual de bien con el
 * signo invertido.
 *
 * Devuelve el motivo en texto, en vez de lanzar, para que cada sitio elija su
 * excepción y pueda nombrar de qué cifra habla —«el monto del pago», «el valor
 * del gasto»—, que es lo que la persona necesita leer.
 */
export function porQueNoEsDinero(valor: unknown): string | null {
  const numero = Number(valor);

  if (valor === null || valor === undefined || valor === '') {
    return 'no llegó ninguna cifra';
  }
  if (!Number.isFinite(numero)) {
    return `«${String(valor)}» no es un número`;
  }
  if (numero <= 0) {
    return `debe ser mayor que cero (llegó ${numero})`;
  }
  if (numero > MAXIMO_EN_PESOS) {
    return `es demasiado grande (llegó ${numero}); el máximo es ${MAXIMO_EN_PESOS}`;
  }
  // El peso colombiano no tiene centavos, así que una fracción aquí no es un
  // importe: es un cálculo que se escapó o un dato mal escrito.
  //
  // Medido en la base de pruebas antes de poner esta regla: 0 de 16 cuotas y 0
  // de 4 saldos pendientes tenían fracción, y el ÚNICO pago con centavos de la
  // base era el que había creado la prueba de caos con 1.000,57 —entraba y
  // bajaba la deuda 1.001, inventando 43 centavos—. O sea que nada legítimo
  // los necesita y bloquearlos no impide pagar un saldo exacto.
  //
  // En las pantallas tampoco se pueden escribir: `parseCOPInputToNumber`
  // (lib/utils.ts) borra todo lo que no sea dígito mientras se teclea. Esta
  // regla cierra el camino que queda, que es la API.
  //
  // Donde la fracción NACE de verdad —el interés— se resuelve en su origen
  // truncando, y de ahí en adelante todo es entero. Si llega una aquí, el
  // problema está más arriba.
  if (!Number.isInteger(numero)) {
    return `no puede llevar centavos (llegó ${numero}); el peso colombiano no los tiene`;
  }
  return null;
}
