# Importación histórica de CrediSur: Fase 4

## Separación de estados

El expediente identifica las dos fuentes por SHA-256 y la versión del preparador. Persiste en PostgreSQL la revisión inicial, sus hallazgos y la evidencia de origen. Cada decisión produce una revisión nueva, atribuida al usuario autenticado y a la fecha del servidor. Un guardado sobre una revisión obsoleta devuelve conflicto. Cargar de nuevo el mismo par de Excel abre el expediente vigente; no reemplaza decisiones. El JSON sigue disponible para respaldo y revisión sin persistencia, pero no sustituye el historial registrado.

El saldo calculado, las condiciones verificadas y la autorización de cobranza son hechos distintos en el resultado de cada revisión. La carga aislada utiliza exclusivamente registros explícitamente seleccionados, sin excepciones y matemáticamente consistentes. En esta implementación no existe una promoción de la carga a cartera operativa. El préstamo queda en BORRADOR, PENDIENTE de aprobación y marcado como solo prueba; PostgreSQL impide activarlo por la vía ordinaria.

## Persistencia y reversión

- Un cliente histórico sin documento queda con DNI nulo. No se genera un número ficticio. El identificador interno y el expediente conservan el vínculo con sus créditos cuando después se registra la cédula real.
- La referencia exclusivamente histórica se conserva en una entidad distinta de Producto porque Producto exige costo y participa en inventario comercial. No se crea un producto, stock ni precio. La consulta de crédito expone su referencia y los datos conocidos.
- Se reutiliza la confirmación existente de clientes, créditos, cuotas y avances, con la transacción del expediente y sin emitir notificaciones. Resolver referencias, confirmar el lote y guardar correspondencias sucede en la misma transacción. Una selección inviable falla, no se carga parcialmente. Las filas excluidas se enumeran.
- Una repetición con la misma revisión y las mismas referencias devuelve el lote anterior. Una selección concurrente diferente no reemplaza el lote. La reversión se hace desde el expediente, conserva el historial de referencias y no genera compensaciones sin un movimiento original.
- La carga de inventario comercial sigue usando su importación modular. No se incluye todavía en la misma transacción histórica.

## Acceso y pruebas

En el Centro de Importación, **Revisar archivos** abre o crea el expediente; **Expedientes guardados** permite retomarlo en otro dispositivo autorizado. Para la plantilla, un identificador técnico del tipo HIST-LIBRO-001 se escribe en **Referencia de importación** del cliente histórico. También se admiten las referencias CLIENTE-... del consolidado. Al cotejar la primera cuota de un artículo, el Excel muestra el importe calculado, el pactado, lo que se aplicaría y la diferencia. Una diferencia se revisa; no reemplaza automáticamente el plan. El residuo sigue en la última cuota.

Los endpoints `POST /importaciones/historicos/expedientes/:id/confirmar-prueba` y `POST .../:id/revertir-prueba` están reservados al superadministrador. Solo operan en la instancia PostgreSQL aislada, `127.0.0.1:55483/fase3_pruebas`, con `CREDISUR_HABILITAR_CARGA_HISTORICA_PRUEBA=1` y fuera de producción. El servicio verifica además la base y el puerto de la conexión. Para probar con datos sintéticos, defina `CREDISUR_IMPORTACION_TEST_URL` apuntando a esa base y ejecute:

```powershell
npm test -- --runInBand expediente-historico.aislada.spec importacion-historica.aislada.spec preparar-historicos.spec
```

## Bitácora

- Se procesaron nuevamente los 536 registros sin cambiar los archivos fuente: 373 para validar, 163 por revisar y 0 saldos autorizados.
- En PostgreSQL aislado se cargaron 37 clientes, 37 créditos de dinero y 270 cuotas. Se conservaron 75 correspondencias (clientes, préstamos y una ruta de prueba). Se excluyeron 124 créditos, incluidos los 108 de artículo. No se aplicaron aprobaciones empresariales ficticias ni se corrigieron los abonos de los créditos de dinero con diferencias.
- La prueba con los archivos reales reutilizó el mismo lote al repetir la operación. No cambió el total de pagos, asientos, movimientos ni stock. Los casos sintéticos comprobaron además el artículo histórico sin catálogo, la concurrencia, el rollback por conflicto intermedio y la reversión.
- El consolidado Fase 4 añade la hoja Carga aislada con las correspondencias y exclusiones. No es una plantilla importable ni una autorización.
- Antes de la aceptación de cartera queda pendiente revisar las equivalencias, los duplicados y los saldos con evidencia empresarial. La validación en Playwright cubre la reapertura y revisión en móvil y escritorio con API simulada; no sustituye una sesión de aceptación de cartera ni pruebas de cobro de punta a punta.
