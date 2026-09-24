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
 * El precio de contado: el costo más la rentabilidad, aplicada SOBRE EL COSTO.
 *
 * Ejemplo real: costo 829.900 con 30% da 1.078.870, exacto. La convención
 * importa: `costo / (1 - rentabilidad)` es margen sobre la VENTA y con ese mismo
 * 30% daría 1.185.571, 106.701 pesos de más. Cuando en esta empresa se dice «30%
 * de rentabilidad» se quiere decir costo × 1,30.
 */
export function baseDeContado(costo: number, rentabilidad: number): number {
  return Math.round(costo * (1 + rentabilidad));
}

/** El precio de un plazo: la base de contado más el recargo de esos meses. */
export function precioDelPlazo(
  costo: number,
  rentabilidad: number,
  meses: number,
): number {
  return Math.round(
    baseDeContado(costo, rentabilidad) * (1 + recargoDelPlazo(meses)),
  );
}
