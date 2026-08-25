/**
 * El peso colombiano no tiene centavos: esta función es la red que lo asegura.
 *
 * Es una red, no una calculadora. La regla del sistema no es "nunca redondear
 * dinero", sino redondear **una sola vez, donde la fracción nace**, y de ahí
 * en adelante trabajar en enteros. La fracción nace en el interés —una tasa
 * del 20% sobre 1.234.567 no da un entero— y ahí se resuelve con `Math.round`,
 * la misma regla que usa el modal de crear créditos. Truncar el interés "por
 * coherencia" haría que el Excel y el modal se separaran por un peso.
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
