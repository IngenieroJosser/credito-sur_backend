/**
 * Hasta dónde llega un plazo de crédito de artículo.
 *
 * Tres meses, por decisión del negocio. Antes no estaba escrito en ninguna
 * parte: el DTO solo exigía `@Min(1)`, el parser del importador solo pedía que
 * los meses fueran mayores a 0, y los formularios del frontend ofrecían una
 * lista de hasta 24 meses. Por eso en la base de desarrollo hay precios a 6 y a
 * 12 meses que el negocio no financia.
 *
 * Vive aquí y no en el parser de inventario porque lo necesitan dos módulos que
 * no deberían depender uno del otro: `inventory` (el alta y la edición por la
 * API) e `importaciones` (la plantilla de Excel y su lectura).
 *
 * No confundir con `MAX_OPCIONES_PLAZO`, que sí está en el parser de inventario
 * y cuenta cuántas opciones de precio caben en una fila de la plantilla: tres
 * pares de columnas «Meses opción i» / «Precio total opción i». Son dos topes
 * distintos que casualmente valen 3, y es fácil leer uno por el otro. La
 * plantilla traía de fábrica un ejemplo con «Opción 3: 6 meses», o sea la
 * tercera opción con un plazo de seis meses, que con esta regla no existe.
 */
export const MAX_MESES_PLAZO = 3;
