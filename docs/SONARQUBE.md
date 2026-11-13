# Conexión con SonarQube

El repositorio incluye `sonar-project.properties`, pruebas con salida `coverage/lcov.info` y `.github/workflows/quality.yml`. No necesita subir `node_modules`, `coverage`, `dist` ni bases locales para ser analizado: GitHub Actions instala, verifica, prueba y genera cobertura desde el código versionado.

## 1. Elegir Server o Cloud

**SonarQube Server:** crea/importa el proyecto con clave `parqueadero-mvp` o usa otra clave mediante `SONAR_PROJECT_KEY`. El servidor debe ser accesible desde el runner de GitHub. `http://localhost:9000` desde un runner alojado en GitHub apunta al runner, no a tu computador.

**SonarQube Cloud (sonarcloud.io):** importa `alejorendons/parqueadero-mvp` en tu organización. Copia exactamente la organización y la clave que muestre Sonar; una clave habitual es `alejorendons_parqueadero-mvp`, pero compruébala en la configuración del proyecto. Si usas este flujo de CI, desactiva el análisis automático de Cloud para no duplicar los análisis y poder importar LCOV.

## 2. Configurar GitHub

En el repositorio: **Settings → Secrets and variables → Actions**.

Secrets:

| Nombre      | Contenido                                               |
| ----------- | ------------------------------------------------------- |
| SONAR_TOKEN | Token de análisis del proyecto con el alcance necesario |

Variables:

| Nombre             | SonarQube Server                            | SonarQube Cloud                     |
| ------------------ | ------------------------------------------- | ----------------------------------- |
| SONAR_ENABLED      | `true`                                      | `true`                              |
| SONAR_HOST_URL     | URL HTTPS de tu servidor                    | `https://sonarcloud.io`             |
| SONAR_PROJECT_KEY  | Clave exacta; por defecto `parqueadero-mvp` | Clave exacta del proyecto importado |
| SONAR_ORGANIZATION | Dejar vacía                                 | Clave exacta de tu organización     |
| SONAR_RUNNER       | Opcional; por defecto `ubuntu-latest`       | Dejar vacía normalmente             |

No pegues tokens en este documento, archivos `.env`, commits o capturas. Si usas SonarQube Server en red privada, configura un runner de confianza con acceso de red y define `SONAR_RUNNER=self-hosted`; no expongas el servidor solo para hacer una prueba.

## 3. Ejecutar

Después de configurar las variables, abre **Actions → Pruebas y SonarQube → Run workflow**, eligiendo `main`, o sube un commit a `main`.

El trabajo `verify` ejecuta comprobación de tipos, pruebas, cobertura y compilación. El trabajo `sonar` se activa solo con `SONAR_ENABLED=true` y en pushes/ejecuciones manuales; los PR ejecutan verificación sin secretos. El scanner espera el resultado del Quality Gate (`sonar.qualitygate.wait=true`), por lo que un fallo del umbral configurado en Sonar hará fallar ese trabajo.

Si `sonar` aparece omitido, revisa la variable `SONAR_ENABLED`. Si hay error de autorización, verifica el token, la clave y la organización. Si no llega a la URL del servidor, revisa la red del runner. Un fallo de Quality Gate requiere leer los hallazgos y ajustar el código o el umbral del proyecto de forma consciente.

## 4. Cobertura honesta

`npm test` prueba el cálculo de tarifas y el servicio contra SQLite con las migraciones reales. `c8` produce LCOV para dominio y servicio. Sonar analiza también la interfaz, API y esquema: esas líneas pueden aparecer sin cobertura. La cobertura del núcleo **no equivale** a cobertura de toda la aplicación. No se han excluido las pantallas para inflar el resultado.

La revisión del navegador es una prueba de aceptación manual y no añade cobertura a LCOV. La preparación del repo no implica que el Quality Gate ya haya aprobado: eso se comprueba con un análisis real conectado a tu proyecto.

## 5. Referencias oficiales

- [Acción oficial de SonarQube](https://github.com/SonarSource/sonarqube-scan-action)
- [Cobertura JavaScript/TypeScript](https://docs.sonarsource.com/sonarqube-server/analyzing-source-code/test-coverage/javascript-typescript-test-coverage)
