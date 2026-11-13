# Parqueadero MVP

Aplicación web responsive para operar **un parqueadero en El Retiro, Antioquia, Colombia**. Incluye carros y motos, entradas por placa, horas automáticas, tarifas configurables, estadías activas, cobros, pagos, caja y reportes CSV.

**Arquitectura:** monolito modular con capas. Una aplicación React/TypeScript, API del servidor y base SQL persistente D1/SQLite. Sin microservicios ni multiempresa en esta primera versión.

## Empezar

Requisitos: Node.js 22.17 o posterior de la rama 22, npm y Git. No hace falta instalar Python ni un servidor SQL para el desarrollo local.

```sh
git clone https://github.com/alejorendons/parqueadero-mvp.git
cd parqueadero-mvp
npm ci --ignore-scripts
npm run build
```

En una copia nueva, aplica la migración a la base **local**:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_low_dragon_lord.sql
npm run dev
```

Abre la dirección que aparezca en la terminal, normalmente `http://127.0.0.1:5173/`. El entorno local simula el inicio de sesión con un usuario de prueba. Si fuera necesario, visita `/signin-with-chatgpt?return_to=/`. La base local persiste en `.wrangler/state` y no se incluye en Git.

La migración inicial se aplica **una vez por base nueva**. No repitas ese comando si ya existen las tablas. Las siguientes migraciones deben aplicarse en orden y sin modificar las ya aplicadas. Consulta [Despliegue y operación](docs/DESPLIEGUE.md).

## Primer recorrido

1. Abre **Tarifas y datos** y completa los datos reales del negocio y tarifas.
2. En **Caja**, abre un turno con el efectivo disponible para dar cambio.
3. En **Operación**, elige carro o moto, ingresa la placa y describe el estado del vehículo. Imprime su recibo de entrada.
4. Cuando regrese el cliente, busca la placa y pulsa **Cobrar**. Verifica el total y el medio, confirma pago y salida, e imprime el comprobante.
5. Revisa **Reportes** por fechas y exporta CSV. Al terminar, cuenta el efectivo y cierra caja.

Valores iniciales de ejemplo: carro **$4.000** y moto **$2.000** por hora o fracción, sin tolerancia. Se pueden configurar bloques de 1, 15, 30 o 60 minutos con su precio. No son tarifas municipales verificadas. Una tarifa modificada afecta solo entradas nuevas.

Una cotización reserva el valor durante 60 segundos para pagar. Si vence, se actualiza. Las transferencias y tarjetas se registran manualmente después de verificarlas; el sistema no procesa pagos bancarios.

## Verificación y SonarQube

```sh
npm run typecheck
npm run lint
npm run audit:security
npm test
npm run build
```

Las pruebas ejercitan el dominio y los casos de uso sobre SQLite con las migraciones reales (`test:core`), y los recorridos de interfaz y cliente HTTP con React Testing Library/Vitest (`test:web`). Generan `coverage/core/lcov.info` y `coverage/web/lcov.info`. GitHub Actions repite la verificación y envía ambos reportes a SonarQube.

- [Conectar SonarQube Server o Cloud](docs/SONARQUBE.md)
- [Guía de pruebas y aceptación](docs/PRUEBAS.md)
- [Alcance, reglas y arquitectura](docs/ARQUITECTURA.md)
- [Revisión de producto, mapa de integraciones y decisiones](docs/REVISION-PRODUCTO.md)
- [Guía de despliegue y operación](docs/DESPLIEGUE.md)
- [Seguridad y dependencias pendientes](docs/SEGURIDAD-DESARROLLO.md)

El flujo de análisis está preparado; la aprobación del Quality Gate se conoce solo después de ejecutar Sonar contra tu proyecto. La interfaz no está excluida de la cobertura de Sonar para inflar el porcentaje.

## Estructura

```text
app/                  Interfaz, estilos y API autenticada
application/          Casos de uso de la operación
domain/               Placas, liquidación y fechas de Colombia
db/                   Definición del esquema
drizzle/              Migraciones SQL y metadatos
tests/                Pruebas del núcleo e integración SQLite
docs/                 Arquitectura, pruebas, despliegue y SonarQube
.github/workflows/    Verificación y análisis
.openai/hosting.json   Configuración de la publicación en Sites
```

## Límites de esta versión

Un parqueadero, acceso privado del propietario y una caja abierta a la vez. No incluye roles de empleados, anulaciones, mensualidades, reservas, operación offline, cámaras, capacidad física, pasarela de pago, facturación electrónica ni multiempresa. Los comprobantes son operativos y no son facturas electrónicas.

Antes de usar datos reales, valida tarifas y condiciones aplicables con el municipio, completa la información del establecimiento, verifica la impresora y define un respaldo con restauración probada. No cambies la publicación a pública: los permisos de cada operador deben diseñarse antes de compartirla.

## Tecnología

React 19, TypeScript, Vinext/Vite, Cloudflare Workers, D1 (SQLite) y Drizzle. Las versiones exactas están en `package-lock.json`. Vinext es un runtime beta; las actualizaciones deben probarse antes de promoverlas a operación.

El alojamiento inicial usa la autenticación privada de Sites. Un despliegue independiente exige reemplazar esa frontera por autenticación validada en el servidor; no basta con publicar el Worker directamente ni aceptar encabezados de identidad enviados por Internet.
