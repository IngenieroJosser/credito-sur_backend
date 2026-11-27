# Fase 5: importación integral y aceptación de cartera

Fecha: 27 de noviembre de 2026 (Bogotá). Entorno solamente local, sin promoción ni despliegue.

## Alcance y datos persistidos

La preparación conserva el expediente, sus revisiones y las 536 filas con sus celdas de origen. La confirmación toma una selección explícita. En una sola transacción crea el inventario de apertura, los clientes requeridos, las referencias de artículo, los créditos, las cuotas y las asociaciones de auditoría. Una ruta solo se vincula cuando su código del origen existe y está activo; no se asignan rutas faltantes.

| Resultado aislado | Cantidad |
| --- | ---: |
| Artículos comerciales de apertura | 208 |
| Unidades de apertura | 1.107 |
| Opciones de precios (incluido contado) | 832 |
| Clientes del lote / con referencia provisional y sin cédula | 83 / 31 |
| Ruta de muestra con código del origen | 1 |
| Créditos de dinero / cuotas | 37 / 270 |
| Créditos de artículo / cuotas | 46 / 1.192 |
| Históricos de artículo con catálogo / con referencia no comercial | 42 / 4 |
| Referencias vinculadas a entidades | 379 |
| Asientos de apertura / transacciones de caja / pagos | 207 / 0 / 0 |

El inventario de apertura conserva stock y costo reportados. El valor de catálogo agregado fue COP 501.075.540,93; el libro, que registra pesos enteros por asiento, quedó en COP 501.075.541. Se debitó inventario (1.5) y se acreditó capital de apertura (2.1), sin caja, proveedor ni compra. No se certificó una fecha de corte que no aparece confirmada en la fuente. No hubo un segundo descuento de existencias por entregas históricas.

Se preservó la base de Fase 4 por separado. La nueva instancia contiene una carga independiente con los mismos 37 créditos de dinero e incorpora los artículos. El reintento con selección reordenada mantuvo los conteos, el lote y la caja. La prueba de integración usa un expediente sintético adicional para comprobar simultaneidad, rollback y reversión sin destruir el lote de aceptación.

## Conciliación, hipótesis y exclusiones

Los 37 pagarés de dinero suman COP 19.794.000 abonados de origen y COP 82.651.000 de saldo calculado para el ensayo. En artículo, los montos suman COP 64.054.500 de avance histórico y COP 42.807.500 de saldo de prueba. Son acumulados del plan, no pagos registrados por el sistema ni saldos autorizados. Se comprobó que cada plan de cuotas suma lo abonado más lo pendiente.

Se compararon dos hipótesis para los artículos: el campo anterior `Monto` como precio total dejó 39 registros calculables; como valor ya financiado dejó 46. Se ensayó la segunda para abarcar más casos, no porque pruebe la práctica de cartera. Las 97 hipótesis efectivamente usadas indican original, valor de prueba y evidencia de la regla. No se grabaron como decisiones de cartera ni cambiaron la huella de la revisión. No se autorizaron los candidatos por ceros iniciales, y los registros sin código admitidos solo recibieron una referencia no comercial. Una quinta fila sin código mantiene otras condiciones sin resolver.

- **Inventario (3):** filas 100 y 102 sin costo; fila 1007 con plazos incompletos. No se agregó stock con costo ficticio. El esquema de catálogo exige un costo; en esta fase esos registros siguen en el expediente, no comercializables desde el sistema.
- **Dinero (16):** 14 filas tienen una referencia de cliente pendiente. Las filas 10 y 11 coinciden aritméticamente con Excel, pero dan saldos negativos de COP 2.360.000 y COP 2.550.000: el abono supera la obligación. No se ajustaron a cero ni se cambió el abono. Para la fila 44 faltan cliente verificable, fechas de otorgamiento y primer cobro, tipo de carga, obligación y abono.
- **Artículo (62):** quedan cantidades contractuales sin confirmar, identificación de artículos y clientes pendiente, y casos con avance, inicial o fecha sin evidencia. Se aislaron los 39 candidatos por ceros iniciales. No aplicar esa equivalencia, ni una regla de monto o de cuotas, a producción sin evidencia de cartera.
- **Clientes (81 no persistidos):** el lote persistió los clientes de los créditos seleccionados. No todos los restantes tienen error: hay clientes sin crédito seleccionado, además de 32 avisos de documento y cuatro conflictos de identidad en las filas no incorporadas. No fusionar personas por similitud.

El consolidado contiene el registro por fila, incluidos los datos no persistidos, la conciliación y los supuestos. Los archivos con datos reales son privados y no forman parte de Git. La plantilla reimportable usa documento o referencia de cliente, y catálogo comercial existente o artículos nuevos del libro. Las referencias de artículo **solo históricas** se resuelven en el expediente; no aparecen como SKU comercial en el desplegable operativo.

