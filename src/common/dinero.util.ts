/**
 * El peso colombiano no tiene centavos.
 *
 * En la calle nadie cobra ni entrega fracciones de peso, así que el sistema
 * tampoco las guarda. Toda cifra de dinero pasa por aquí antes de almacenarse
 * o compararse.
 *
 * Se trunca en vez de redondear a propósito: redondear hacia arriba inventaría
 * un peso que el cliente nunca entregó, y sobre miles de cuotas eso deja de
 * ser un detalle. Un residuo por debajo del peso sigue siendo deuda y se
 * arrastra a la última cuota, no se regala.
 *
 * Ojo: esto es solo para dinero. Los porcentajes, las tasas y los plazos sí
 * llevan decimales y no deben pasar por esta función.
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
