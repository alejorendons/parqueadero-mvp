# Revisión de los avisos de SonarQube

## Dependencias de GitHub Actions

Todas las acciones se fijan a un SHA completo de 40 caracteres, comprobado contra la etiqueta del repositorio oficial. La etiqueta queda como comentario para facilitar futuras actualizaciones. El trabajo de verificación instala con `npm ci --ignore-scripts`: los scripts de instalación de las dependencias no se ejecutan. Los comandos explícitos de pruebas y construcción se mantienen.

## Herramientas ejecutadas en Linux

Las ramas del perfil Linux usan las rutas absolutas `/bin/bash` y `/usr/bin/flock`, propias del entorno administrado. Así no buscan esos programas en un `PATH` que pueda contener carpetas del proyecto. Estas ramas no se ejecutan durante el desarrollo portable de Windows.

## Vista previa de conectores

El parqueadero no usa conectores externos; esta herramienta está disponible para desarrollo y nunca se inicia desde la web publicada. Se conserva con límites de archivos explícitos:

- La carpeta autorizada se obtiene desde la ubicación del propio script. El argumento del proyecto debe resolver a esa misma carpeta.
- Los permisos se leen de un único archivo: `.sites-runtime/connector-preview-grants.json`. El argumento de permisos debe resolver a ese archivo regular y no puede ser un enlace simbólico.
- Las carpetas `.sites-runtime` y `connector-preview` no pueden ser enlaces o junctions hacia otro destino.
- Los buzones por sesión usan identificadores aleatorios y la limpieza se limita al buzón correspondiente.
- `https://preview.invalid/invoke` es una dirección de un objeto `Request` que se pasa a una función en memoria; no envía una petición de red.

Para iniciar una sesión autorizada, guarda primero el archivo de permisos en esa ubicación y pasa las rutas absolutas del proyecto y del archivo al script. Las pruebas de `preview-workspace.test.mjs` verifican el rechazo de proyectos externos, archivos arbitrarios y enlaces de directorio.

## Inicio de sesión local

El usuario simulado solo se habilita en desarrollo sobre loopback. La verificación exige tanto un nombre local permitido como una dirección remota loopback. Las direcciones IPv4 mapeadas en IPv6 se normalizan antes de compararlas. Los encabezados de identidad enviados por el cliente se eliminan antes de aplicar la simulación local.

La publicación sigue usando la autenticación privada del alojamiento. La verificación HTTP local comprueba que una identidad falsificada no concede acceso y que solicitudes desde otro origen se rechazan.

## Alcance y cobertura

El análisis de Cloud incluye el código de la aplicación, componentes y herramientas versionadas. No se han añadido exclusiones para ocultar los avisos reportados. El núcleo dispone de pruebas automatizadas; la cobertura global seguirá reflejando las partes de la interfaz y herramientas que aún no tienen pruebas.

Estas correcciones no desactivan la comprobación del Quality Gate. El resultado definitivo se comprueba en el nuevo análisis.

## Auditoría de dependencias del 13 de noviembre de 2026

Se revisó el árbol completo, además de `npm audit --omit=dev`. La segunda orden por sí sola es insuficiente: React Server Components y Vinext están declarados como herramientas de construcción, pero parte de su código llega al Worker publicado.

Se actualizaron versiones concretas y se regeneró el lockfile, sin ejecutar scripts de instalación:

| Dependencia                              | Versión comprobada      | Motivo                                                                                     |
| ---------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------ |
| Next.js / configuración ESLint           | 16.4.1                  | Correcciones de seguridad del framework                                                    |
| React, React DOM y RSC                   | 19.2.9                  | Corrección RSC manteniendo la rama 19.2                                                    |
| Zod                                      | 4.6.6                   | Validación corregida; protocolo adaptado y probado con registros de clave/valor explícitos |
| Vite                                     | 8.1.6                   | Correcciones del servidor de desarrollo en Windows                                         |
| sharp                                    | 0.35.5                  | Corrección de librsvg; también se actualiza el override de Miniflare                       |
| source-map-js / baseline-browser-mapping | 1.2.2 / 2.11.0          | Correcciones de consumo de recursos                                                        |
| image-size / undici / ws                 | 2.0.3 / 7.30.1 / 8.21.0 | Correcciones transitivas compatibles                                                       |

Se actualizaron también las dependencias permitidas por los rangos actuales. Se conserva la versión del runtime Vinext; migrar ese runtime requiere una revisión independiente. Los overrides fijan las correcciones transitivas mientras las herramientas actualizan sus dependencias.

`audit:security` analiza **todo** el árbol y hace fallar CI si aparecen avisos altos o críticos. Los avisos moderados siguen visibles. Se deben revisar periódicamente, porque la base de avisos cambia aunque el código no cambie.

Resultado de esta comprobación: `npm audit --omit=dev` no reporta avisos; el árbol completo reporta 18 moderados y 2 bajos, sin altos ni críticos. Estas cifras son una fotografía de la fecha indicada, no una garantía de ausencia de vulnerabilidades.

Las familias aún pendientes son las dependencias de glob/minimatch de cobertura y análisis, esbuild de las herramientas de migración/construcción y Satori de la función de imágenes OG de Vinext. El producto no define rutas de imágenes OG ni expone un servidor esbuild. La vista previa local permanece en loopback. Resolverlas exige actualizar o migrar las herramientas que las incorporan, con prueba de compatibilidad; no se fuerza un cambio mayor de esas bibliotecas desde un override global.

Referencias verificadas: [React RSC](https://github.com/advisories/GHSA-xqc2-xf4c-x3h3), [Next.js](https://github.com/advisories/GHSA-2464-fhr4-w9xw), [Zod](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), [migración Zod 4](https://zod.dev/v4/changelog), [Vite en Windows](https://github.com/advisories/GHSA-587h-7wmj-h5pm), [sharp](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) y [source-map-js](https://github.com/advisories/GHSA-68fv-2mgg-jv7q).
