# Preparación de cartera histórica

## Alcance de la fase

La preparación procesa libros de cartera e inventario en memoria. No abre una conexión a PostgreSQL, no confirma lotes y no registra movimientos ni pagos. El consolidado conserva las hojas de origen y el expediente de cambios. Sus hojas de trabajo tienen nombres distintos a los que reconoce el importador, para impedir su carga accidental.

La plantilla integral combina las hojas de captura de los dos generadores modulares. Los artículos registrados en el mismo libro se suman al selector del catálogo, sin enlaces externos. Las fórmulas consultan el artículo del libro y usan el catálogo descargado como respaldo. El formato de cartera histórica conserva el precio pactado, la inicial, las cuotas y el avance informado; no usa el precio comercial vigente.

## Ejecución local

Con el backend compilado, ejecute el preparador sin arrancar Nest ni configurar una base:

```powershell
npm run build
npm run preparar:historicos -- --cartera "C:\Privado\cartera.xlsx" --inventario "C:\Privado\inventario.xlsx" --salida "C:\Privado\consolidado-revision.xlsx" --modelo-decisiones "C:\Privado\decisiones.json"
```

La carpeta de salida debe existir y estar fuera de cualquier repositorio, incluso si Git ignora sus Excel. El programa no sobrescribe archivos. Registra únicamente conteos en consola; los datos de las filas se guardan en el consolidado privado. No suba ni use estos archivos como fixtures.

El Centro de Importación ofrece **Preparación histórica** y la descarga de **Plantilla integral**. **Revisar archivos** muestra valores de origen y propuestas, acepta decisiones por lote o por fila con evidencia y permite reevaluarlas. Al registrar, el servidor incorpora el usuario autenticado y la fecha UTC. Descargue el expediente de decisiones para retomar la revisión; no se registra en la base. La huella permite comprobar si corresponde a la misma revisión, no es una firma digital. La confirmación sigue siendo modular, primero inventario y luego cartera. No hay una transacción de confirmación integral.

## Decisiones reproducibles

El modelo de decisiones contiene la versión y los SHA-256 de las dos fuentes. Una modificación en cualquiera de los originales invalida el juego de decisiones: revise las referencias antes de aprobar de nuevo. El mismo par de libros y las mismas decisiones producen las mismas filas y referencias; los metadatos ZIP del Excel de salida no se usan como prueba de igualdad.

- En «reglas», «cerosIniciales» acepta «valor: true» y «evidencia». Solo se aplica a una coincidencia numérica única sin código exacto. Nunca resuelve colisiones.
- «montoArticulo» acepta «PRECIO_TOTAL» o «FINANCIADO» con evidencia. «interpretacion_monto» por fila tiene prioridad. Una inicial positiva no es prueba de cuál interpretación utilizó la empresa.
- «cuotasPorFrecuenciaIndividual» permite decidir por frecuencia. Una decisión por fila prevalece sobre el lote; un rechazo impide aplicar la regla general sobre ese campo. Sin aprobación, una cantidad derivada de plazo y frecuencia queda como propuesta.
- En «filas» cada decisión tiene «referencia», «campo», «valor» y «evidencia». «consolidar_cliente», «cliente_ref» y «articulo_ref» reciben una referencia técnica del consolidado. Con prefijos provisionales repetidos, «identidad_distinta» requiere aprobación de cada registro que siga activo en el grupo.
- Para datos faltantes se pueden aportar «precio_pactado», «financiado», «inicial», «abonado», «saldo_informado», «saldo_corte», «cuotas» y las fechas individuales. «sin_ajustes: true» requiere evidencia de que no hubo otros cargos, descuentos ni condonaciones. Para deducir el abono también es necesaria una fecha de corte. No se fabrican pagos individuales.

Los candidatos de fechas se documentan con la convención que los explica; no sustituyen fechas originales, no se convierten en mora y no autorizan un cargo. «PARA_VALIDAR» solo significa que la preparación no encontró un conflicto; no es un crédito certificado.

## Plantillas y conciliación

