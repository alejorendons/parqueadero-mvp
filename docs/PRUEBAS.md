# Guía de pruebas y aceptación

Ejecuta los casos manuales solo en desarrollo o en un parqueadero de prueba. Los cobros del sistema son registros operativos; no se envía dinero ni se procesa un datáfono.

## Automatizadas

```sh
npm ci --ignore-scripts
npm run typecheck
npm run lint
npm test
npm run build
```

Las pruebas usan una base SQLite nueva en memoria por caso y las migraciones versionadas. El reloj se controla para probar límites exactos sin esperar una hora. El adaptador de pruebas implementa `batch()` mediante una transacción real; la API publicada usa el batch nativo de D1. Las pruebas en SQLite no sustituyen una prueba de integración contra D1/Workers.

Casos cubiertos: placas y normalización; límites de hora exacta y fracción; tolerancia; bloques por minuto; cambio de tarifa conservando estadías previas; caja cerrada; importes inválidos; doble pago e idempotencia; cotización expirada; pagos concurrentes de la misma estadía; movimientos sobre turno cerrado; retiros superiores al saldo; cierre y diferencia; separación de efectivo y pagos digitales; fechas de Colombia y reportes.

La cobertura del núcleo queda en `coverage/core/lcov.info`; la de interfaz y cliente HTTP, en `coverage/web/lcov.info`. Ambas se generan localmente y en CI, sin versionarse.

Los recorridos de interfaz prueban entrada de motos, validación de placa y duplicados, búsqueda y filtros, pago con cambio, verificación manual digital, cotización vencida, reimpresión, reintento de movimiento, revisión/cierre, consultas y CSV, paginación, conservación y descarte de tarifas, sesión vencida, recuperación de conexión y descarte de respuestas obsoletas. Son pruebas DOM en jsdom: se complementan con revisión en un navegador real.

## Recorrido manual

1. En Tarifas y datos, conserva los ejemplos: carro $4.000/hora y moto $2.000/hora, tolerancia cero.
2. Abre caja con $50.000. Intenta abrir otra: debe rechazarla.
3. Registra `TST123` como carro, observación `Vehículo ficticio; prueba local`. Comprueba recibo con placa, hora y tarifa.
4. Repite esa entrada: debe rechazar la placa duplicada y conservar una sola estadía.
5. Registra `TST12D` como moto; usa el filtro Motos y busca su placa.
6. Cambia la tarifa de carros a $6.000. Consulta el carro anterior: debe conservar $4.000. Una nueva placa de carro debe tomar $6.000.
7. Consulta el cobro de `TST123`, dentro de su primer bloque. Debe mostrar $4.000. Ingresa $3.000: no debe confirmar. Ingresa $10.000: cambio $6.000.
8. Confirma pago y salida: el carro desaparece de activas, aparece en últimas salidas y se puede reimprimir el recibo.
9. Intenta repetir el pago desde otra pestaña: no debe crear una segunda venta. Refresca para ver el estado definitivo.
10. Liquida la moto y espera más de 60 segundos: el botón de confirmar debe deshabilitarse y pedir actualizar. Actualiza y registra transferencia después de verificar el pago ficticio.
11. En reportes consulta el día actual: debe sumar $6.000 ($4.000 efectivo y $2.000 transferencia), con los precios indicados para esas entradas. Exporta CSV y comprueba las filas.
12. La caja debe tener $54.000 físicos esperados: $50.000 de base más $4.000 efectivo. La transferencia no aumenta ese saldo.
13. Retira $10.000 con motivo. El esperado debe bajar a $44.000. Intenta retirar más del saldo: debe rechazarlo.
14. Cierra contando $43.500: diferencia −$500. Comprueba historial y rechazo de pagos mientras no exista un turno nuevo.
15. Recarga el navegador: los registros deben persistir. Abre otra pestaña: debe ver la misma operación.
16. Revisa a 390 px y en escritorio: navegación, formularios, diálogo y tablas con desplazamiento horizontal dentro de su panel. Usa teclado y Escape para cerrar diálogos.

## Seguridad e integridad

- Sin sesión, la API devuelve 401 y la página exige iniciar sesión.
- POST sin JSON/encabezado de la aplicación o con otro origen devuelve 403.
- Enviar una hora de ingreso o un total calculado por el navegador no sustituye el reloj ni el total del servidor.
- Una falla al guardar el pago debe conservar activa la estadía y no dejar un cobro parcial.
- En dos pestañas, cierre y pago simultáneos deben conservar el cuadre: pago confirmado antes del cierre incluido, o pago rechazado si el turno ya cerró.
- Evita probar reintentos mediante inserciones manuales en producción. Usa las pruebas automáticas y una base separada.

## Verificación inicial realizada

El 13 de noviembre de 2026 se ejecutaron las pruebas del núcleo, comprobación de tipos y compilación. En un navegador local se recorrieron apertura con $50.000, entrada ficticia `TST123`, pago de $4.000 con $10.000 recibidos y $6.000 de cambio, reporte y descarga CSV, y cierre de $54.000 con diferencia cero. Se inspeccionó la vista móvil de 390 px sin desbordamiento horizontal de la página.

Pendiente antes del uso real: ensayo con la impresora del negocio, acceso desde los dispositivos que operarán, política de respaldos y restauración y verificación de datos/tarifas reales. SonarQube se comprueba en cada ejecución conectada de Actions.
