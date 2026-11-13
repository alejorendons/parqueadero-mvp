# Despliegue y operación

## Desarrollo local

1. Usa Node.js 22.17+ de la rama 22 y ejecuta `npm ci`.
2. Ejecuta `npm run build` para generar el Worker y su configuración local con el binding `DB`.
3. En una base nueva aplica el SQL inicial con el comando del README. La carpeta `.wrangler/state` conserva los datos locales.
4. Ejecuta `npm run dev`, abre la URL local y usa el inicio de sesión simulado de loopback.
5. Ejecuta `npm run typecheck`, `npm test` y `npm run build` antes de publicar.

En Windows, si npm no puede escribir su caché, configura una caché escribible para esa sesión:

```powershell
$env:npm_config_cache = Join-Path (Get-Location) '.sites-runtime/npm-cache'
npm ci
```

Si la herramienta de migraciones falla por restricciones del entorno al consultar el usuario de Windows, ejecútala desde una terminal local con acceso normal a tu sesión. No es necesario modificar las reglas de cobro para resolver ese fallo.

## Publicación inicial en Sites

Esta versión está preparada para Cloudflare Workers + D1 mediante Sites, con acceso privado del propietario.

- `.openai/hosting.json` conserva la identidad del sitio y declara `"d1": "DB"`; `r2` no se usa.
- La construcción se realiza con `npm run build` (o el helper de construcción de Sites).
- El artefacto del servidor es `dist/server/index.js`; los recursos cliente están en `dist/client`.
- El origen versionado debe incluir `drizzle/*.sql`, su journal y snapshots. El flujo de publicación de Sites aplica las migraciones a D1 antes de desplegar.
- La base publicada se provisiona aparte de la local. No copies `.wrangler` ni datos de prueba al repositorio o al archivo de publicación.
- Publica una versión del commit exacto que pasó las verificaciones y espera a que el despliegue termine correctamente antes de reportar la URL como disponible.

La publicación privada usa el inicio de sesión del alojamiento y sus encabezados de identidad validados. El código requiere una identidad también en cada petición de API. La aplicación no incluye un gestor independiente de usuarios y contraseñas.

El workflow de GitHub incluido es de calidad, **no publica automáticamente**. Un push a GitHub no aplica migraciones ni modifica la base publicada. Usa el flujo de publicación del alojamiento para promover una versión validada.

## Alojamiento independiente posterior

La salida es un Worker ESM, no un servidor Node convencional. Para desplegarla en tu propia cuenta de Cloudflare será necesario configurar D1, aplicar las migraciones, servir los recursos cliente y añadir una frontera de autenticación verificable en el servidor (por ejemplo, un control de acceso con validación de identidad adecuada). Los encabezados `oai-authenticated-user-*` solo deben confiarse detrás del alojamiento que los valida y reemplaza.

No publiques el Worker sin autenticación en una URL pública ni consideres secreto el project ID. Si prefieres un VPS con un servidor Node/PostgreSQL, habrá que adaptar el runtime y la persistencia. Mantener las reglas del dominio separadas reduce ese trabajo, pero no hace esos destinos intercambiables con un solo comando.

## Cambios de esquema

```sh
npm run db:generate
```

Revisa el SQL generado, añade la migración al control de versiones y prueba con una base separada. Las migraciones ya aplicadas son inmutables. Esta migración inicial incluye triggers de integridad añadidos manualmente; futuras revisiones deben conservarlos. Drizzle no representa esos triggers en su snapshot.

No ejecutes comandos de creación/borrado de tablas durante solicitudes normales. Las tablas se crean exclusivamente por migraciones. No borres registros reales para preparar una demostración.

## Preparación del negocio

Completa nombre, dirección, NIT, aseguradora, póliza y reclamaciones; confirma la tarifa que corresponde al establecimiento y la forma de informar al cliente. Prueba una impresión en el equipo real y revisa la hora de Colombia en el recibo. Define quién tendrá acceso: la primera publicación permite solo al propietario y no implementa permisos por empleado.

Los valores iniciales son ejemplos. El recibo operativo no implementa facturación electrónica ni cálculo tributario. La obligación concreta y sus detalles deben revisarse para el negocio antes de usar el sistema como herramienta definitiva.

## Copia y recuperación

El repo respalda el **código**, no las transacciones. El CSV es un reporte de pagos y tampoco permite reconstruir por sí solo toda la base.

Antes de operar con datos reales, configura un mecanismo de copia de la base completo con el proveedor, frecuencia, retención y responsables. Para D1 administrado en una cuenta propia, revisa [exportación/importación](https://developers.cloudflare.com/d1/best-practices/import-export-data/) y las opciones de recuperación de la cuenta. En el alojamiento de Sites, verifica qué acceso de exportación/restauración ofrece la cuenta; esta aplicación no ha implementado un botón de respaldo ni una tarea programada.

Ensaya la restauración en un entorno separado: configura negocio, registra un ingreso, pago y cierre; crea la copia; restaura y compara estadías, pagos, movimientos y turnos. No des por verificada la recuperación hasta completar ese ensayo.

## Recuperación de incidentes

- **Se pierde Internet:** no confirmes pagos a ciegas. Restablece conexión y consulta últimas salidas/recibo antes de reintentar. La misma cotización pagada es idempotente; si vence, consulta de nuevo la estadía.
- **Dos operadores cobran la misma placa:** los índices únicos permiten un solo pago. Actualiza ambas pantallas y verifica el comprobante existente.
- **Caja cerrada mientras se cobraba:** el servidor rechaza el pago si la caja ya cerró. Abre el turno correcto y vuelve a liquidar.
- **Diferencia de efectivo:** registra el conteo real y explica la diferencia en el cierre. No se edita un pago histórico para forzar el cuadre.
- **Fallo al publicar:** revisa el despliegue y el estado de migraciones antes de reintentarlo. Una migración puede haberse aplicado aunque el despliegue falle. Restaurar código anterior no revierte automáticamente el esquema ni los datos.

## Promoción a operación

El piloto requiere pruebas en los equipos reales, datos completos, tarifa validada, análisis SonarQube revisado, acceso restringido y respaldo con restauración comprobada. La verificación inicial de software está documentada en `PRUEBAS.md`; esos controles del negocio siguen siendo una etapa previa al uso real.