## Protocolo de aceptación (pendiente de cartera)

Realizar en escritorio y en un teléfono. No usar producción. El operador técnico debe habilitar únicamente el entorno aislado, compartir los archivos de manera privada y preparar cuentas de prueba. No copiar tokens, credenciales ni datos de pantalla a un canal público.

| Paso | Qué probar | Evidencia esperada |
| --- | --- | --- |
| 1 | Entrar como usuario de revisión; abrir el Centro de Importación y el expediente de prueba. | Se ve el expediente registrado y la revisión; no aparece como autorizado para cobrar. |
| 2 | Buscar clientes por nombre, documento y referencia provisional. Probar un caso sin ruta. | Identidad y ruta coinciden con el expediente, sin documentos ni asignaciones inventadas. |
| 3 | Revisar un crédito de dinero, uno de artículo con catálogo y uno sin catálogo. | Distinguir monto, inicial, total financiado, abonado y saldo; la ausencia de catálogo no se muestra como inventario disponible. |
| 4 | Contrastar cuotas, último pago y saldo con tarjetas de origen. | Registrar las diferencias por referencia, no corregir los abonos en la prueba. |
| 5 | Entrar a **Simulación de abonos**, elegir un borrador y proyectar un monto. | Se ve capital, interés y saldo proyectado; no cambian el plan, historial, reportes de caja ni pagos reales. |
| 6 | Ver ruta, inventario, apertura contable, reportes e historial; probar una operación ficticia en un lote separado. | El stock de apertura no se vuelve a descontar por cartera previa; los borradores no cuentan como pago o movimiento. |
| 7 | Abrir la plantilla de aceptación, seleccionar cliente existente y provisional y escribir un artículo nuevo. | Revisar listas, fórmulas protegidas y precio pactado; abono en blanco no equivale a cero. |

Registrar para cada paso: fecha, rol, dispositivo, referencia, resultado observado, esperado y evidencia sin datos personales. Estados: pendiente, conforme o incidencia. La aceptación aún no se ha ejecutado con trabajadoras de cartera.

## Verificación técnica

Los nombres de artefactos son `consolidado-historico-fase5.xlsx`, `plantilla-integral-aceptacion-fase5.xlsx` y `evidencia-postgresql-fase5.json`. La evidencia registra los conteos antes y después del reintento, no inventa una captura de la línea base anterior a la carga inicial.

La carga necesita `CREDISUR_HABILITAR_CARGA_HISTORICA_PRUEBA=1`, PostgreSQL loopback en el puerto 55483 y la base `fase3_pruebas`, fuera de producción. La simulación abre una transacción de solo lectura y busca únicamente en el lote vigente del expediente. La prueba real de PostgreSQL se habilita con `CREDISUR_IMPORTACION_TEST_URL` en esa misma instancia. Los conteos de Fases 2, 3 y 4 se reportaron para selecciones de suites y no son comparables como línea base global.

La instancia de aceptación no encola escrituras en el outbox ni las envía a la réplica. Nunca se debe aprovisionar esta instancia con credenciales de servicios externos. Los borradores y el stock de prueba no se copian a otra base.

| Verificación ejecutada | Resultado |
| --- | --- |
| Prisma y compilación | Esquema válido; compilación del backend y del frontend correctas. TypeScript del frontend sin errores. |
| Importación y PostgreSQL | Pasaron las suites de importación, fórmulas e integración aislada, incluidas concurrencia, reintento, rollback y reversión. |
| API real en la base aislada | Inicio de sesión y lectura de 83 borradores; sin sesión devuelve 401. Simulación correcta y pago efectivo rechazado por estado BORRADOR, sin cambios en cuotas, pagos, caja, notificaciones ni outbox. |
| Excel de escritorio | Ambos libros abrieron; la plantilla tiene fórmulas ocultas y protegidas. Un precio de prueba de 1.000 con inicial 100 deja saldo vacío si se desconoce el abono; con abono 0 muestra saldo 900. |
| E2E en Chromium | Preparación, reapertura y simulación pasaron en 390 y 1280 px, con respuestas HTTP simuladas en el navegador. No se ejecutó la batería E2E con cuentas y datos del entorno operativo. |
| Batería completa de backend | 1.153 pasaron, 3 fallaron y 1 quedó omitida en la última ejecución global; los fallos están en un invariante de rutas y dos comprobaciones estáticas de la implementación anterior de mora. Se verificaron aparte los ajustes posteriores de aislamiento. |
| Batería completa de frontend | 8.726 pasaron y 6 fallaron en controles generales ajenos a Importaciones (PDV, accesibilidad de pantallas y modales operativos). |

No ejecutar el despliegue de la migración, la importación de datos de negocio ni la rotación de secretos como parte de esta fase.
