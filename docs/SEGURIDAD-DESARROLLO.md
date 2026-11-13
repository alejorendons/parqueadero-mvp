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