- Las fórmulas tienen protección y están ocultas en Excel mientras la hoja siga protegida. Precios manuales, número de crédito manual y cuotas pactadas tienen celdas de captura separadas. La protección evita cambios accidentales; no autoriza datos ni sustituye la validación del backend.
- El costo dividido por el divisor es la base. Se conservan los decimales de la división para los recargos; el valor persistido se trunca a pesos. Los recargos respaldados por el catálogo original son 30 %, 47 % y 60 % a 3, 5 y 8 meses respectivamente. Para otro plazo se exige precio manual. La interpolación/extrapolación venía de los commits `8a9b58d` y `1046cde`; no es una política aprobada. Queda como cálculo de análisis, fuera del precio aplicado.
- Las plantillas nuevas preparan 1.000 registros por hoja, de la fila 7 a la 1006. El validador bloquea las filas fuera del rango en esas plantillas; para las anteriores conserva el aviso. No se usan tablas autoextensibles: el crecimiento tendría que conservar protección, fórmulas, listas y compatibilidad de Excel. Use otro lote cuando alcance el límite.
- En históricos, el valor pactado de la primera cuota se coteja con el plan y una diferencia bloquea la carga. Consistencia matemática, condiciones verificadas y saldo autorizado son estados separados. La autorización requiere corte, método (tarjeta física o saldo independiente de cartera), evidencia y coincidencia de cifras sin excepciones pendientes. Autorizar una revisión todavía no habilita cobranza.

## Paso a preproducción

1. Resuelva las filas bloqueadas por identidad, monto, fecha o conciliación. No registre el consolidado interno como lote.
2. Contraste clientes, rutas, existencias y artículos contra la base aislada. Para clientes nuevos en cartera histórica, use «Tipo de cliente = HISTORICO». No completa apellidos o teléfonos. Si falta la cédula, el sistema asigna una referencia técnica; sin ruta no puede confirmarse un crédito asociado.
3. Separe las referencias de artículos históricos sin código. La preparación las identifica y permite aprobarlas como referencias de historial; no las crea como productos ni les atribuye costo o existencias. Su persistencia como entidad histórica queda pendiente.
4. Retenga una copia privada de fuentes, decisiones y consolidado. Valide primero una muestra sintética y pruebe funcionamiento, idempotencia y reversión en una base dedicada, sin notificaciones de clientes. Solo después autorice un lote real y concilie totales antes y después.

## Registro técnico

- Fase 1: validación de precio pactado, avance y saldo de históricos y conservación de abonos al exportar.
- Fase 2: preparador sin escritura, expedientes por fila, candidatos y decisiones con huellas, consolidado privado, plantilla integral compartida, captura de clientes históricos y descarga desde el módulo existente.
- Fase 3: versión de reglas y huella canónica de decisiones, evidencia de resultados de fórmula (incluido cero), revisión visual, separación entre precios manuales y calculados, lista de clientes y límites coherentes. La reversión solo devuelve existencias si se registró la venta operativa; vincular un producto a un crédito histórico no genera stock al revertirlo.
- Los dos consolidados anteriores eran borradores de distintas versiones. Seis costos decimales recuperaron su estado de validación y la revisión empezó a señalar tres precios de plazo faltantes en una fila. Se confirmó además la pérdida de 81 ceros guardados en fórmulas al leer la representación serializada de ExcelJS; se corrigió usando el resultado de la celda y conservándolo como evidencia. El consolidado V3 reemplaza ambos borradores para revisión.
- No hay nuevas migraciones ni cambios en políticas oficiales de margen, tasas o recargos. El expediente JSON versionado no registra aprobaciones en la base ni es importable como cartera.
- La prueba `importacion-historica.aislada.spec.ts` usa solo PostgreSQL en `127.0.0.1`, puerto no estándar y base dedicada `fase3_pruebas`. Después de aplicar las migraciones a esa instancia, defina `CREDISUR_IMPORTACION_TEST_URL` y ejecute `npm test -- --runInBand importacion-historica.aislada.spec`. La prueba comprueba persistencia y reversión con datos ficticios. Un reintento de CREAR puede ser rechazado por duplicidad; el conjunto de efectos persistidos debe quedar intacto.
