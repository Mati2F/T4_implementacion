# Chat · frontend (React + Chakra UI)

Interfaz web del chat. Habla **solo** con el gateway: usa GraphQL (`/graphql`) para datos y subidas, y la ruta HTTP del mismo gateway para descargar archivos. No consulta directamente a los servicios.

## Ejecutar
Requisitos: Node 18+ y el gateway levantado (por defecto en `http://localhost:5000`).

```bash
npm install
npm run dev          # http://localhost:5173
```
Para desarrollo sin Nginx, el cliente usa `http://localhost:5000/graphql` por defecto. Si copias `.env.example` a `.env`, cambia `VITE_GATEWAY_URL` a esa dirección antes de usar `npm run dev`.
Build de producción: `npm run build` (queda en `dist/`).

## Con Docker
```bash
docker compose up --build        # http://localhost:3000
```
Levanta primero el gateway y sus servicios en la red `microsvcs`. El frontend también se conecta a esa red. Por defecto se compila con `VITE_GATEWAY_URL=/graphql`: el navegador usa el mismo origen del frontend y Nginx reenvía `/graphql` y `/media/...` a `http://chat-gateway:8000`.

Nginx escucha internamente en 8080, publicado como `http://localhost:3000` por Compose. Su variable `GATEWAY_UPSTREAM` se aplica al arrancar el contenedor mediante una plantilla. En cambio, `VITE_GATEWAY_URL` queda compilada en el JavaScript: cambiarla requiere reconstruir la imagen. Si tienes un `.env` antiguo, cambia su valor a `/graphql` para usar el reenvío.

Para probar en Kubernetes sin exposición pública, sigue [las instrucciones de despliegue](../k8s/README.md). Solo necesitas un port-forward al Service del frontend.

## Qué hace
- **Modo claro / oscuro**: botón de luna o sol en la cabecera, disponible también antes de iniciar sesión. Usa la preferencia del sistema en la primera visita y guarda la elección en el navegador. Se aplica a toda la interfaz, incluidos diálogos, menús y notificaciones, sin dependencias adicionales.
- **Iniciar sesión** (icono arriba a la derecha): pegar un ID de usuario existente, o crear un usuario nuevo (pestaña "Crear usuario"). No es autenticación: solo indica quién escribe. El ID queda guardado en el navegador (`localStorage`) y se puede copiar desde el menú del usuario.
- Sin sesión, canales y mensajes están bloqueados.
- **Canales**: lista, buscador y creación de canales. Se actualiza cada 10 s.
- **Mensajes**: autor, hora (hora local) y contenido. Se actualizan cada 3 s (*polling*); el scroll baja solo salvo que hayas subido a leer.
- **Enviar**: Enter envía, Shift+Enter salto de línea.
- **Responder** (en cada mensaje): abre un campo bajo el mensaje principal. Las respuestas de un solo nivel quedan visibles debajo de ese mensaje y se actualizan junto con la conversación; si el envío falla, conserva el texto para reintentar.
- **Archivos** (icono de clip junto al campo de mensaje o en la cabecera): permite seleccionar y subir un archivo, listar los adjuntos del canal en páginas de 20 y descargarlos. Se actualiza al abrir la ventana, cambiar de página, subir un archivo o pulsar Actualizar. Los archivos pertenecen al canal y no se vinculan a un mensaje específico.
- **Archivos en la conversación**: se muestran junto a los mensajes por fecha, con autor, nombre, tamaño y descarga. Las imágenes tienen vista previa. Los adjuntos se actualizan cada 8 s y después de una subida; un fallo de Media no impide leer los mensajes. El historial de adjuntos se consulta por páginas de 100 para mostrarlo completo.
- Las subidas usan GraphQL multipart con `FormData` y `fetch` del navegador. Las descargas se abren desde el gateway, que envía a Media la identificación del usuario. No se agregan dependencias.
- **Programar** (icono de reloj): abre un diálogo con su propio campo de mensaje y un selector de fecha y hora futura (no usa ni borra lo que estés escribiendo en el chat); el mensaje lo envía el servicio de mensajes programados (p2).
- **Programados** (botón con calendario en la cabecera del canal, con contador): lista tus mensajes programados en ese canal.
  Pestaña *Activos* y pestaña *Historial* (enviados, anulados, fallidos). **Anular envío** pide confirmación y solo está
  disponible mientras el mensaje está *Pendiente* o *Reintentando*; si ya está *En cola* o *Enviando*, p2 no permite anularlo.
  Anular no borra el registro: queda en el Historial como *Anulado* (p2 no tiene borrado físico).

## Estructura
```
src/
  api.js            cliente GraphQL (fetch) y consultas/mutaciones
  hooks.js          usePolling (sin solaparse, pausa con la pestaña oculta)
  App.jsx           sesión + layout
  components/       incluye ChatPanel, Composer, ThreadDialog, AttachmentsDialog y diálogos de sesión, canales y programaciones
```
Dependencias: React, Chakra UI v3 y Emotion (requisito de Chakra). Vite solo como herramienta de desarrollo/build.
