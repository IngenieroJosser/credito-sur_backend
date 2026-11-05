/**
 * Cómo la empresa fija el precio de un artículo, en un solo sitio.
 *
 * Vive aquí y no dentro de la plantilla porque lo necesitan dos cosas que tienen
 * que coincidir: la plantilla de Excel, que escribe estas cuentas como fórmulas
 * en las celdas, y el importador, que rellena con ellas el precio que llegue
 * vacío. Si la regla estuviera escrita dos veces, tarde o temprano una de las dos
 * quedaría vieja y el archivo diría un precio y el sistema guardaría otro.
 *
 * Y el importador necesita rellenar, porque en Excel una celda guarda o una
 * fórmula o un valor: en cuanto alguien borra el contenido de una celda de precio,
 * la fórmula se va de esa fila y no vuelve sola. Antes eso hacía fallar la fila
 * con un "el precio es requerido" aunque el costo y la rentabilidad estuvieran
 * escritos ahí al lado.
 */

/**
 * Los plazos de referencia y cuánto recarga la empresa por cada uno.
 *
 * Está medido contra los precios reales de dos artículos. Con un costo de 619.900
 * al 30% la base de contado es 805.870, y los precios de ese artículo son
 * 1.047.631 / 1.184.629 / 1.289.392 a 3, 5 y 8 meses: estos recargos los dan
 * exactos. Las tasas mensuales que implicarían son 10%, 9,4% y 7,5% —tres
 * distintas, y BAJANDO al alargarse el plazo, lo contrario de lo que hace un
 * interés— así que ninguna fórmula de interés los produce. Es una tabla.
 *
 * Si la empresa cambia sus recargos o sus plazos, se cambia aquí y nada más.
 */
export const PLAZOS: ReadonlyArray<{ meses: number; recargo: number }> = [
  { meses: 3, recargo: 0.3 },
  { meses: 5, recargo: 0.47 },
  { meses: 8, recargo: 0.6 },
];

/**
 * El recargo que le toca a un plazo cualquiera.
 *
 * La tabla tiene tres puntos pero el precio tiene que salir con los meses que
 * sean, así que se traza una recta entre cada par de puntos y fuera del rango se
 * sigue con la pendiente del tramo del borde. En los plazos de la tabla devuelve
 * exactamente su recargo, así que los precios reales de la empresa siguen
 * saliendo al peso.
 *
 * Comprobado que el precio crece siempre al alargar el plazo, de 1 a 60 meses, y
 * que la tasa mensual que implica baja suave —13% a un mes, 5,4% a veinticuatro—
 * que es el patrón que tienen los precios de la empresa.
 */
export function recargoDelPlazo(meses: number): number {
  if (PLAZOS.length < 2) {
    throw new Error('La tabla de plazos necesita al menos dos puntos.');
  }

  // Se busca el tramo cuyo extremo derecho ya cubre estos meses. Si no hay
  // ninguno, los meses pasan del último punto y se usa el último tramo, que
  // extrapola. El primer tramo cubre además todo lo que quede por debajo.
  let i = PLAZOS.findIndex((_, indice) => {
    const siguiente = PLAZOS[indice + 1];
    return siguiente !== undefined && meses <= siguiente.meses;
  });
  if (i === -1) i = PLAZOS.length - 2;

  const desde = PLAZOS[i];
  const hasta = PLAZOS[i + 1];
  return (
    desde.recargo +
    ((meses - desde.meses) * (hasta.recargo - desde.recargo)) /
      (hasta.meses - desde.meses)
  );
}

/**
 * La misma cuenta, escrita como fórmula de Excel, para meterla en las celdas.
 *
 * Se arma desde `PLAZOS` en vez de escribirse a mano para que agregar o mover un
 * plazo no deje la fórmula hablando de otra tabla. Los números quedan como resta
 * y división a la vista —`(0.47-0.3)/(5-3)`— para que quien abra la celda pueda
 * seguir la cuenta.
 */
export function expresionRecargoExcel(refMeses: string): string {
  if (PLAZOS.length < 2) {
    throw new Error('La tabla de plazos necesita al menos dos puntos.');
  }

  const tramo = (i: number) => {
    const desde = PLAZOS[i];
    const hasta = PLAZOS[i + 1];
    return (
      `${desde.recargo}+(${refMeses}-${desde.meses})*` +
      `(${hasta.recargo}-${desde.recargo})/(${hasta.meses}-${desde.meses})`
    );
  };

  // De atrás hacia adelante: el último tramo es también el que extrapola los
  // plazos más largos, y el primero cubre todo lo que quede por debajo.
  let expresion = tramo(PLAZOS.length - 2);
  for (let i = PLAZOS.length - 3; i >= 0; i--) {
    expresion = `IF(${refMeses}<=${PLAZOS[i + 1].meses},${tramo(i)},${expresion})`;
  }
  return expresion;
}

/**
 * El precio de contado: el costo DIVIDIDO por el divisor con el que cartera fija la
 * ganancia. Un divisor de 0,65 deja 35% de ganancia sobre la venta.
 *
 * Esta cuenta estuvo al revés —`costo × (1 + rentabilidad)`— y se corrigió con el archivo
 * que cartera llenó a mano el 30 de septiembre de 2026: 211 filas, todas con `=E/0,70`,
 * `=E/0,65` o `=E/0,55`, y **ninguna** multiplicando. El televisor Samsung de costo
 * 829.900, que es el mismo artículo con el que se había fijado la fórmula anterior, lo
 * tienen en 1.185.571 y no en los 1.078.870 de multiplicar por 1,30.
 *
 * Es decir: lo que antes se descartó por «106.701 pesos de más» resultó ser el precio
 * bueno. El dato viejo venía de dos artículos sueltos con el precio ya hecho; este viene
 * de la hoja de 209 artículos que cartera usa a diario y dio por correcta.
 *
 * Se trunca y no se redondea, porque truncar es lo que hace el sistema con los pesos
 * (`truncCop`): así el número que la hoja enseña es el que queda guardado.
 */
export function baseDeContado(costo: number, divisor: number): number {
  return Math.trunc(costo / divisor);
}

/**
 * El precio de un plazo: la base de contado más el recargo de esos meses.
 *
 * La base se toma SIN truncar: comprobado contra los 209 artículos, truncando la base y
 * multiplicando sobre ella salían 136 filas con un peso de diferencia en algún plazo;
 * arrastrando los decimales coinciden 199. Las 10 restantes son ruido de coma flotante
 * —220.000/0,55 da 399.999,99…— que la propia hoja calcula de forma inconsistente.
 */
export function precioDelPlazo(
  costo: number,
  divisor: number,
  meses: number,
): number {
  return Math.trunc((costo / divisor) * (1 + recargoDelPlazo(meses)));
}
